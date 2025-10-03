class BeliefInterpreterModule {
  constructor({ telemetry, terminology } = {}) {
    this.telemetry = telemetry;
    this.terminology = {
      'soul-linkers': 'Verified contributor cohorts',
      multipliers: 'Governance-approved reward boosts',
      'belief-signal': 'Alignment confidence indicator',
      'belief-score': 'Alignment score (0-1)',
      ...terminology,
    };
  }

  translateTerm(term) {
    return this.terminology[term] || term;
  }

  interpret(entry) {
    if (!entry) {
      return null;
    }
    const confidence = entry.beliefScore >= 0.75 ? 'high' : entry.beliefScore >= 0.5 ? 'moderate' : 'low';
    const summary = {
      wallet: entry.walletId,
      beliefScore: entry.beliefScore,
      confidence,
      intents: entry.intents || [],
      ethicsFlags: entry.ethicsFlags || [],
      translated: (entry.intents || []).map((intent) => ({ intent, enterpriseTag: this.translateTerm(intent) })),
    };
    this.telemetry?.record(
      'interpreter.summary.created',
      { walletId: entry.walletId, confidence },
      {
        tags: ['interpreter'],
        visibility: { partner: true, ethics: true, audit: true },
      }
    );
    return summary;
  }

  explainTrustMap(map) {
    const nodes = Object.entries(map.nodes || {}).map(([walletId, node]) => ({
      walletId,
      weight: node.weight,
      confidence: node.confidence,
      dominantIntent: node.dominantIntent,
      enterpriseIntent: this.translateTerm(node.dominantIntent),
    }));
    return {
      updatedAt: map.generatedAt,
      nodes,
    };
  }
}

module.exports = BeliefInterpreterModule;
