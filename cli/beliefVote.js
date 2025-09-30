const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { keccak256, toUtf8Bytes } = require('ethers');
const { BeliefMirrorEngine } = require('../mirror/engine');
const { determineTier } = require('../mirror/belief-weight');
const { verifyWalletSignature, normalizeWallet } = require('../utils/walletAuth');
const { VoteRepository } = require('../services/voteRepository');
const { assertWalletOnlyData } = require('../utils/identityGuards');
const { validateMetrics } = require('../utils/scoringValidator');
const telemetry = require('../telemetry/nodeTelemetry');

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${path.basename(filePath)}: ${error.message}`);
  }
}

function loadProposals(proposalsPath = path.join(__dirname, '..', 'proposals.json')) {
  return readJson(proposalsPath, []);
}

async function castBeliefVote(
  { proposal: proposalId, choice, wallet, ens, signature, message },
  {
    proposalsPath = path.join(__dirname, '..', 'proposals.json'),
    votesPath = path.join(__dirname, '..', 'votes.json'),
    telemetryPath,
    telemetry: telemetryOptions = {},
  } = {}
) {
  telemetry.initTelemetry(telemetryOptions);
  if (!proposalId) {
    throw new Error('Proposal identifier is required');
  }

  const choiceKey = (choice || '').trim().toLowerCase();
  if (!['a', 'b', 'c'].includes(choiceKey)) {
    throw new Error('Choice must be one of a, b, or c');
  }

  const proposals = loadProposals(proposalsPath);
  const proposal = proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  if (!proposal.choices || !proposal.choices[choiceKey]) {
    throw new Error(`Choice ${choiceKey} is not available for proposal ${proposalId}`);
  }

  const verified = verifyWalletSignature({ wallet, signature, message, ens });
  const normalizedWallet = normalizeWallet(verified.wallet);
  if (typeof telemetryOptions.optIn === 'boolean') {
    telemetry.updateConsent(normalizedWallet, telemetryOptions.optIn);
  }
  const voteRepository = new VoteRepository({ filePath: votesPath });
  const votes = await voteRepository.loadVotes();
  const previousVotes = votes.filter((voteRecord) => voteRecord.wallet === normalizedWallet).length;

  const mirrorEngine = new BeliefMirrorEngine({ telemetryPath });
  const metrics = validateMetrics({
    loyalty: Math.min(68 + previousVotes * 6, 100),
    ethics: Math.min(88 + previousVotes * 2, 100),
    frequency: Math.min(60 + previousVotes * 5, 100),
    alignment: 80,
    holdDuration: Math.min(55 + previousVotes * 3, 95),
  });

  const action = {
    wallet: normalizedWallet,
    ens: verified.ens,
    type: 'vote',
    origin: 'belief-vote-cli',
    metrics,
  };

  const entry = await mirrorEngine.processAction(action);
  const messageDigest = keccak256(toUtf8Bytes(verified.message));

  const voteRecord = {
    proposalId,
    choice: choiceKey,
    wallet: normalizedWallet,
    ens: verified.ens,
    weight: entry.multiplier,
    tier: determineTier(entry.multiplier),
    timestamp: entry.timestamp,
    messageDigest,
  };

  assertWalletOnlyData(voteRecord, { context: 'vote' });
  await voteRepository.appendVote(voteRecord);

  telemetry.recordBeliefVote({
    wallet: normalizedWallet,
    proposalId,
    choice: choiceKey,
    tier: voteRecord.tier,
    multiplier: entry.multiplier,
  });

  return {
    proposal,
    vote: voteRecord,
    entry,
  };
}

function registerBeliefVoteCommand(program, options = {}) {
  const command =
    program instanceof Command ? program : new Command('vote');

  command
    .command('vote')
    .description('Cast a belief-weighted vote on a Vaultfire proposal')
    .requiredOption('--proposal <id>', 'Proposal identifier')
    .requiredOption('--choice <choice>', 'Vote choice (a, b, or c)')
    .requiredOption('--wallet <address>', 'Wallet identity for the vote')
    .requiredOption('--signature <signature>', 'Wallet signature confirming the vote')
    .requiredOption('--message <message>', 'Signed message anchoring the vote')
    .option('--ens <alias>', 'Optional ENS alias for the wallet')
    .option('--telemetry-consent <on|off>', 'Opt-in or opt-out of telemetry logging for this wallet')
    .action(async (cmdOptions) => {
      try {
        const telemetryConsent = typeof cmdOptions.telemetryConsent === 'string'
          ? cmdOptions.telemetryConsent.toLowerCase()
          : undefined;
        const telemetryOptIn =
          telemetryConsent === 'on' ? true : telemetryConsent === 'off' ? false : undefined;
        const result = await castBeliefVote(cmdOptions, {
          ...options,
          telemetry: {
            ...options.telemetry,
            optIn: telemetryOptIn,
          },
        });
        console.log('Belief-weighted vote recorded');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`Vote failed: ${error.message}`);
        process.exitCode = 1;
      }
    });

  return command;
}

module.exports = {
  registerBeliefVoteCommand,
  castBeliefVote,
  loadProposals,
};
