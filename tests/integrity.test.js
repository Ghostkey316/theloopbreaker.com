const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { ethers } = require('ethers');
const { createPartnerSyncServer } = require('../partnerSync');
const { BeliefMirrorEngine } = require('../mirror/engine');
const { computeBeliefMultiplier } = require('../mirror/belief-weight');
const { castBeliefVote } = require('../cli/beliefVote');

const tmpDir = path.join(__dirname, 'tmp');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const integrityResults = [];

function recordResult(name, passed, details) {
  integrityResults.push({ name, passed, details: details || null });
}

function defineIntegrityTest(name, fn) {
  test(name, async () => {
    try {
      await fn();
      recordResult(name, true);
    } catch (error) {
      recordResult(name, false, error.message);
      throw error;
    }
  });
}

afterAll(() => {
  const reportPath = path.join(__dirname, '..', 'codex-integrity.json');
  const passed = integrityResults.filter((item) => item.passed).length;
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: integrityResults.length,
      passed,
      failed: integrityResults.length - passed,
    },
    tests: integrityResults,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
});

defineIntegrityTest('No email/digital ID fallback exists', () => {
  const filesToCheck = [
    path.join(__dirname, '..', 'partnerSync.js'),
    path.join(__dirname, '..', 'cli', 'beliefVote.js'),
    path.join(__dirname, '..', 'dashboard', 'src', 'App.jsx'),
    path.join(__dirname, '..', 'dashboard', 'src', 'context', 'AuthContext.jsx'),
    path.join(__dirname, '..', 'dashboard', 'src', 'services', 'api.js'),
  ];

  const disallowed = /(email|digital\s*id)/i;
  filesToCheck.forEach((filePath) => {
    const contents = fs.readFileSync(filePath, 'utf8');
    if (disallowed.test(contents)) {
      throw new Error(`Found prohibited identifier fallback in ${path.basename(filePath)}`);
    }
  });
});

defineIntegrityTest('Belief mirror logs correct multipliers', async () => {
  const telemetryPath = path.join(tmpDir, 'belief-log.json');
  const engine = new BeliefMirrorEngine({ telemetryPath });
  const action = {
    wallet: '0x0000000000000000000000000000000000000001',
    ens: null,
    type: 'quiz',
    metrics: {
      loyalty: 80,
      ethics: 90,
      frequency: 70,
      alignment: 65,
      holdDuration: 40,
    },
  };

  const expected = computeBeliefMultiplier(action.type, action.metrics);
  const expectedMultiplier = expected.multiplier;
  const [entry] = await engine.run([action]);
  const log = JSON.parse(fs.readFileSync(telemetryPath, 'utf8'));

  if (Math.abs(entry.multiplier - expectedMultiplier) > 0.0001) {
    throw new Error('Computed multiplier does not match belief weight rules');
  }
  if (!log.length || log[0].multiplier !== entry.multiplier) {
    throw new Error('Belief log missing expected entry');
  }
});

defineIntegrityTest('CLI vote flow integrity', async () => {
  const proposalsPath = path.join(tmpDir, 'proposals.json');
  const votesPath = path.join(tmpDir, 'votes.json');
  const telemetryPath = path.join(tmpDir, 'votes-telemetry.json');

  const proposal = {
    id: 'prop-1',
    title: 'Integrity Check',
    choices: { a: 'Advance', b: 'Hold', c: 'Recalibrate' },
  };

  fs.writeFileSync(proposalsPath, JSON.stringify([proposal], null, 2));

  const wallet = ethers.Wallet.createRandom();
  const message = `Vaultfire belief vote :: wallet=${wallet.address.toLowerCase()} :: proposal=prop-1 :: nonce=${Date.now()}`;
  const signature = await wallet.signMessage(message);

  const { vote } = await castBeliefVote(
    {
      proposal: 'prop-1',
      choice: 'a',
      wallet: wallet.address,
      signature,
      message,
    },
    {
      proposalsPath,
      votesPath,
      telemetryPath,
    }
  );

  const storedVotes = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
  if (storedVotes.length !== 1) {
    throw new Error('Vote record not persisted');
  }
  if (Math.abs(storedVotes[0].weight - vote.weight) > 0.0001) {
    throw new Error('Belief weight mismatch in stored vote');
  }
});

defineIntegrityTest('Dashboard data reflects correct backend truth', async () => {
  const telemetryPath = path.join(tmpDir, 'sync-belief-log.json');
  const votesPath = path.join(tmpDir, 'sync-votes.json');
  fs.writeFileSync(votesPath, JSON.stringify([], null, 2));

  const server = createPartnerSyncServer({ telemetryPath, votesPath });
  const agent = request(server.app);

  const wallet = ethers.Wallet.createRandom();
  const message = `Vaultfire belief sync handshake :: wallet=${wallet.address.toLowerCase()} :: nonce=${Date.now()}`;
  const signature = await wallet.signMessage(message);
  const payload = {
    loyalty: 88,
    ethics: 92,
    interactionFrequency: 75,
    partnerAlignment: 83,
    holdDuration: 61,
  };

  const syncResponse = await agent
    .post('/vaultfire/sync-belief')
    .send({ wallet: wallet.address, message, signature, payload });

  if (syncResponse.status !== 200) {
    throw new Error(`Sync request failed with status ${syncResponse.status}`);
  }

  const statusResponse = await agent.get('/vaultfire/sync-status');
  const { partners, summary } = statusResponse.body;
  if (!partners || partners.length !== 1) {
    throw new Error('Partner sync not reflected in status endpoint');
  }
  const partner = partners[0];
  if (partner.wallet !== wallet.address) {
    throw new Error('Wallet identity mismatch in sync status');
  }
  if (Math.abs(summary.beliefScore - partner.multiplier) > 0.0001) {
    throw new Error('Dashboard summary belief score mismatch');
  }
});
