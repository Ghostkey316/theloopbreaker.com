const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const CloudTransport = require('./cloudTransport');

const LOG_ROOT = path.join(__dirname, '..', '..', 'logs');
const AUDIT_DIR = path.join(LOG_ROOT, 'audit');

function ensureDirectories() {
  fs.mkdirSync(LOG_ROOT, { recursive: true });
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

ensureDirectories();

const jsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${suffix}`;
  })
);

function buildTransports(category) {
  const streamTransports = [
    new transports.Console({
      level: process.env.VAULTFIRE_LOG_LEVEL || 'info',
      format: consoleFormat,
    }),
    new DailyRotateFile({
      filename: path.join(LOG_ROOT, `${category || 'vaultfire'}-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
      level: 'info',
    }),
    new DailyRotateFile({
      filename: path.join(AUDIT_DIR, `${category || 'vaultfire'}-audit-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      format: jsonFormat,
      level: 'info',
    }),
  ];

  const cloudProvider = process.env.VAULTFIRE_LOG_CLOUD_PROVIDER;
  if (cloudProvider && cloudProvider !== 'disabled') {
    streamTransports.push(
      new CloudTransport({
        provider: cloudProvider,
      })
    );
  } else {
    streamTransports.push(new CloudTransport({ provider: 'buffer' }));
  }

  return streamTransports;
}

function createVaultfireLogger(category = 'vaultfire') {
  return createLogger({
    level: process.env.VAULTFIRE_LOG_LEVEL || 'info',
    defaultMeta: { service: category },
    format: jsonFormat,
    transports: buildTransports(category),
  });
}

const rootLogger = createVaultfireLogger();

module.exports = {
  createVaultfireLogger,
  logger: rootLogger,
};
