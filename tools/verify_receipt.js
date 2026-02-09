#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

const DEFAULT_NAMESPACE = 'vaultfire-verify';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readIfExists(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

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

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~' + path.sep) || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function findSigningKey(explicitKeyPath) {
  const envKey = explicitKeyPath || process.env.VAULTFIRE_SIGNING_KEY || process.env.SSH_SIGNING_KEY;
  if (envKey) {
    const p = expandHome(envKey);
    return fileExists(p) ? p : null;
  }

  const candidates = [
    path.join(os.homedir(), '.ssh', 'id_ed25519'),
    path.join(os.homedir(), '.ssh', 'id_ecdsa'),
    path.join(os.homedir(), '.ssh', 'id_rsa')
  ];
  for (const c of candidates) {
    if (fileExists(c)) return c;
  }
  return null;
}

function derivePublicKey(privateKeyPath) {
  return execFileSync('ssh-keygen', ['-y', '-f', privateKeyPath], { encoding: 'utf8' }).trim();
}

function sshSignFile({ privateKeyPath, namespace, filePath }) {
  // Produces `${filePath}.sig`
  execFileSync('ssh-keygen', ['-Y', 'sign', '-f', privateKeyPath, '-n', namespace, filePath], { stdio: 'inherit' });
  const sigPath = `${filePath}.sig`;
  if (!fileExists(sigPath)) {
    throw new Error(`Expected signature at ${sigPath} but it was not created.`);
  }
  return sigPath;
}

function sshVerifyFile({ allowedSignersPath, identity, namespace, sigPath, filePath }) {
  execFileSync(
    'ssh-keygen',
    ['-Y', 'verify', '-f', allowedSignersPath, '-I', identity, '-n', namespace, '-s', sigPath, filePath],
    { stdio: 'inherit' }
  );
}

function buildReceipt({ repoRoot }) {
  const receipt = {
    kind: 'vaultfire.verify.receipt',
    version: 2,
    createdAtUtc: new Date().toISOString(),
    repo: {
      path: repoRoot,
      git: {
        commit: run('git rev-parse HEAD'),
        branch: run('git branch --show-current'),
        status: run('git status -sb'),
        remote: run('git remote -v')
      }
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    inputs: {
      'package.json': null,
      'package-lock.json': null,
      'README.md': null
    }
  };

  for (const file of Object.keys(receipt.inputs)) {
    const abs = path.join(repoRoot, file);
    const buf = readIfExists(abs);
    if (!buf) continue;
    receipt.inputs[file] = {
      path: file,
      bytes: buf.length,
      sha256: sha256(buf)
    };
  }

  // Tamper-evident receipt hash (hash of canonical JSON string)
  const canonical = JSON.stringify(receipt);
  receipt.receiptSha256 = sha256(Buffer.from(canonical, 'utf8'));

  return receipt;
}

(function main() {
  const args = parseArgs(process.argv.slice(2));
  const namespace = String(args.namespace || DEFAULT_NAMESPACE);

  const repoRoot = path.join(__dirname, '..');
  const artifactsDir = path.join(repoRoot, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const outPath = path.join(artifactsDir, 'verify-receipt.json');
  const outHashPath = path.join(artifactsDir, 'verify-receipt.sha256');
  const allowedSignersPath = path.join(artifactsDir, 'verify-receipt.allowed_signers');
  const sigOutPath = path.join(artifactsDir, 'verify-receipt.sig');

  const shouldSign = args.sign === 'auto' || args.sign === true;
  const requireSign = Boolean(args['require-sign'] || args.requireSign);

  const signerIdentity =
    String(args.identity || process.env.VAULTFIRE_SIGNER_ID || run('git config user.email') || 'local');

  const receipt = buildReceipt({ repoRoot });
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  fs.writeFileSync(outHashPath, `${receipt.receiptSha256}  verify-receipt.json\n`, 'utf8');

  console.log(`Wrote verification receipt: ${outPath}`);
  console.log(`Receipt SHA256: ${receipt.receiptSha256}`);

  if (!shouldSign) {
    return;
  }

  const keyPath = findSigningKey(args.key);
  if (!keyPath) {
    const msg =
      'No SSH signing key found. Set VAULTFIRE_SIGNING_KEY to a private key path (e.g., ~/.ssh/id_ed25519) or pass --key <path>.';
    if (requireSign) {
      console.error(msg);
      process.exitCode = 2;
      return;
    }
    console.warn(`⚠ ${msg}`);
    return;
  }

  let publicKey;
  try {
    publicKey = derivePublicKey(keyPath);
  } catch (error) {
    console.error(`✖ Failed to derive public key from ${keyPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  // allowed_signers format: <principal> <publickey>
  fs.writeFileSync(allowedSignersPath, `${signerIdentity} ${publicKey}\n`, 'utf8');

  // Sign receipt file
  let sigPath;
  try {
    sigPath = sshSignFile({ privateKeyPath: keyPath, namespace, filePath: outPath });
  } catch (error) {
    console.error(`✖ Failed to sign receipt: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  // Move signature next to receipt with stable name
  fs.renameSync(sigPath, sigOutPath);

  console.log(`Signed receipt (ssh-keygen -Y sign): ${sigOutPath}`);
  console.log(`Allowed signers file: ${allowedSignersPath}`);
  console.log(`Signer identity: ${signerIdentity}`);
  console.log(`Namespace: ${namespace}`);

  // Self-verify
  try {
    sshVerifyFile({
      allowedSignersPath,
      identity: signerIdentity,
      namespace,
      sigPath: sigOutPath,
      filePath: outPath
    });
    console.log('Signature verification: OK');
  } catch (error) {
    console.error(`✖ Signature verification failed: ${error.message}`);
    process.exitCode = 2;
  }
})();
