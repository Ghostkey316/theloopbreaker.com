const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
});

let hasSentryReact = false;
try {
  require.resolve('@sentry/react');
  hasSentryReact = true;
} catch (error) {
  // eslint-disable-next-line no-console
  console.warn('[jest setup] Optional dependency @sentry/react not found, using fallback mock.');
}

if (hasSentryReact) {
  jest.mock('@sentry/react', () => {
    const actual = jest.requireActual('@sentry/react');
    return {
      ...actual,
      init: actual.init || jest.fn(),
      withScope:
        actual.withScope ||
        ((fn) => fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() })),
      captureMessage: actual.captureMessage || jest.fn(),
      withProfiler: actual.withProfiler || ((Component) => Component),
    };
  });
} else {
  jest.mock(
    '@sentry/react',
    () => ({
      withProfiler: (Component) => Component,
    }),
    { virtual: true }
  );
}

let hasSentryNode = true;
try {
  require.resolve('@sentry/node');
} catch (error) {
  hasSentryNode = false;
  // eslint-disable-next-line no-console
  console.warn('[jest setup] Optional dependency @sentry/node not found, using noop mock.');
}

if (hasSentryNode) {
  jest.mock('@sentry/node', () => {
    const actual = jest.requireActual('@sentry/node');
    return {
      ...actual,
      init: actual.init || jest.fn(),
      withScope:
        actual.withScope ||
        ((fn) => fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() })),
      captureMessage: actual.captureMessage || jest.fn(),
    };
  });
} else {
  jest.mock(
    '@sentry/node',
    () => ({
      init: jest.fn(),
      withScope: (fn) => fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() }),
      captureMessage: jest.fn(),
    }),
    { virtual: true }
  );
}
