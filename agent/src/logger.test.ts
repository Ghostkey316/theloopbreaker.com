/**
 * Tests for the Vaultfire Agent Logger
 */

import { Logger, setLogLevel, getLogLevel, LogLevel } from './logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    setLogLevel('debug');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should create a logger with a component name', () => {
    const logger = new Logger('TestComponent');
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain('[TestComponent]');
    expect(consoleSpy.mock.calls[0][0]).toContain('test message');
  });

  it('should include timestamp in log output', () => {
    const logger = new Logger('Test');
    logger.info('timestamp test');
    const output = consoleSpy.mock.calls[0][0];
    // ISO timestamp pattern
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should include level label in output', () => {
    const logger = new Logger('Test');

    logger.debug('debug msg');
    expect(consoleSpy.mock.calls[0][0]).toContain('[DEBUG]');

    logger.info('info msg');
    expect(consoleSpy.mock.calls[1][0]).toContain('[INFO]');

    logger.warn('warn msg');
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');

    logger.error('error msg');
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
  });

  it('should include context as JSON when provided', () => {
    const logger = new Logger('Test');
    logger.info('with context', { key: 'value', num: 42 });
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('"key":"value"');
    expect(output).toContain('"num":42');
  });

  it('should not include context JSON when no context provided', () => {
    const logger = new Logger('Test');
    logger.info('no context');
    const output = consoleSpy.mock.calls[0][0];
    // Should not end with a JSON object
    expect(output).not.toContain('{');
  });

  it('should respect log level filtering', () => {
    setLogLevel('warn');
    const logger = new Logger('Test');

    logger.debug('should not appear');
    logger.info('should not appear');
    logger.warn('should appear');
    logger.error('should appear');

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle setLogLevel with various inputs', () => {
    setLogLevel('debug');
    expect(getLogLevel()).toBe(LogLevel.DEBUG);

    setLogLevel('INFO');
    expect(getLogLevel()).toBe(LogLevel.INFO);

    setLogLevel('Error');
    expect(getLogLevel()).toBe(LogLevel.ERROR);

    // Invalid level should not change current level
    setLogLevel('invalid');
    expect(getLogLevel()).toBe(LogLevel.ERROR);
  });
});
