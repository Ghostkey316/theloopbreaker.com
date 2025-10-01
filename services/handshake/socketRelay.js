class SocketRelay {
  constructor({ io, telemetry } = {}) {
    this.io = io;
    this.telemetry = telemetry || null;
    this.connectionCount = 0;
  }

  register({ jwtAuthority, apiKeyGate } = {}) {
    if (!this.io) {
      throw new Error('SocketRelay requires an io instance');
    }
    if (this._registered) {
      return;
    }
    this._registered = true;
    this.io.use((socket, next) => {
      const token = socket.handshake?.auth?.token;
      if (token && jwtAuthority) {
        const result = jwtAuthority.verify(token, { tags: ['socket'] });
        if (!result.valid) {
          return next(new Error('Invalid socket token'));
        }
        socket.handshake.user = result.payload;
        return next();
      }
      if (apiKeyGate) {
        const result = apiKeyGate.verify({ headers: socket.handshake?.headers || {} });
        if (result.valid) {
          socket.handshake.user = { apiKey: result.key };
          return next();
        }
      }
      return next(new Error('Unauthorized socket handshake'));
    });

    this.io.on('connection', (socket) => {
      this.connectionCount += 1;
      this.telemetry?.record('handshake.socket.connected', { connectionCount: this.connectionCount }, {
        tags: ['handshake', 'socket'],
        visibility: { partner: true, ethics: true, audit: true },
      });
      socket.on('disconnect', () => {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        this.telemetry?.record('handshake.socket.disconnected', { connectionCount: this.connectionCount }, {
          tags: ['handshake', 'socket'],
          visibility: { partner: false, ethics: true, audit: true },
        });
      });
    });
    // SIEM exports can subscribe to the handshake.socket.* telemetry stream or attach an io middleware for custom audit sinks.
  }

  emit(event, payload) {
    this.io?.emit(event, payload);
  }

  close() {
    if (this.io) {
      this.io.removeAllListeners();
    }
  }
}

module.exports = SocketRelay;
