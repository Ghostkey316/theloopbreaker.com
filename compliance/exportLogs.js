const fs = require('fs');
const path = require('path');
const { BeliefMirrorEngine } = require('../mirror/engine');

function ensureDirectory(targetPath) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
}

function toCsv(entries) {
  const header = [
    'timestamp',
    'wallet',
    'ens',
    'type',
    'multiplier',
    'tier',
    'overrides',
    'metrics.loyalty',
    'metrics.ethics',
    'metrics.frequency',
    'metrics.alignment',
    'metrics.holdDuration',
  ];

  const rows = entries.map((entry) => {
    const metrics = entry.metrics || {};
    return [
      entry.timestamp || '',
      entry.wallet || '',
      entry.ens || '',
      entry.type || '',
      entry.multiplier ?? '',
      entry.tier || '',
      Array.isArray(entry.overrides) && entry.overrides.length ? entry.overrides.join('|') : '',
      metrics.loyalty ?? '',
      metrics.ethics ?? '',
      metrics.frequency ?? '',
      metrics.alignment ?? '',
      metrics.holdDuration ?? '',
    ]
      .map((value) => {
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
      })
      .join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

function exportLogs(options = {}) {
  const {
    telemetryPath,
    format = 'json',
    writeTo,
    ...filters
  } = options;

  const engine = new BeliefMirrorEngine({ telemetryPath });
  const entries = engine.exportLogs(filters);

  if (format === 'json' && !writeTo) {
    return entries;
  }

  let content;
  if (format === 'csv') {
    content = toCsv(entries);
  } else if (format === 'json') {
    content = JSON.stringify(entries, null, 2);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }

  let filePath = null;
  if (writeTo) {
    filePath = path.isAbsolute(writeTo) ? writeTo : path.join(process.cwd(), writeTo);
    ensureDirectory(filePath);
    fs.writeFileSync(filePath, content);
  }

  return {
    format,
    entries,
    content,
    filePath,
  };
}

module.exports = { exportLogs };
