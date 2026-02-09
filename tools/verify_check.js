#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_NAMESPACE = 'vaultfire-verify';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const [k, vRaw] = a.slice(2).split('=');
    if (vRaw !== undefined) {
      out[k] = vRaw;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[k] = next;
      i += 1;
    } else {
      out[k] = true;
    }
  }
  return out;
}

function ensureFile(p, label) {
  if (!p) throw new Error(`Missing required argument for ${label}.`);
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return abs;
}

(function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    const receiptPath = ensureFile(args.receipt, '--receipt');
    const sigPath = ensureFile(args.sig, '--sig');
    const allowedPath = ensureFile(args.allowed, '--allowed');

    const identity = String(args.identity || args.I || 'local');
    const namespace = String(args.namespace || DEFAULT_NAMESPACE);

    execFileSync(
      'ssh-keygen',
      ['-Y', 'verify', '-f', allowedPath, '-I', identity, '-n', namespace, '-s', sigPath, receiptPath],
      { stdio: 'inherit' }
    );

    console.log('Receipt signature verification: OK');
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exitCode = 1;
  }
})();
