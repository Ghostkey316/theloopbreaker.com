const { EventEmitter } = require('events');

class RedisPubSubStub {
  constructor({ namespace = 'telemetry' } = {}) {
    this.namespace = namespace;
    this.emitter = new EventEmitter();
  }

  channel(name) {
    return `${this.namespace}:${name}`;
  }

  async publish(channel, payload) {
    this.emitter.emit(channel, payload);
    return 1;
  }

  subscribe(channel, handler) {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  async quit() {
    this.emitter.removeAllListeners();
  }
}

module.exports = {
  RedisPubSubStub,
};
