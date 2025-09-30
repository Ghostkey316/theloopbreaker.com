#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'security-watch.log');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readLastRun() {
  if (!fs.existsSync(LOG_FILE)) {
    return null;
  }
  const contents = fs.readFileSync(LOG_FILE, 'utf8');
  const matches = [...contents.matchAll(/\[(.*?)\]/g)];
  if (matches.length === 0) {
    return null;
  }
  const lastIso = matches[matches.length - 1][1];
  const parsed = Date.parse(lastIso);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
}

function appendLog(entry) {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${entry}\n`, { encoding: 'utf8' });
}

function formatSummary(metadata) {
  if (!metadata || !metadata.vulnerabilities) {
    return 'summary unavailable';
  }
  const parts = Object.entries(metadata.vulnerabilities)
    .filter(([severity]) => ['info', 'low', 'moderate', 'high', 'critical', 'total'].includes(severity))
    .map(([severity, count]) => `${severity}:${count}`);
  return parts.join(' | ');
}

function main() {
  const now = new Date();
  const lastRun = readLastRun();
  if (lastRun && now - lastRun < WEEK_MS) {
    console.warn(
      `⚠️  [security:watch] Last npm audit logged ${Math.round((now - lastRun) / (24 * 60 * 60 * 1000))} days ago. Continuing to record for manual trigger.`
    );
  }

  const audit = spawnSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const timestamp = now.toISOString();
  let summary = 'summary unavailable';

  if (audit.stdout) {
    try {
      const parsed = JSON.parse(audit.stdout);
      summary = formatSummary(parsed.metadata);
    } catch (error) {
      summary = `failed to parse audit output (${error.message})`;
    }
  }

  appendLog(`[${timestamp}] exitCode:${audit.status ?? 'null'} ${summary}`);

  if (audit.stdout) {
    appendLog(audit.stdout.trim());
  }

  if (audit.stderr) {
    appendLog(`# stderr\n${audit.stderr.trim()}`);
  }

  if (audit.status !== 0 && audit.status !== 1) {
    process.exitCode = audit.status || 1;
  }
}

main();
