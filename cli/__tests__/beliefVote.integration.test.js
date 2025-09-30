const fs = require('fs');
const os = require('os');
const path = require('path');
const { Wallet } = require('ethers');

const { castBeliefVote } = require('../beliefVote');

describe('belief vote CLI integration', () => {
  it('records votes and telemetry with consent', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-vote-'));
    const proposalsPath = path.join(tmpDir, 'proposals.json');
    const votesPath = path.join(tmpDir, 'votes.json');
    const telemetryPath = path.join(tmpDir, 'mirror-log.json');
    const telemetryStore = path.join(tmpDir, 'telemetry-consent.json');

    fs.writeFileSync(
      proposalsPath,
      JSON.stringify([
        {
          id: 'proposal-1',
          choices: { a: 'Accelerate alignment', b: 'Hold steady', c: 'Re-evaluate' },
        },
      ])
    );
    fs.writeFileSync(votesPath, JSON.stringify([], null, 2));

    const wallet = Wallet.fromPhrase('test test test test test test test test test test test junk');
    const message = `Vaultfire belief sync handshake :: wallet=${wallet.address.toLowerCase()} :: nonce=1234567890`;
    const signature = await wallet.signMessage(message);

    const result = await castBeliefVote(
      {
        proposal: 'proposal-1',
        choice: 'a',
        wallet: wallet.address,
        signature,
        message,
      },
      {
        proposalsPath,
        votesPath,
        telemetryPath,
        telemetry: {
          optIn: true,
          storePath: telemetryStore,
          dsn: null,
          environment: 'test',
        },
      }
    );

    const storedVotes = JSON.parse(fs.readFileSync(votesPath, 'utf8'));
    expect(storedVotes).toHaveLength(1);
    expect(storedVotes[0].wallet).toBe(result.vote.wallet);

    expect(result.vote).toMatchSnapshot();

    const consentStore = JSON.parse(fs.readFileSync(telemetryStore, 'utf8'));
    const normalizedWallet = result.vote.wallet.toLowerCase();
    expect(consentStore[normalizedWallet].enabled).toBe(true);
    jest.useRealTimers();
  });
});
