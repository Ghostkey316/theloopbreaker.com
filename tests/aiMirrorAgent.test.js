const fetch = require('node-fetch');
const AIMirrorAgent = require('../services/aiMirrorAgent');

jest.mock('node-fetch');

describe('AI Mirror Agent', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('parses and summarizes webhook payloads', () => {
    const agent = new AIMirrorAgent();
    const parsed = agent.parseWebhook({
      walletId: '0xabc',
      beliefScore: 0.75,
      signals: [{ intent: 'align', ethics: ['consent:verified'] }],
      narrative: 'Alignment confirmed.',
    });
    expect(parsed.intents).toContain('align');

    const summary = agent.interpretBeliefSignal(parsed);
    expect(summary.recommendedAction).toBeDefined();
    expect(summary.scoreTrend).toBe('moderate');
  });

  it('sends Slack notifications when configured', async () => {
    fetch.mockResolvedValue({ ok: true });
    const agent = new AIMirrorAgent({ outputChannel: 'slack' });
    process.env.VAULTFIRE_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/mock';
    const summary = {
      walletId: '0xabc',
      beliefScore: 0.9,
      toneScore: 2,
      toneLabel: 'positive',
      intents: ['align'],
      ethicsFlags: [],
      scoreTrend: 'high',
      recommendedAction: 'Amplify aligned partner rewards.',
    };
    await agent.emitSummary(summary);
    expect(fetch).toHaveBeenCalled();
    delete process.env.VAULTFIRE_SLACK_WEBHOOK_URL;
  });
});
