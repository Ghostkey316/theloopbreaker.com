#!/usr/bin/env node
/**
 * Partner readiness analysis for Vaultfire pilot testing.
 * Status: pending audit until external review completes.
 */

const fs = require('fs');
const path = require('path');

const MODULE_TIERS_PATH = path.join(__dirname, 'module_tiers.json');
const TELEMETRY_ROOT = path.join(__dirname, '..', 'telemetry', 'pilot_mode');
const BEHAVIOR_LOG = path.join(TELEMETRY_ROOT, 'behavior_log.jsonl');
const YIELD_LOG = path.join(TELEMETRY_ROOT, 'yield_log.jsonl');
const BELIEF_SCORE_PATH = path.join(__dirname, '..', 'belief_score.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function readLines(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function loadModuleRoster(mode) {
  const tiers = readJson(MODULE_TIERS_PATH, { core: [], optional: [], advanced: [] });
  const normalized = (mode || '').toLowerCase();
  if (normalized === 'lite') {
    return tiers.core || [];
  }
  if (normalized === 'full_stack' || normalized === 'full stack' || normalized === 'full') {
    return [...(tiers.core || []), ...(tiers.optional || []), ...(tiers.advanced || [])];
  }
  throw new Error(`Unsupported mode: ${mode}`);
}

function extractRecords(file, partner) {
  const lines = readLines(file);
  const records = [];
  lines.forEach((line) => {
    try {
      const parsed = JSON.parse(line);
      if (!partner || parsed.partner_tag === partner) {
        records.push(parsed);
      }
    } catch (error) {
      // ignore malformed lines
    }
  });
  return records;
}

function resolveWalletScore(wallet) {
  if (!wallet) {
    return 0;
  }
  const beliefScores = readJson(BELIEF_SCORE_PATH, {});
  const identity = Object.keys(beliefScores).find((key) => key.toLowerCase() === wallet.toLowerCase());
  if (!identity) {
    return 12; // unknown wallets default to neutral trust anchor
  }
  const metrics = beliefScores[identity] || {};
  const interactions = Number(metrics.interactions || 0);
  const growth = Number(metrics.growth_events || 0);
  const flames = Number(metrics.flames || 0);
  return Math.min(30, interactions * 1.5 + growth * 2 + flames * 3);
}

function computeEngagementScore(yieldRecords) {
  if (!yieldRecords.length) {
    return 8;
  }
  let total = 0;
  yieldRecords.forEach((record) => {
    if (typeof record.engagement_score === 'number') {
      total += record.engagement_score * 20;
    } else if (record.metadata && typeof record.metadata.engagement_score === 'number') {
      total += record.metadata.engagement_score * 20;
    }
  });
  return Math.min(25, total / Math.max(yieldRecords.length, 1));
}

function analyzePartner({ partner, mode = 'lite', wallet, lawConfidence = 0.85 }) {
  const moduleRoster = loadModuleRoster(mode);
  const behaviorRecords = extractRecords(BEHAVIOR_LOG, partner);
  const yieldRecords = extractRecords(YIELD_LOG, partner);

  const baseScore = 40;
  const behaviorScore = Math.min(15, behaviorRecords.length * 1.8);
  const engagementScore = computeEngagementScore(yieldRecords);
  const walletScore = resolveWalletScore(wallet);
  const lawScore = Math.min(10, Math.max(0, lawConfidence * 10));
  const readinessScore = Math.min(100, Math.round(baseScore + behaviorScore + engagementScore + walletScore + lawScore));

  return {
    status: readinessScore >= 78 ? 'partner-ready' : 'needs-review',
    readinessScore,
    partner,
    mode,
    moduleRoster,
    metrics: {
      behaviorEvents: behaviorRecords.length,
      yieldEvents: yieldRecords.length,
      walletScore,
      engagementScore,
      lawScore,
    },
    pendingAudit: true,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const partnerIndex = args.indexOf('--partner');
  if (partnerIndex === -1) {
    console.error('Usage: node vaultfire/partner-readiness.js --partner <id> [--mode <lite|full_stack>] [--wallet <address>]');
    process.exit(1);
  }
  const partner = args[partnerIndex + 1];
  const modeIndex = args.indexOf('--mode');
  const walletIndex = args.indexOf('--wallet');
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : 'lite';
  const wallet = walletIndex !== -1 ? args[walletIndex + 1] : undefined;

  try {
    const readiness = analyzePartner({ partner, mode, wallet });
    console.log(JSON.stringify(readiness, null, 2));
  } catch (error) {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = { analyzePartner };
