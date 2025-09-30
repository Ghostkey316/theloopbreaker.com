const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
});

jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  withScope: (fn) =>
    fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() }),
  captureMessage: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  withScope: (fn) =>
    fn({ setUser: jest.fn(), setTag: jest.fn(), setContext: jest.fn(), setFingerprint: jest.fn() }),
  captureMessage: jest.fn(),
}));
