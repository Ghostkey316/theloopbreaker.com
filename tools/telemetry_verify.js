#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sinksDir = path.join(__dirname, '..', 'telemetry', 'sinks');

function fail(message) {
  console.error(`\x1b[31m[telemetry:verify] ${message}\x1b[0m`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`\x1b[32m[telemetry:verify] ${message}\x1b[0m`);
}

if (!fs.existsSync(sinksDir)) {
  fail(`No telemetry sinks directory found at ${sinksDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(sinksDir)
  .filter((file) => file.startsWith('live-') && file.endsWith('.json'));

if (files.length === 0) {
  fail('No live sink manifests were discovered.');
  process.exit(1);
}

let hasFailure = false;

for (const file of files) {
  const manifestPath = path.join(sinksDir, file);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`Unable to parse ${file}: ${error.message}`);
    hasFailure = true;
    continue;
  }

  const { name, testPayload, expectedChecksum, signatureProbe } = manifest;
  if (!testPayload || !expectedChecksum) {
    fail(`${file} is missing required fields (testPayload, expectedChecksum).`);
    hasFailure = true;
    continue;
  }

  const checksum = crypto
    .createHash('sha256')
    .update(testPayload)
    .digest('hex');

  if (checksum !== expectedChecksum) {
    fail(`${name || file} checksum mismatch. Expected ${expectedChecksum}, computed ${checksum}.`);
    hasFailure = true;
  } else {
    ok(`${name || file} checksum validated.`);
  }

  if (signatureProbe) {
    const { algorithm = 'sha256', testSecret, expected } = signatureProbe;
    if (!testSecret || !expected) {
      fail(`${name || file} signature probe is missing testSecret or expected.`);
      hasFailure = true;
    } else {
      let hmac;
      try {
        hmac = crypto.createHmac(algorithm, testSecret).update(testPayload).digest('hex');
      } catch (error) {
        fail(`${name || file} signature probe failed to compute: ${error.message}`);
        hasFailure = true;
        continue;
      }
      if (hmac !== expected) {
        fail(`${name || file} signature mismatch. Expected ${expected}, computed ${hmac}.`);
        hasFailure = true;
      } else {
        ok(`${name || file} signature probe validated.`);
      }
    }
  }
}

if (hasFailure) {
  process.exitCode = 1;
  console.error('\nOne or more telemetry sinks failed verification.');
} else {
  console.log('\nAll telemetry sinks passed verification.');
}
