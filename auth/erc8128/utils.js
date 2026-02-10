'use strict';

const crypto = require('crypto');

function sha256Base64(buf) {
  return crypto.createHash('sha256').update(buf).digest('base64');
}

function computeContentDigestSha256(rawBody) {
  const b64 = sha256Base64(rawBody);
  return `sha-256=:${b64}:`;
}

function parseContentDigest(headerValue) {
  // Minimal parser for "sha-256=:<b64>:" format.
  const v = String(headerValue || '').trim();
  const m = v.match(/^sha-256=:(.+):$/i);
  if (!m) return null;
  return { alg: 'sha-256', b64: m[1] };
}

function normalizeHost(hostHeader) {
  return String(hostHeader || '').trim();
}

function parseKeyId(keyid) {
  // keyid="erc8128:<chain-id>:<address>"
  const v = String(keyid || '').trim();
  const m = v.match(/^erc8128:(\d+):(0x[a-fA-F0-9]{40})$/);
  if (!m) return null;
  return { chainId: Number(m[1]), address: m[2].toLowerCase() };
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

module.exports = {
  computeContentDigestSha256,
  parseContentDigest,
  normalizeHost,
  parseKeyId,
  nowUnix,
};
