#!/usr/bin/env node
// Vaultfire Live Pilot Mission Logger (Staging / Simulated / Pre-Production Only)

'use strict';

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { ethers } = require('ethers');
const { getDefaultIdentityResolver } = require('../lib/identityResolverRuntime');

const TELEMETRY_PATH = path.join(__dirname, 'telemetry-log.json');
const DEFAULT_RPC_URL = process.env.VAULTFIRE_PILOT_RPC_URL || process.env.VAULTFIRE_ENS_RPC_URL || 'https://rpc.ankr.com/eth_sepolia';

function loadTelemetry() {
  if (!fs.existsSync(TELEMETRY_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(TELEMETRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[live-pilot] failed to parse telemetry log, starting new file', error.message);
    return [];
  }
}

function saveTelemetry(entries) {
  fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(entries, null, 2));
}

async function resolveWallet(resolver, identifier) {
  const resolved = await resolver.resolve(identifier);
  if (resolved) {
    return resolved;
  }
  if (identifier.startsWith('0x') && identifier.length === 42) {
    return identifier;
  }
  throw new Error(`Unable to resolve wallet identifier: ${identifier}`);
}

async function fetchWalletActivity(provider, address) {
  try {
    const [balance, txCount] = await Promise.all([
      provider.getBalance(address),
      provider.getTransactionCount(address),
    ]);
    return {
      balance: Number(ethers.formatEther(balance)),
      transactionCount: txCount,
    };
  } catch (error) {
    return {
      balance: null,
      transactionCount: 0,
      error: error.message,
    };
  }
}

function computeXp({ baseXp, activityCount, retentionCount }) {
  const sanitizedBase = Number.isFinite(baseXp) ? Number(baseXp) : 10;
  const activityBonus = Math.min(activityCount || 0, 5);
  const retentionBonus = Math.min(retentionCount || 0, 10);
  const total = sanitizedBase + activityBonus + retentionBonus;
  return {
    total,
    breakdown: {
      base: sanitizedBase,
      activityBonus,
      retentionBonus,
    },
  };
}

async function main(argv) {
  const program = new Command();
  program
    .name('vaultfire-live-pilot')
    .description('Record belief missions during the Vaultfire live pilot (staging only).')
    .requiredOption('-w, --wallet <identifier>', 'Wallet identifier (ENS, CB.ID, or address)')
    .requiredOption('-m, --mission <missionId>', 'Mission identifier string')
    .option('-x, --xp <points>', 'Base XP to award', (value) => Number.parseFloat(value), 15)
    .option('-n, --note <note>', 'Optional mission note for local transparency log')
    .option('-r, --retention <count>', 'Retention streak count', (value) => Number.parseInt(value, 10), 0)
    .option('--dry-run', 'Preview the log entry without writing to disk', false)
    .parse(argv);

  const options = program.opts();
  const resolver = getDefaultIdentityResolver({ logger: console });
  const provider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);

  const address = await resolveWallet(resolver, options.wallet);
  const activity = await fetchWalletActivity(provider, address);
  const xp = computeXp({ baseXp: options.xp, activityCount: activity.transactionCount, retentionCount: options.retention });

  const entry = {
    wallet: address,
    missionId: options.mission,
    timestamp: new Date().toISOString(),
    xpEarned: xp.total,
    xpBreakdown: xp.breakdown,
    walletActivity: activity,
    note: options.note || null,
    source: 'Staging / Simulated / Pre-Production Only',
  };

  if (options.dryRun) {
    // eslint-disable-next-line no-console
    console.log('[live-pilot] dry run entry', entry);
    return;
  }

  const telemetry = loadTelemetry();
  telemetry.push(entry);
  saveTelemetry(telemetry);

  // eslint-disable-next-line no-console
  console.log('[live-pilot] mission recorded', {
    wallet: entry.wallet,
    missionId: entry.missionId,
    xpEarned: entry.xpEarned,
    transactionsObserved: activity.transactionCount,
    balance: activity.balance,
  });
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[live-pilot] mission logging failed', error);
    process.exitCode = 1;
  });
}
