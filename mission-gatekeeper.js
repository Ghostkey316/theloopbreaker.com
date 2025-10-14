#!/usr/bin/env node
/**
 * Mission integrity shield gatekeeper.
 * Filters module access using Vaultfire Laws and wallet reputation.
 * Status: pending audit until external verification is complete.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIRECTORY = process.env.VAULTFIRE_GATEKEEPER_ROOT
  ? path.resolve(process.env.VAULTFIRE_GATEKEEPER_ROOT)
  : __dirname;

const MODULE_TIERS_PATH = process.env.VAULTFIRE_GATEKEEPER_MODULES
  ? path.resolve(process.env.VAULTFIRE_GATEKEEPER_MODULES)
  : path.join(ROOT_DIRECTORY, 'vaultfire', 'module_tiers.json');

const BELIEF_SCORE_PATH = process.env.VAULTFIRE_GATEKEEPER_BELIEF
  ? path.resolve(process.env.VAULTFIRE_GATEKEEPER_BELIEF)
  : path.join(ROOT_DIRECTORY, 'belief_score.json');

const overrides = {
  moduleTiers: null,
  beliefScores: null,
};

function setGatekeeperOverrides({ moduleTiers, beliefScores } = {}) {
  overrides.moduleTiers = moduleTiers ?? overrides.moduleTiers;
  overrides.beliefScores = beliefScores ?? overrides.beliefScores;
}

function resetGatekeeperOverrides() {
  overrides.moduleTiers = null;
  overrides.beliefScores = null;
}

const VAULTFIRE_LAWS = [
  'Law 1: Mission above ego.',
  'Law 2: Preserve belief and do no harm to aligned partners.',
  'Law 3: Consent is sacred and revocable.',
  'Law 4: Reward loops must reinforce ethics.',
  'Law 5: Data mirrors must stay reversible and transparent.',
  'Law 6: Trust beacons outrank growth hacks.',
  'Law 7: Guardians steward every flame.',
  'Law 8: Secrets unlock with proof-of-belief.',
  'Law 9: Relics require Council watch.',
  'Law 10: Advanced logic obeys the Architect signal.',
];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function normalizeProof(proof) {
  const normalized = {};
  if (!proof) {
    return normalized;
  }
  Object.entries(proof).forEach(([key, value]) => {
    const id = Number(key);
    if (!Number.isNaN(id) && id >= 1 && id <= 10) {
      normalized[id] = Boolean(value);
    }
  });
  return normalized;
}

function lawAlignmentScore(proof) {
  const normalized = normalizeProof(proof);
  let score = 0;
  for (let index = 1; index <= VAULTFIRE_LAWS.length; index += 1) {
    if (normalized[index]) {
      score += 1;
    }
  }
  return score;
}

function walletReputation(wallet) {
  if (!wallet) {
    return { trustScore: 0, source: 'unknown' };
  }
  const beliefScores = overrides.beliefScores || readJson(BELIEF_SCORE_PATH, {});
  const identity = Object.keys(beliefScores).find((key) => key.toLowerCase() === wallet.toLowerCase());
  if (!identity) {
    return { trustScore: 18, source: 'unlisted_wallet' };
  }
  const metrics = beliefScores[identity] || {};
  const trustScore = Math.min(60, Number(metrics.interactions || 0) * 1.4 + Number(metrics.growth_events || 0) * 2.5 + Number(metrics.flames || 0) * 4);
  return { trustScore, source: identity };
}

function loadModules() {
  const tiers = overrides.moduleTiers || readJson(MODULE_TIERS_PATH, { core: [], optional: [], advanced: [] });
  return {
    core: tiers.core || [],
    secrets: tiers.optional || [],
    relics: tiers.advanced ? tiers.advanced.slice(0, 4) : [],
    advanced: tiers.advanced || [],
  };
}

function progressiveUnlock({ trustScore, lawScore }) {
  const modules = loadModules();
  const access = { core: modules.core, secrets: [], relics: [], advanced: [] };
  if (lawScore >= 6 && trustScore >= 24) {
    access.secrets = modules.secrets;
  }
  if (lawScore >= 8 && trustScore >= 36) {
    access.relics = modules.relics;
  }
  if (lawScore >= 10 && trustScore >= 45) {
    access.advanced = modules.advanced;
  }
  return access;
}

function missionGatekeeper({ wallet, proofOfLaw, beliefProof }) {
  const lawScore = lawAlignmentScore(proofOfLaw);
  const { trustScore, source } = walletReputation(wallet || (beliefProof && beliefProof.wallet));
  const access = progressiveUnlock({ trustScore, lawScore });
  const approved = lawScore >= 6 && trustScore >= 24;
  return {
    wallet: wallet || null,
    proofSource: source,
    lawScore,
    trustScore,
    access,
    status: approved ? 'approved' : 'denied',
    pendingAudit: true,
    disclaimer: 'Mission gatekeeper outputs are pending external audit.',
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const walletIndex = args.indexOf('--wallet');
  const wallet = walletIndex !== -1 ? args[walletIndex + 1] : undefined;
  const proofIndex = args.indexOf('--proof');
  let proofOfLaw = {};
  if (proofIndex !== -1) {
    try {
      proofOfLaw = JSON.parse(args[proofIndex + 1]);
    } catch (error) {
      console.error('Invalid proof JSON.');
      process.exit(1);
    }
  }
  const decision = missionGatekeeper({ wallet, proofOfLaw });
  console.log(JSON.stringify(decision, null, 2));
}

if (require.main === module) {
  runCli();
}

module.exports = {
  missionGatekeeper,
  VAULTFIRE_LAWS,
  normalizeProof,
  lawAlignmentScore,
  walletReputation,
  progressiveUnlock,
  loadModules,
  setGatekeeperOverrides,
  resetGatekeeperOverrides,
};
