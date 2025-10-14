const crypto = require('crypto');

let ethers;
try {
  ({ ethers } = require('ethers'));
} catch (error) {
  ethers = null;
}

class SignatureChainError extends Error {
  constructor(message, { code = 'chain.invalid', meta = null } = {}) {
    super(message);
    this.name = 'SignatureChainError';
    this.code = code;
    if (meta) {
      this.meta = meta;
    }
  }
}

function normaliseDomain(domain) {
  if (typeof domain !== 'string') {
    throw new SignatureChainError('Domain must be a string', { code: 'chain.domain-invalid' });
  }
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) {
    throw new SignatureChainError('Domain cannot be empty', { code: 'chain.domain-empty' });
  }
  if (/\s/.test(trimmed)) {
    throw new SignatureChainError('Domain cannot contain whitespace', { code: 'chain.domain-invalid' });
  }
  return trimmed;
}

function matchesExpectedDomain(domain, expected) {
  if (!expected) {
    return true;
  }
  const normalisedExpected = normaliseDomain(expected);
  if (domain === normalisedExpected) {
    return true;
  }
  return domain.endsWith(`.${normalisedExpected}`);
}

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (value && typeof value === 'object') {
    const sorted = Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalise(value[key]);
        return acc;
      }, {});
    return sorted;
  }
  return value;
}

function serialisePayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SignatureChainError('Signature payload must be an object', { code: 'chain.payload-invalid' });
  }
  return JSON.stringify(canonicalise(payload));
}

function resolvePayload(entry, index) {
  const { payload } = entry;
  if (!payload) {
    throw new SignatureChainError('Signature payload missing from chain entry', {
      code: 'chain.payload-missing',
      meta: { index },
    });
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('payload must resolve to an object');
      }
      return parsed;
    } catch (error) {
      throw new SignatureChainError('Unable to parse signature payload', {
        code: 'chain.payload-invalid',
        meta: { index, reason: error?.message },
      });
    }
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SignatureChainError('Signature payload must be an object', {
      code: 'chain.payload-invalid',
      meta: { index },
    });
  }
  return payload;
}

function parseTimestamp(value, field, index) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new SignatureChainError('Timestamp must be finite', {
        code: 'chain.timestamp-invalid',
        meta: { field, index },
      });
    }
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new SignatureChainError('Timestamp cannot be empty', {
        code: 'chain.timestamp-invalid',
        meta: { field, index },
      });
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new SignatureChainError('Timestamp format unsupported', {
        code: 'chain.timestamp-invalid',
        meta: { field, index },
      });
    }
    return parsed;
  }
  throw new SignatureChainError('Timestamp must be a string or number', {
    code: 'chain.timestamp-invalid',
    meta: { field, index },
  });
}

async function validateCovenantSignatureChain(chain, options = {}) {
  if (!ethers) {
    throw new SignatureChainError('Signature verification unavailable', {
      code: 'chain.dependency-missing',
    });
  }
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new SignatureChainError('Signature chain must be a non-empty array', {
      code: 'chain.empty',
    });
  }

  const {
    expectedDomain = null,
    trustedRootSignature = '',
    clock = () => Date.now(),
    toleranceMs = 120_000,
    partnerKeys = null,
    requirePartnerKey: requirePartnerKeyOption = null,
    requireHashMirroring = false,
    mirrorSeed = null,
    hashAlgorithm = 'sha256',
  } = options;

  if (typeof clock !== 'function') {
    throw new SignatureChainError('Clock option must be a function', { code: 'chain.clock-invalid' });
  }
  const now = Number(clock());
  if (!Number.isFinite(now)) {
    throw new SignatureChainError('Clock returned invalid time', { code: 'chain.clock-invalid' });
  }
  const tolerance = Math.max(0, Number(toleranceMs) || 0);

  const hashMessage = ethers?.hashMessage || ethers?.utils?.hashMessage;
  const recoverAddress = ethers?.recoverAddress || ethers?.utils?.recoverAddress;
  if (typeof hashMessage !== 'function' || typeof recoverAddress !== 'function') {
    throw new SignatureChainError('Ethers hash utilities unavailable', {
      code: 'chain.dependency-missing',
    });
  }

  const requirePartnerKey = resolvePartnerKeyRequirement(partnerKeys, requirePartnerKeyOption);
  const partnerKeyIndex = buildPartnerKeyIndex(partnerKeys, { requirePartnerKey });
  const mirrorContext = createHashMirror({
    trustedRootSignature,
    mirrorSeed,
    requireHashMirroring,
    hashAlgorithm,
  });

  let previousSignature = trustedRootSignature ?? '';
  let firstIssued = null;
  let lastExpires = null;
  let resolvedDomain = null;
  const partners = [];
  const mirrorTrail = [];

  for (let index = 0; index < chain.length; index += 1) {
    const entry = chain[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new SignatureChainError('Each signature chain entry must be an object', {
        code: 'chain.entry-invalid',
        meta: { index },
      });
    }
    const domain = normaliseDomain(entry.domain ?? '');
    if (!matchesExpectedDomain(domain, expectedDomain)) {
      throw new SignatureChainError('Chain domain does not match expected covenant domain', {
        code: 'chain.domain-mismatch',
        meta: { index, domain, expected: expectedDomain },
      });
    }
    if (!resolvedDomain) {
      resolvedDomain = domain;
    }

    const payload = resolvePayload(entry, index);
    const payloadDomain = normaliseDomain(payload.domain ?? domain);
    if (payloadDomain !== domain) {
      throw new SignatureChainError('Payload domain does not match chain entry domain', {
        code: 'chain.domain-mismatch',
        meta: { index, domain: payloadDomain, entryDomain: domain },
      });
    }

    const partnerId = String(entry.partnerId ?? payload.partnerId ?? '').trim();
    if (!partnerId) {
      throw new SignatureChainError('Partner identifier required for signature chain', {
        code: 'chain.partner-missing',
        meta: { index },
      });
    }
    partners.push(partnerId);

    const partnerKey = partnerKeyIndex.get(partnerId);
    if (!partnerKey && requirePartnerKey) {
      throw new SignatureChainError('Trusted covenant key missing for partner', {
        code: 'chain.partner-key-missing',
        meta: { index, partnerId },
      });
    }

    const signer = String(entry.signer ?? '').trim();
    if (!signer) {
      throw new SignatureChainError('Signer address required for signature chain', {
        code: 'chain.signer-missing',
        meta: { index },
      });
    }

    const signature = String(entry.signature ?? '').trim();
    if (!signature) {
      throw new SignatureChainError('Signature required for signature chain entry', {
        code: 'chain.signature-missing',
        meta: { index },
      });
    }

    const previous = payload.previousSignature ?? payload.previous ?? payload.prevSignature ?? '';
    if ((previous ?? '') !== (previousSignature ?? '')) {
      throw new SignatureChainError('Signature chain link mismatch', {
        code: 'chain.link-mismatch',
        meta: { index, expected: previousSignature, received: previous },
      });
    }

    const serialised = serialisePayload(payload);
    let recovered;
    try {
      const hash = hashMessage(serialised);
      recovered = recoverAddress(hash, signature);
    } catch (error) {
      throw new SignatureChainError('Unable to verify signature payload', {
        code: 'chain.signature-invalid',
        meta: { index, reason: error?.message },
      });
    }

    if (recovered.toLowerCase() !== signer.toLowerCase()) {
      throw new SignatureChainError('Signature does not match declared signer', {
        code: 'chain.signature-mismatch',
        meta: { index, expected: signer, recovered },
      });
    }

    if (partnerKey && partnerKey.address && partnerKey.address !== signer.toLowerCase()) {
      throw new SignatureChainError('Signature signer does not match trusted covenant key', {
        code: 'chain.partner-key-mismatch',
        meta: { index, partnerId, expected: partnerKey.address, recovered: signer.toLowerCase() },
      });
    }

    const issuedAt = parseTimestamp(entry.issuedAt ?? payload.issuedAt, 'issuedAt', index);
    const expiresAt = parseTimestamp(entry.expiresAt ?? payload.expiresAt, 'expiresAt', index);
    if (expiresAt <= issuedAt) {
      throw new SignatureChainError('Signature chain entry expires before it is issued', {
        code: 'chain.expiry-invalid',
        meta: { index },
      });
    }
    if (issuedAt - tolerance > now) {
      throw new SignatureChainError('Signature chain entry issued in the future', {
        code: 'chain.issued-in-future',
        meta: { index },
      });
    }
    if (expiresAt + tolerance < now) {
      throw new SignatureChainError('Signature chain entry has expired', {
        code: 'chain.expired',
        meta: { index },
      });
    }

    if (firstIssued === null || issuedAt < firstIssued) {
      firstIssued = issuedAt;
    }
    if (lastExpires === null || expiresAt > lastExpires) {
      lastExpires = expiresAt;
    }
    previousSignature = signature;

    const mirrorRecord = mirrorContext.step({
      index,
      payload: serialised,
      signature,
      declaredHash: entry.mirrorHash ?? payload.mirrorHash ?? null,
      partnerId,
    });
    mirrorTrail.push(mirrorRecord);
  }

  const lastEntry = chain[chain.length - 1];
  const payload = resolvePayload(lastEntry, chain.length - 1);
  const covenantId = String(lastEntry.covenantId ?? payload.covenantId ?? payload.covenant ?? '').trim() || null;

  return {
    domain: resolvedDomain,
    partners,
    chainLength: chain.length,
    issuedAt: new Date(firstIssued).toISOString(),
    expiresAt: new Date(lastExpires).toISOString(),
    covenantId,
    trustedRootSignature: trustedRootSignature ?? '',
    mirrorHash: mirrorContext.currentHash,
    mirrorTrail,
  };
}

const __testing = {
  normaliseDomain,
  matchesExpectedDomain,
  canonicalise,
  serialisePayload,
  buildPartnerKeyIndex,
  createHashMirror,
  resolvePartnerKeyRequirement,
};

module.exports = {
  SignatureChainError,
  validateCovenantSignatureChain,
  __testing,
};

function buildPartnerKeyIndex(partnerKeys, { requirePartnerKey }) {
  const index = new Map();
  if (!partnerKeys) {
    return index;
  }
  const entries = Array.isArray(partnerKeys)
    ? partnerKeys
    : typeof partnerKeys === 'object'
      ? Object.values(partnerKeys)
      : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const partnerId = normaliseDomain(entry.partnerId || entry.id || '');
    const address = typeof entry.address === 'string' ? entry.address.trim().toLowerCase() : null;
    if (!address) {
      if (requirePartnerKey) {
        throw new SignatureChainError('Partner key entry missing address', {
          code: 'chain.partner-key-invalid',
          meta: { partnerId },
        });
      }
      continue;
    }
    index.set(partnerId, {
      address,
      issuedAt: entry.issuedAt ? new Date(entry.issuedAt).toISOString() : null,
      fingerprint: entry.fingerprint || null,
    });
  }
  return index;
}

function resolvePartnerKeyRequirement(partnerKeys, option) {
  if (typeof option === 'boolean') {
    return option;
  }
  if (!partnerKeys) {
    return false;
  }
  if (Array.isArray(partnerKeys)) {
    return partnerKeys.length > 0;
  }
  if (typeof partnerKeys === 'object') {
    return Object.keys(partnerKeys).length > 0;
  }
  return false;
}

function createHashMirror({ trustedRootSignature, mirrorSeed, requireHashMirroring, hashAlgorithm }) {
  let currentHash = computeInitialMirror({ trustedRootSignature, mirrorSeed, hashAlgorithm });
  return {
    get currentHash() {
      return currentHash;
    },
    step({ index, payload, signature, declaredHash, partnerId }) {
      const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const nextHash = computeMirrorHash({
        previous: currentHash,
        payload: normalizedPayload,
        signature: signature ?? '',
        hashAlgorithm,
      });
      if (declaredHash) {
        if (declaredHash !== nextHash) {
          throw new SignatureChainError('Hash mirror mismatch for covenant chain', {
            code: 'chain.mirror-mismatch',
            meta: { index, partnerId, expected: nextHash, received: declaredHash },
          });
        }
      } else if (requireHashMirroring) {
        throw new SignatureChainError('Hash mirror missing for covenant entry', {
          code: 'chain.mirror-missing',
          meta: { index, partnerId },
        });
      }
      currentHash = nextHash;
      return {
        index,
        partnerId,
        hash: nextHash,
        declaredHash: declaredHash || null,
      };
    },
  };
}

function computeInitialMirror({ trustedRootSignature, mirrorSeed, hashAlgorithm }) {
  const base = mirrorSeed || trustedRootSignature || '';
  return computeDigest(base, hashAlgorithm);
}

function computeMirrorHash({ previous, payload, signature, hashAlgorithm }) {
  const working = `${previous || ''}::${payload || ''}::${signature || ''}`;
  return computeDigest(working, hashAlgorithm);
}

function computeDigest(value, hashAlgorithm) {
  const algorithm = hashAlgorithm || 'sha256';
  try {
    return crypto.createHash(algorithm).update(String(value)).digest('hex');
  } catch (error) {
    throw new SignatureChainError('Unable to compute hash mirror digest', {
      code: 'chain.hash-unsupported',
      meta: { algorithm },
    });
  }
}
