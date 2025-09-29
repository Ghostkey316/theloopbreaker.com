const EventEmitter = require('events');
const fetch = require('node-fetch');

const EVENTS = {
  ACTIVATION: 'activation',
  BELIEF_BREACH: 'beliefBreach',
  REWARD_EARNED: 'rewardEarned',
};

class PartnerHookRegistry extends EventEmitter {
  constructor({ telemetry } = {}) {
    super();
    this.telemetry = telemetry;
    this.subscriptions = new Map();
  }

  subscribe({ partnerId, event, targetUrl, metadata = {} }) {
    if (!Object.values(EVENTS).includes(event)) {
      throw new Error(`Unsupported hook event: ${event}`);
    }
    const entry = {
      partnerId,
      event,
      targetUrl,
      metadata,
      subscribedAt: new Date().toISOString(),
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
    const deliveries = await Promise.all(
      subscriptions.map(async (subscription) => {
        const { targetUrl, partnerId } = subscription;
        let status = 'queued';
        try {
          if (targetUrl) {
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event, payload, partnerId }),
            });
            status = response.ok ? 'delivered' : `error:${response.status}`;
          } else {
            status = 'skipped';
          }
        } catch (error) {
          status = `failed:${error.message}`;
        }
        const entry = {
          partnerId,
          event,
          targetUrl,
          status,
          payload,
          deliveredAt: new Date().toISOString(),
        };
        this.telemetry?.record('partner.hook.delivery', entry, {
          tags: ['partner', 'hooks'],
          visibility: { partner: true, ethics: true, audit: true },
        });
        this.emit(`delivery:${event}`, entry);
        return entry;
      })
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
