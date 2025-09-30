const EventEmitter = require('events');
const WebhookDeliveryQueue = require('./deliveryQueue');

const EVENTS = {
  ACTIVATION: 'activation',
  BELIEF_BREACH: 'beliefBreach',
  REWARD_EARNED: 'rewardEarned',
};

class PartnerHookRegistry extends EventEmitter {
  constructor({ telemetry, deliveryQueue, metrics } = {}) {
    super();
    this.telemetry = telemetry;
    this.subscriptions = new Map();
    this.deliveryQueue = deliveryQueue || new WebhookDeliveryQueue({ telemetry, metrics });
    this.metrics = metrics || null;
  }

  subscribe({ partnerId, event, targetUrl, metadata = {} }) {
    if (!Object.values(EVENTS).includes(event)) {
      throw new Error(`Unsupported hook event: ${event}`);
    }
    const signingSecret = metadata.signingSecret || metadata.signing_secret || metadata.webhookSecret;
    const entry = {
      partnerId,
      event,
      targetUrl,
      metadata,
      subscribedAt: new Date().toISOString(),
      signingSecret: signingSecret || null,
    };
    const existing = this.subscriptions.get(event) || [];
    existing.push(entry);
    this.subscriptions.set(event, existing);
    this.telemetry?.record('partner.hook.subscribed', entry, {
      tags: ['partner', 'hooks'],
      visibility: { partner: true, ethics: false, audit: true },
    });
    return entry;
  }

  async notify(event, payload) {
    const subscriptions = this.subscriptions.get(event) || [];
    if (!subscriptions.length) {
      return [];
    }

    const deliveries = await Promise.all(
      subscriptions.map((subscription) =>
        this.deliveryQueue
          .enqueue({
            event,
            payload,
            partnerId: subscription.partnerId,
            targetUrl: subscription.targetUrl,
            signingSecret: subscription.signingSecret,
            metadata: subscription.metadata,
          })
          .then((result) => {
            const entry = {
              partnerId: result.partnerId,
              event: result.event,
              targetUrl: result.targetUrl,
              status: result.status,
              payload: result.payload,
              attempts: result.attempts,
              deliveryId: result.deliveryId,
              deliveredAt: result.completedAt,
              lastError: result.lastError,
            };
            this.telemetry?.record('partner.hook.delivery', entry, {
              tags: ['partner', 'hooks'],
              visibility: { partner: true, ethics: true, audit: true },
            });
            this.emit(`delivery:${event}`, entry);
            return entry;
          })
      )
    );
    return deliveries;
  }

  onActivation(payload) {
    return this.notify(EVENTS.ACTIVATION, payload);
  }

  onBeliefBreach(payload) {
    return this.notify(EVENTS.BELIEF_BREACH, payload);
  }

  onRewardEarned(payload) {
    return this.notify(EVENTS.REWARD_EARNED, payload);
  }

  listSubscriptions() {
    const result = [];
    for (const [event, entries] of this.subscriptions.entries()) {
      entries.forEach((entry) => result.push({ ...entry }));
    }
    return result;
  }
}

PartnerHookRegistry.EVENTS = EVENTS;

module.exports = PartnerHookRegistry;
