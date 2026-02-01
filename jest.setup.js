const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

function shouldWarnOptionalDeps() {
  // Keep test output clean by default; opt-in when debugging.
  return String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === '1'
    || String(process.env.VAULTFIRE_TEST_WARN_OPTIONAL_DEPS || '').toLowerCase() === 'true';
}

function warnOptional(message) {
  if (!shouldWarnOptionalDeps()) return;
  // eslint-disable-next-line no-console
  console.warn(message);
}

function isTestQuietMode() {
  return String(process.env.VAULTFIRE_TEST_QUIET || '').toLowerCase() === '1'
    || String(process.env.VAULTFIRE_TEST_QUIET || '').toLowerCase() === 'true';
}

if (process.env.NODE_ENV === 'test' && isTestQuietMode()) {
  // Keep CI/test output clean by default. We still allow console.error so genuine failures remain visible.
  // (If you need full output, unset VAULTFIRE_TEST_QUIET or set VAULTFIRE_TEST_WARN_OPTIONAL_DEPS=1.)
  // eslint-disable-next-line no-console
  console.log = () => {};
  // eslint-disable-next-line no-console
  console.info = () => {};
  // eslint-disable-next-line no-console
  console.warn = () => {};
  // eslint-disable-next-line no-console
  console.debug = () => {};
}

beforeEach(() => {
  fetchMock.resetMocks();
});

let hasSentryReact = false;
try {
  require.resolve('@sentry/react');
  hasSentryReact = true;
} catch (error) {
  warnOptional('[jest setup] Optional dependency @sentry/react not found, using fallback mock.');
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
  warnOptional('[jest setup] Optional dependency @sentry/node not found, using noop mock.');
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

let hasHelmet = true;
try {
  require.resolve('helmet');
} catch (error) {
  hasHelmet = false;
  warnOptional('[jest setup] Optional dependency helmet not found, using noop mock.');
}

if (!hasHelmet) {
  jest.mock(
    'helmet',
    () => () => (req, res, next) => {
      if (typeof next === 'function') {
        next();
      }
    },
    { virtual: true }
  );
}
