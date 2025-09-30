const SignalRouter = require('./signalRouter');
const DeliveryService = require('./services/deliveryService');
const { createTrustValidator } = require('./trustValidator');

class BeliefSyncService {
  constructor({
    router = null,
    deliveryService = null,
    trust = {},
    logger = console,
  } = {}) {
    this.logger = logger || console;
    this.router =
      router && typeof router.route === 'function'
        ? router
        : new SignalRouter({ logger: this.logger });
    this.deliveryService =
      deliveryService && typeof deliveryService.deliver === 'function'
        ? deliveryService
        : new DeliveryService({ logger: this.logger });
    this.trustValidator =
      trust && typeof trust.validate === 'function' ? trust : createTrustValidator(trust || {});
  }

  async validateEnvelope(envelope = {}) {
    const { origin, address, sessionToken, session, signature, payload } = envelope;
    return this.trustValidator.validate({
      origin,
      address,
      session: sessionToken ?? session,
      signature,
      payload,
    });
  }

  async sync(envelope = {}) {
    const trustContext = await this.validateEnvelope(envelope);
    const { route = null, delivery = null, payload = {} } = envelope;

    let routeResult = null;
    if (route) {
      routeResult = await this.router.route(
        {
          id: route.id || payload.id || 'belief-sync',
          target: route.target,
          payload,
        },
        { softFailDelayMs: route.softFailDelayMs },
      );
    }

    let deliveryResult = null;
    if (delivery) {
      deliveryResult = await this.deliveryService.deliver(
        {
          url: delivery.url,
          payload,
          headers: delivery.headers || {},
        },
        { softFailDelayMs: delivery.softFailDelayMs },
      );
    }

    return {
      trust: trustContext,
      routeResult,
      deliveryResult,
    };
  }

  inspectSoftFails() {
    return {
      router: this.router.inspectSoftFails(),
      delivery: this.deliveryService.drainSoftFailQueue(),
    };
  }
}

module.exports = BeliefSyncService;
