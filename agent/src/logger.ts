/**
 * Vaultfire Agent — Structured Logger
 *
 * Provides timestamped, leveled logging with structured context fields.
 * All output goes to stdout/stderr for easy integration with log aggregators.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

let currentLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: string): void {
  const map: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };
  const parsed = map[level.toLowerCase()];
  if (parsed !== undefined) {
    currentLevel = parsed;
  }
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

interface LogContext {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, component: string, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const label = LEVEL_LABELS[level];
  const base = `[${timestamp}] [${label}] [${component}] ${message}`;
  if (ctx && Object.keys(ctx).length > 0) {
    return `${base} ${JSON.stringify(ctx)}`;
  }
  return base;
}

export class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  debug(message: string, ctx?: LogContext): void {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log(formatMessage(LogLevel.DEBUG, this.component, message, ctx));
    }
  }

  info(message: string, ctx?: LogContext): void {
    if (currentLevel <= LogLevel.INFO) {
      console.log(formatMessage(LogLevel.INFO, this.component, message, ctx));
    }
  }

  warn(message: string, ctx?: LogContext): void {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(formatMessage(LogLevel.WARN, this.component, message, ctx));
    }
  }

  error(message: string, ctx?: LogContext): void {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(formatMessage(LogLevel.ERROR, this.component, message, ctx));
    }
  }
}
