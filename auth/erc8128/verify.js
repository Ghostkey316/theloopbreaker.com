'use strict';

const { parseDictionary } = require('structured-headers');
const { ethers } = require('ethers');
const { computeContentDigestSha256, parseContentDigest, parseKeyId, normalizeHost, nowUnix } = require('./utils');

const ERC1271_ABI = [
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4 magicValue)',
];

const ERC1271_MAGICVALUE = '0x1626ba7e';

function findSignatureLabel(sigInputDict, preferred = ['eth', 'sig1']) {
  for (const label of preferred) {
    if (sigInputDict.has(label)) return label;
  }
  // fall back to first
  const it = sigInputDict.keys();
  const first = it.next();
  return first.done ? null : first.value;
}

function parseSignatureHeaders(req) {
  const sigInput = req.headers['signature-input'] || req.headers['Signature-Input'];
  const sig = req.headers['signature'] || req.headers['Signature'];
  if (!sigInput || !sig) return null;

  const dict = parseDictionary(String(sigInput));
  const label = findSignatureLabel(dict);
  if (!label) return null;

  // dict.get(label) is either Item or InnerList. For signature-input it should be InnerList.
  const value = dict.get(label);
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [innerList, params] = value;
  const components = innerList.map((item) => {
    // item: [bareItem, params]
    const bare = item && item[0];
    return String(bare);
  });

  // Signature header value is a dict too per RFC 9421, but many implementations just give `label=:b64:`.
  // We'll parse minimal: find `${label}=...` token.
  const sigHeader = String(sig);
  const m = sigHeader.match(new RegExp(`${label}\\s*=\\s*:([^:]+):`, 'i'));
  if (!m) {
    // try direct `:b64:` without label
    const m2 = sigHeader.match(/:([^:]+):/);
    if (!m2) return null;
    return { label, components, params, signatureB64: m2[1], rawSigInput: String(sigInput) };
  }

  return { label, components, params, signatureB64: m[1], rawSigInput: String(sigInput) };
}

function buildAuthority(req) {
  // @authority is host[:port]
  return normalizeHost(req.headers.host);
}

function buildPathAndQuery(req) {
  const host = req.headers.host || 'example.invalid';
  // Express: originalUrl includes path + query
  const url = new URL(req.originalUrl || req.url || '/', `http://${host}`);
  return { path: url.pathname, query: url.search || '' };
}

function hasBody(req) {
  const len = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(len) && len > 0) return true;
  // If body-parser ran, rawBody may exist.
  if (req.rawBody && req.rawBody.length > 0) return true;
  return false;
}

function requireRequestBoundComponents({ components, requestHasQuery, requestHasBody }) {
  const set = new Set(components);

  const required = ['@authority', '@method', '@path'];
  for (const r of required) {
    if (!set.has(r) && !set.has(`"${r}"`)) {
      return { ok: false, reason: `missing_component:${r}` };
    }
  }

  if (requestHasQuery) {
    if (!set.has('@query') && !set.has('"@query"')) {
      return { ok: false, reason: 'missing_component:@query' };
    }
  }

  if (requestHasBody) {
    if (!set.has('content-digest') && !set.has('"content-digest"')) {
      return { ok: false, reason: 'missing_component:content-digest' };
    }
  }

  return { ok: true };
}

function enforceTimePolicy({ created, expires, now, skewSec, maxWindowSec }) {
  if (!Number.isInteger(created) || !Number.isInteger(expires)) {
    return { ok: false, reason: 'invalid_timestamps' };
  }
  if (expires <= created) return { ok: false, reason: 'expires_le_created' };

  const window = expires - created;
  if (window > maxWindowSec) return { ok: false, reason: 'window_too_long' };

  // allow skew on created
  if (now < created - skewSec) return { ok: false, reason: 'too_early' };
  if (now > expires + skewSec) return { ok: false, reason: 'too_late' };

  return { ok: true };
}

function buildSignatureBase({ components, params, req }) {
  // Minimal RFC 9421 signature base builder for the covered components we accept.
  // This intentionally focuses on ERC-8128 baseline requirements.

  const method = String(req.method || '').toUpperCase();
  const authority = buildAuthority(req);
  const { path, query } = buildPathAndQuery(req);

  const lines = [];

  const requestHasQuery = Boolean(query);
  const requestHasBody = hasBody(req);

  for (const c of components) {
    const comp = String(c).replace(/^"|"$/g, '');

    if (comp === '@method') {
      lines.push('"@method": ' + method);
    } else if (comp === '@authority') {
      lines.push('"@authority": ' + authority);
    } else if (comp === '@path') {
      lines.push('"@path": ' + path);
    } else if (comp === '@query') {
      lines.push('"@query": ' + query);
    } else if (comp === 'content-digest') {
      const cd = req.headers['content-digest'];
      if (!cd) throw new Error('content-digest header required');
      lines.push('"content-digest": ' + String(cd));
    } else {
      // Unknown components are not supported in v1.
      throw new Error(`unsupported_component:${comp}`);
    }
  }

  // Build @signature-params line.
  // Note: structured fields serialization is tricky; we keep v1 strict and require expected param types.
  const paramPairs = [];
  if (params && params instanceof Map) {
    for (const [k, v] of params.entries()) {
      // structured-headers returns Tokens/strings/numbers
      if (k === 'created' || k === 'expires') {
        paramPairs.push(`${k}=${Number(v)}`);
      } else if (k === 'nonce' || k === 'keyid') {
        // quote strings
        paramPairs.push(`${k}="${String(v)}"`);
      } else {
        // ignore unknown params for base line? spec includes them; to be safe we include them as strings.
        paramPairs.push(`${k}="${String(v)}"`);
      }
    }
  }

  const compsSerialized = components
    .map((x) => String(x).replace(/^"|"$/g, ''))
    .map((x) => `"${x}"`)
    .join(' ');

  lines.push(`"@signature-params": (${compsSerialized});${paramPairs.join(';')}`);

  // RFC 9421 uses newlines between components.
  return lines.join('\n');
}

async function verifyErc1271({ provider, address, hash, signatureBytes }) {
  const c = new ethers.Contract(address, ERC1271_ABI, provider);
  const res = await c.isValidSignature(hash, signatureBytes);
  return String(res).toLowerCase() === ERC1271_MAGICVALUE;
}

async function verifyRequest(req, {
  nonceStore,
  providersByChainId,
  skewSec = 60,
  maxWindowSec = 60,
} = {}) {
  const parsed = parseSignatureHeaders(req);
  if (!parsed) {
    return { ok: false, code: 'erc8128.missing_headers', message: 'Missing Signature-Input / Signature' };
  }

  const { components, params, signatureB64 } = parsed;
  const created = params?.get ? Number(params.get('created')) : NaN;
  const expires = params?.get ? Number(params.get('expires')) : NaN;
  const nonce = params?.get ? params.get('nonce') : null;
  const keyid = params?.get ? params.get('keyid') : null;

  if (!nonce) {
    return { ok: false, code: 'erc8128.replayable_rejected', message: 'nonce required (Non-Replayable only)' };
  }
  if (!keyid) {
    return { ok: false, code: 'erc8128.missing_keyid', message: 'keyid required' };
  }

  const kid = parseKeyId(String(keyid));
  if (!kid) {
    return { ok: false, code: 'erc8128.invalid_keyid', message: 'keyid must be erc8128:<chain-id>:<address>' };
  }

  const { chainId, address } = kid;
  const provider = providersByChainId?.[chainId] || null;
  if (!provider) {
    return { ok: false, code: 'erc8128.unsupported_chain', message: `Unsupported chainId: ${chainId}` };
  }

  const { path, query } = buildPathAndQuery(req);
  const requestHasQuery = Boolean(query);
  const requestHasBody = hasBody(req);

  const compCheck = requireRequestBoundComponents({ components: components.map(String), requestHasQuery, requestHasBody });
  if (!compCheck.ok) {
    return { ok: false, code: 'erc8128.not_request_bound', message: compCheck.reason };
  }

  const now = nowUnix();
  const timeCheck = enforceTimePolicy({ created: Math.trunc(created), expires: Math.trunc(expires), now, skewSec, maxWindowSec });
  if (!timeCheck.ok) {
    return { ok: false, code: 'erc8128.time_invalid', message: timeCheck.reason };
  }

  // If content-digest is required, verify it against raw body.
  if (requestHasBody) {
    const cdHeader = req.headers['content-digest'];
    if (!cdHeader) {
      return { ok: false, code: 'erc8128.content_digest_missing', message: 'content-digest required' };
    }
    if (!req.rawBody) {
      return { ok: false, code: 'erc8128.raw_body_missing', message: 'raw body capture required for content-digest verification' };
    }
    const expected = computeContentDigestSha256(req.rawBody);
    const parsedCd = parseContentDigest(cdHeader);
    if (!parsedCd) {
      return { ok: false, code: 'erc8128.content_digest_invalid', message: 'content-digest must be sha-256=:...:' };
    }
    if (String(cdHeader).trim() !== expected) {
      return { ok: false, code: 'erc8128.content_digest_mismatch', message: 'content-digest mismatch' };
    }
  }

  // Replay protection: claim nonce.
  const replayKey = `${chainId}:${address}:${String(nonce)}`;
  const ttlMs = Math.max(1, (Math.trunc(expires) - now + skewSec) * 1000);
  const claimed = await nonceStore.claim(replayKey, ttlMs);
  if (!claimed) {
    return { ok: false, code: 'erc8128.nonce_reused', message: 'nonce already used' };
  }

  let sigBytes;
  try {
    sigBytes = Buffer.from(String(signatureB64), 'base64');
  } catch {
    return { ok: false, code: 'erc8128.bad_signature', message: 'invalid base64 signature' };
  }

  let M;
  try {
    M = buildSignatureBase({ components: components.map(String), params, req });
  } catch (error) {
    return { ok: false, code: 'erc8128.base_error', message: error.message };
  }

  // EOA verify via recover
  const recovered = ethers.verifyMessage(M, sigBytes).toLowerCase();

  if (recovered === address) {
    return { ok: true, wallet: address, chainId, authType: 'erc8128', mode: 'eoa' };
  }

  // If not EOA match, attempt ERC-1271 if address is contract.
  const code = await provider.getCode(address);
  if (!code || code === '0x') {
    return { ok: false, code: 'erc8128.recover_mismatch', message: 'signature does not match keyid address' };
  }

  const hash = ethers.hashMessage(M); // EIP-191 digest
  try {
    const ok1271 = await verifyErc1271({ provider, address, hash, signatureBytes: sigBytes });
    if (!ok1271) {
      return { ok: false, code: 'erc8128.erc1271_invalid', message: 'ERC-1271 verification failed' };
    }
    return { ok: true, wallet: address, chainId, authType: 'erc8128', mode: 'erc1271' };
  } catch (error) {
    return { ok: false, code: 'erc8128.erc1271_error', message: error.message };
  }
}

module.exports = {
  verifyRequest,
};
