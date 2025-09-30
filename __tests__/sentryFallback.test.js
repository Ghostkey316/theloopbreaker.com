'use strict';

describe('Sentry React fallback', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('provides a safe withProfiler wrapper when optional dependency is absent', () => {
    const { withProfiler } = require('@sentry/react');
    const TestComponent = () => 'ok';
    const Wrapped = withProfiler(TestComponent);
    expect(typeof Wrapped).toBe('function');
    expect(() => Wrapped({})).not.toThrow();
  });
});
