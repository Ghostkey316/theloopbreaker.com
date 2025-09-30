jest.mock('socket.io-client', () => {
  const ioMock = jest.fn();
  return { __esModule: true, io: ioMock };
});

describe('dashboard websocket utilities', () => {
  let ioMock;
  let socket;
  let subscribeToObservability;

  beforeEach(async () => {
    jest.resetModules();
    global.__VAULTFIRE_DASHBOARD_ENV__ = { VITE_VAULTFIRE_API: 'http://localhost:5050' };
    socket = {
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
    };
    ioMock = require('socket.io-client').io;
    ioMock.mockReset();
    ioMock.mockReturnValue(socket);
    ({ subscribeToObservability } = await import('../dashboard/src/services/api.js'));
  });

  test('registers listeners and disconnects when the last subscriber leaves', () => {
    const handlerA = jest.fn();
    const handlerB = jest.fn();

    const unsubscribeA = subscribeToObservability({ onUpdate: handlerA });
    const unsubscribeB = subscribeToObservability({ onUpdate: handlerB });

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socket.on).toHaveBeenCalledWith('observability:update', handlerA);
    expect(socket.on).toHaveBeenCalledWith('observability:update', handlerB);

    unsubscribeA();
    expect(socket.disconnect).not.toHaveBeenCalled();

    unsubscribeB();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  test('surfaces websocket errors via fallback logging when no handler provided', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const unsubscribe = subscribeToObservability();
    const errorCall = socket.on.mock.calls.find(([event]) => event === 'connect_error');
    expect(errorCall).toBeTruthy();
    const errorHandler = errorCall[1];

    errorHandler({ message: 'blocked' });

    expect(warnSpy).toHaveBeenCalledWith('Observability socket error', 'blocked');

    warnSpy.mockRestore();
    unsubscribe();
  });

  afterEach(() => {
    delete global.__VAULTFIRE_DASHBOARD_ENV__;
  });
});
