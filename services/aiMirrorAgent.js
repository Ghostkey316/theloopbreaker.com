const sentiment = require('sentiment');
const fetch = require('node-fetch');

class AIMirrorAgent {
  constructor({ telemetry, outputChannel = 'cli' } = {}) {
    this.sentiment = new sentiment();
    this.telemetry = telemetry;
    this.outputChannel = outputChannel;
  }

  parseWebhook(payload) {
    if (!payload) {
      throw new Error('Payload required');
    }
    const { walletId, beliefScore, signals = [], intents = [], ethics = [] } = payload;
    return {
      walletId,
      beliefScore,
      intents: intents.length ? intents : signals.map((signal) => signal.intent).filter(Boolean),
      ethicsFlags: ethics.length ? ethics : signals.flatMap((signal) => signal.ethics || []),
      narrative: payload.narrative || payload.summary || '',
      raw: payload,
    };
  }

  interpretBeliefSignal(parsed) {
    const tone = parsed.narrative ? this.sentiment.analyze(parsed.narrative) : { score: 0 };
    const scoreTrend = parsed.beliefScore >= 0.8 ? 'high' : parsed.beliefScore < 0.4 ? 'low' : 'moderate';
    const summary = {
      walletId: parsed.walletId,
      beliefScore: parsed.beliefScore,
      toneScore: tone.score,
      toneLabel: tone.score > 0 ? 'positive' : tone.score < 0 ? 'concern' : 'neutral',
      intents: parsed.intents,
      ethicsFlags: parsed.ethicsFlags,
      scoreTrend,
      recommendedAction:
        scoreTrend === 'low'
          ? 'Initiate trust stabilization cadence.'
          : scoreTrend === 'moderate'
          ? 'Continue monitoring live signal feed.'
          : 'Amplify aligned partner rewards.',
    };

    this.telemetry?.record('mirror.agent.summary', summary, {
      tags: ['mirror', 'ai'],
      visibility: { partner: true, ethics: true, audit: true },
    });

    return summary;
  }

  emitSummary(summary) {
    if (this.outputChannel === 'cli') {
      return summary;
    }
    if (this.outputChannel === 'slack' && process.env.VAULTFIRE_SLACK_WEBHOOK_URL) {
      return fetch(process.env.VAULTFIRE_SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: this.formatSlack(summary) }),
      });
    }
    return summary;
  }

  formatSlack(summary) {
    const header = `Vaultfire Mirror Update :: ${summary.walletId}`;
    const intents = summary.intents.length ? summary.intents.join(', ') : 'no intents flagged';
    const ethics = summary.ethicsFlags.length ? summary.ethicsFlags.join(', ') : 'clear';
    return [
      header,
      `Belief Score: ${(summary.beliefScore * 100).toFixed(1)}% (${summary.scoreTrend})`,
      `Tone: ${summary.toneLabel} (${summary.toneScore})`,
      `Intents: ${intents}`,
      `Ethics: ${ethics}`,
      `Action: ${summary.recommendedAction}`,
    ].join('\n');
  }
}

module.exports = AIMirrorAgent;
