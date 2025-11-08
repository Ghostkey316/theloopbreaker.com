#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const LOG_PATH = path.join(__dirname, '..', 'logs', 'guardian-echo.log');
const GROK_API_URL = process.env.GROK_API_URL || 'https://api.x.ai/v1/grok';
const GROK_API_KEY = process.env.GROK_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const X_BADGE_WEBHOOK = process.env.X_BADGE_WEBHOOK || '';

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true, mode: 0o700 });
}

function writeLog(message) {
  ensureLogDir();
  fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`, { encoding: 'utf8' });
}

function buildPayload() {
  return {
    model: 'grok-beta',
    stream: false,
    messages: [
      {
        role: 'user',
        content: `Guardian echo request at ${new Date().toISOString()}.` +
          ' Surface all FreedomIgnited events since the previous checkpoint and respond with vow hashes only.',
      },
    ],
    metadata: {
      covenant: 'vaultfire-freedom',
      rewardStream: process.env.REWARD_STREAM_ADDRESS || 'unknown',
    },
  };
}

function safePreview(data) {
  try {
    return JSON.stringify(data).slice(0, 280);
  } catch (error) {
    return `[unserializable:${error.message}]`;
  }
}

async function postToGrok(payload) {
  if (!GROK_API_KEY) {
    writeLog('⚠️  Missing GROK_API_KEY, skipping remote post');
    return { status: 'skipped', reason: 'missing-key' };
  }

  const response = await fetch(GROK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grok API failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function emitXBadgeEvent(event) {
  const serialized = safePreview(event);

  if (!X_BADGE_WEBHOOK) {
    writeLog(`ℹ️  X badging webhook not configured; captured stub payload ${serialized}`);
    return { status: 'skipped', reason: 'missing-webhook' };
  }

  if (DRY_RUN) {
    writeLog(`[dry-run:x-badge] ${serialized}`);
    console.log('[dry-run] X badge event', serialized);
    return { status: 'dry-run' };
  }

  writeLog(`Stub X badging hook invoked for ${event.type || 'guardian.echo'}`);
  writeLog('⚠️  Implement live X badging dispatch before enabling production webhooks.');
  return { status: 'stubbed' };
}

async function main() {
  const payload = buildPayload();
  writeLog(`Dispatching guardian echo (dryRun=${DRY_RUN})`);

  if (DRY_RUN) {
    console.log('[dry-run] Guardian echo payload', JSON.stringify(payload));
    return;
  }

  try {
    const result = await postToGrok(payload);
    const preview = safePreview(result);
    writeLog(`Guardian echo result ${preview}`);

    await emitXBadgeEvent({
      type: 'guardian.echo',
      timestamp: new Date().toISOString(),
      covenant: payload.metadata?.covenant,
      rewardStream: payload.metadata?.rewardStream,
      grokStatus: result?.status || 'ok',
      preview,
    });
    console.log('Guardian echo dispatched ✅');
  } catch (error) {
    writeLog(`Guardian echo failed ${error.message}`);
    console.error('Guardian echo failed:', error);
    process.exitCode = 1;
  }
}

main();
