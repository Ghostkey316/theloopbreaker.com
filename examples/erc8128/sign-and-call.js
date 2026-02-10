/*
  Minimal ERC-8128 client demo (Vaultfire).

  This script is NOT a full RFC 9421 implementation; it is aligned to Vaultfire's baseline
  acceptance policy in docs/ERC8128_HTTP_AUTH.md and uses the same signature-base strategy
  as the server verifier.

  Usage (example):
    node examples/erc8128/sign-and-call.js \
      --url http://localhost:4002/health \
      --method GET \
      --chainId 8453 \
      --privateKey 0x... \
      --nonce demo123

  If calling a POST with JSON body, pass --json '{"hello":"world"}'.
*/

'use strict';

const crypto = require('crypto');

function arg(name, fallback = null) {
  const idx = process.argv.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const { ethers } = require('ethers');

function sha256Base64(buf) {
  return crypto.createHash('sha256').update(buf).digest('base64');
}

function computeContentDigestSha256(rawBody) {
  return `sha-256=:${sha256Base64(rawBody)}:`;
}

function buildSignatureBase({ method, authority, path, query, contentDigest, sigParamsLine, components }) {
  const lines = [];

  for (const comp of components) {
    if (comp === '@method') lines.push('"@method": ' + method);
    else if (comp === '@authority') lines.push('"@authority": ' + authority);
    else if (comp === '@path') lines.push('"@path": ' + path);
    else if (comp === '@query') lines.push('"@query": ' + query);
    else if (comp === 'content-digest') lines.push('"content-digest": ' + contentDigest);
    else throw new Error(`unsupported component: ${comp}`);
  }

  lines.push(sigParamsLine);
  return lines.join('\n');
}

function buildSignatureInput({ label, components, created, expires, nonce, keyid }) {
  const comps = components.map((c) => `"${c}"`).join(' ');
  return `${label}=( ${comps} );created=${created};expires=${expires};nonce="${nonce}";keyid="${keyid}"`;
}

async function main() {
  const url = arg('url');
  const method = String(arg('method', 'GET')).toUpperCase();
  const chainId = Number(arg('chainId', '1'));
  const privateKey = arg('privateKey');
  const json = arg('json', null);
  const nonce = arg('nonce', crypto.randomBytes(12).toString('base64url'));

  if (!url) throw new Error('--url required');
  if (!privateKey) throw new Error('--privateKey required');

  const u = new URL(url);
  const authority = u.host;
  const path = u.pathname;
  const query = u.search || '';

  const bodyBuf = json ? Buffer.from(String(json), 'utf8') : Buffer.alloc(0);
  const hasBody = bodyBuf.length > 0;

  const components = ['@method', '@authority', '@path'];
  if (query) components.push('@query');
  if (hasBody) components.push('content-digest');

  const created = Math.floor(Date.now() / 1000);
  const expires = created + 45;

  const wallet = new ethers.Wallet(privateKey);
  const keyid = `erc8128:${chainId}:${wallet.address.toLowerCase()}`;

  const headers = {
    'host': authority,
  };

  if (hasBody) {
    headers['content-type'] = 'application/json';
    headers['content-digest'] = computeContentDigestSha256(bodyBuf);
    headers['content-length'] = String(bodyBuf.length);
  }

  const sigInput = buildSignatureInput({
    label: 'eth',
    components,
    created,
    expires,
    nonce,
    keyid,
  });

  const sigParamsLine = `"@signature-params": (${components.map((c) => `"${c}"`).join(' ')});created=${created};expires=${expires};nonce="${nonce}";keyid="${keyid}"`;

  const M = buildSignatureBase({
    method,
    authority,
    path,
    query,
    contentDigest: headers['content-digest'],
    sigParamsLine,
    components,
  });

  const sigBytes = await wallet.signMessage(M);
  const sigB64 = Buffer.from(ethers.getBytes(sigBytes)).toString('base64');

  headers['signature-input'] = sigInput;
  headers['signature'] = `eth=:${sigB64}:`;

  const res = await fetch(url, {
    method,
    headers,
    body: hasBody ? bodyBuf : undefined,
  });

  const text = await res.text();
  console.log(res.status);
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
