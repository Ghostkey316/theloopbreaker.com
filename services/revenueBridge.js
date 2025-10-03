class PartnerRevenueBridge {
  constructor({ telemetry, providers = [] } = {}) {
    this.telemetry = telemetry;
    this.providers = providers.length
      ? providers
      : [
          {
            id: 'superfluid-sim',
            description: 'Mock USDC stream through Superfluid sandbox.',
            multiplier: 1.05,
          },
          {
            id: 'stripe-crypto-sim',
            description: 'Stripe crypto rails sandbox payout.',
            multiplier: 1.02,
          },
        ];
  }

  preview({ walletId, baseMultiplier = 1 }) {
    const preview = this.providers.map((provider) => ({
      provider: provider.id,
      description: provider.description,
      projectedMultiplier: Number((baseMultiplier * provider.multiplier).toFixed(4)),
      sandbox: provider.sandbox !== false,
    }));
    this.telemetry?.record(
      'revenue.bridge.preview',
      { walletId, providers: preview },
      {
        tags: ['rewards', 'revenue'],
        visibility: { partner: true, ethics: false, audit: true },
      }
    );
    return preview;
  }
}

module.exports = PartnerRevenueBridge;
