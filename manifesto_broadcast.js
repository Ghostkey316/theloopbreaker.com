// Reference: ethics/core.mdx
const fs = require('fs');
const path = require('path');

const HEARTBEAT_PATH = path.join(__dirname, 'dashboards', 'ghostkey_heartbeat.json');
const OUTPUT_PATH = path.join(__dirname, 'dashboards', 'manifesto_updates.txt');

function readHeartbeat() {
  if (!fs.existsSync(HEARTBEAT_PATH)) return [];
  try {
    const raw = fs.readFileSync(HEARTBEAT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function lastWeekEntries(log) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - oneWeek;
  return log.filter(entry => {
    const t = Date.parse(entry.timestamp);
    return !isNaN(t) && t >= cutoff;
  });
}

function summarize(entries) {
  const counts = {
    '🔥 On Fire': 0,
    '🧭 Aligned': 0,
    '😶 Drifted': 0,
    '🚫 Ethics Breach': 0
  };
  const usersOnFire = new Set();
  const uniqueUsers = new Set();

  for (const entry of entries) {
    for (const [user, status] of Object.entries(entry)) {
      if (user === 'timestamp') continue;
      uniqueUsers.add(user);
      counts[status] = (counts[status] || 0) + 1;
      if (status === '🔥 On Fire') usersOnFire.add(user);
    }
  }

  return { counts, usersOnFire: Array.from(usersOnFire), uniqueUsers: uniqueUsers.size };
}

function buildMessage(summary) {
  const { counts, usersOnFire, uniqueUsers } = summary;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const alignRate = ((counts['🧭 Aligned'] + counts['🔥 On Fire']) / total * 100).toFixed(1);
  const date = new Date().toISOString().split('T')[0];

  return [
    `## Weekly Manifesto Update - ${date}`,
    '',
    `Community Pulse: 🔥 ${counts['🔥 On Fire']} | 🧭 ${counts['🧭 Aligned']} | 😶 ${counts['😶 Drifted']} | 🚫 ${counts['🚫 Ethics Breach']}`,
    `Partner Insight: ${alignRate}% alignment across ${uniqueUsers} active contributors.`,
    `Contributor Highlights: ${usersOnFire.length ? usersOnFire.join(', ') : 'No one'} on fire.`,
    ''
  ].join('\n');
}

function writeUpdate(message) {
  fs.appendFileSync(OUTPUT_PATH, message + '\n');
}

function run() {
  const log = readHeartbeat();
  const recent = lastWeekEntries(log);
  const summary = summarize(recent);
  const message = buildMessage(summary);
  console.log(message);
  writeUpdate(message);
}

if (require.main === module) {
  run();
}
