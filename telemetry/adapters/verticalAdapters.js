const crypto = require('crypto');

function createBaseAdapter(vertical, defaults = {}) {
  const events = [];
  const config = {
    consentModel: defaults.consentModel || 'opt-in',
    rewardBase: defaults.rewardBase || 42,
    bridgeEndpoints: defaults.bridgeEndpoints || [],
    sandbox: defaults.sandbox !== false,
  };

  function ensureConsent(event) {
    if (event?.consent === true) {
      return true;
    }
    return config.consentModel === 'opt-in' ? Boolean(event?.consent) : true;
  }

  function projectReward(event) {
    const beliefMultiplier = Number(event?.beliefMultiplier || 1);
    const loyaltySignal = Number(event?.loyaltySignal || 1);
    const base = config.rewardBase;
    const projection = beliefMultiplier * loyaltySignal * base;
    return Math.round(projection * 100) / 100;
  }

  return {
    id: vertical,
    config,
    ingest(event = {}) {
      const timestamp = event.timestamp || new Date().toISOString();
      const walletId = event.walletId || event.identity || 'unknown';
      const consented = ensureConsent(event);
      const record = {
        id: crypto.createHash('sha1').update(`${vertical}:${walletId}:${timestamp}`).digest('hex'),
        vertical,
        timestamp,
        walletId,
        consented,
        telemetry: {
          signal: event.signal || 'activation',
          traits: event.traits || {},
        },
        rewardSimulation: {
          currency: '$GHOSTYIELD',
          projectedValue: projectReward(event),
          basis: {
            beliefMultiplier: Number(event?.beliefMultiplier || 1),
            loyaltySignal: Number(event?.loyaltySignal || 1),
          },
        },
        dataBridge: {
          liveAgnostic: true,
          endpoints: config.bridgeEndpoints,
          sandbox: config.sandbox,
        },
      };
      events.push(record);
      return record;
    },
    summary() {
      const consentedEvents = events.filter((event) => event.consented);
      return {
        totalEvents: events.length,
        consentedEvents: consentedEvents.length,
        consentRate: events.length ? consentedEvents.length / events.length : 0,
        lastEventAt: events.length ? events[events.length - 1].timestamp : null,
      };
    },
    recent(limit = 25) {
      return events.slice(-limit);
    },
  };
}

function sportsFandomAdapter(options = {}) {
  return createBaseAdapter('sports-fandom', {
    consentModel: 'opt-in',
    rewardBase: options.rewardBase || 58,
    bridgeEndpoints: options.bridgeEndpoints || ['https://api.vaultfire.sports/sandbox'],
    sandbox: options.sandbox !== false,
  });
}

function eduCredLinker(options = {}) {
  return createBaseAdapter('edu-cred-linker', {
    consentModel: options.consentModel || 'guardian-opt-in',
    rewardBase: options.rewardBase || 36,
    bridgeEndpoints: options.bridgeEndpoints || ['https://api.vaultfire.edu/sandbox'],
    sandbox: options.sandbox !== false,
  });
}

function fandomEconomyDriver(options = {}) {
  return createBaseAdapter('fandom-economy-driver', {
    consentModel: options.consentModel || 'opt-in',
    rewardBase: options.rewardBase || 49,
    bridgeEndpoints: options.bridgeEndpoints || ['https://api.vaultfire.fandom/sandbox'],
    sandbox: options.sandbox !== false,
  });
}

module.exports = {
  createBaseAdapter,
  sportsFandomAdapter,
  eduCredLinker,
  fandomEconomyDriver,
};

