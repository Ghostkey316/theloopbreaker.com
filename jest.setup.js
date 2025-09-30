const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
});

try {
  require('@sentry/react');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[jest setup] Optional dependency @sentry/react not found, skipping...');
}

jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  withScope: (fn) =>
    fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() }),
  captureMessage: jest.fn(),
  withProfiler: (Component) => Component,
}));

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  withScope: (fn) =>
    fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() }),
  captureMessage: jest.fn(),
}));
