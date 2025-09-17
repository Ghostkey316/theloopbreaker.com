const fs = require('fs');
const path = require('path');

let sqlite3;
try {
  // eslint-disable-next-line global-require
  sqlite3 = require('sqlite3');
} catch (err) {
  sqlite3 = null;
}

const CONFIG_PATH = path.join(__dirname, 'vaultfire_config.json');
const CORE_CONFIG_PATH = path.join(__dirname, 'vaultfire-core', 'vaultfire_config.json');

let dbInstance = null;
let dbReady = null;
let adapterOverride = null;

function readConfig(location) {
  try {
    const raw = fs.readFileSync(location, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function mergedConfig() {
  const fallback = readConfig(CORE_CONFIG_PATH);
  const primary = readConfig(CONFIG_PATH);
  return { ...fallback, ...primary };
}

function shouldUseDatabase() {
  if (adapterOverride && typeof adapterOverride.shouldUseDatabase === 'function') {
    return adapterOverride.shouldUseDatabase();
  }
  const cfg = mergedConfig();
  return Boolean(cfg.use_database);
}

function ensureSqliteAvailable() {
  if (!sqlite3) {
    throw new Error('sqlite3 dependency is required when database usage is enabled');
  }
}

function resolveDatabasePath(url) {
  const memoryUrl = 'sqlite:///:memory:';
  if (!url || typeof url !== 'string') {
    return path.join(__dirname, 'vaultfire.db');
  }
  if (url === memoryUrl) {
    return ':memory:';
  }
  const prefix = 'sqlite:///';
  if (!url.startsWith(prefix)) {
    throw new Error(`Unsupported database url: ${url}`);
  }
  const remainder = url.slice(prefix.length);
  if (!remainder) {
    return path.join(__dirname, 'vaultfire.db');
  }
  if (remainder.startsWith('/')) {
    return remainder;
  }
  return path.join(__dirname, remainder);
}

function loadJsonFromFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultValue;
  }
}

function writeJsonToFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function runStatement(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function getStatement(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function ensureDatabase() {
  if (adapterOverride && typeof adapterOverride.ensureDatabase === 'function') {
    return adapterOverride.ensureDatabase();
  }
  if (!shouldUseDatabase()) {
    return null;
  }
  ensureSqliteAvailable();
  if (dbInstance) {
    return dbInstance;
  }
  if (dbReady) {
    return dbReady;
  }
  const cfg = mergedConfig();
  const dbPath = resolveDatabasePath(cfg.database_url || 'sqlite:///vaultfire.db');
  dbReady = new Promise((resolve, reject) => {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      db.serialize(async () => {
        try {
          await runStatement(db, 'PRAGMA journal_mode = WAL;').catch(() => null);
          await runStatement(
            db,
            'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
          );
          await runStatement(
            db,
            'CREATE TABLE IF NOT EXISTS log_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, entry TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)'
          );
          dbInstance = db;
          resolve(dbInstance);
        } catch (creationError) {
          reject(creationError);
        }
      });
    });
  });
  return dbReady;
}

async function loadJson(filePath, defaultValue) {
  const targetPath = path.resolve(filePath);
  if (adapterOverride && typeof adapterOverride.loadJson === 'function') {
    return adapterOverride.loadJson(targetPath, defaultValue);
  }
  if (!shouldUseDatabase()) {
    return loadJsonFromFile(targetPath, defaultValue);
  }
  const db = await ensureDatabase();
  const row = await getStatement(db, 'SELECT value FROM kv_store WHERE key = ?', [targetPath]);
  if (!row || typeof row.value !== 'string') {
    return loadJsonFromFile(targetPath, defaultValue);
  }
  try {
    return JSON.parse(row.value);
  } catch (err) {
    return defaultValue;
  }
}

async function writeJson(filePath, data) {
  const targetPath = path.resolve(filePath);
  if (adapterOverride && typeof adapterOverride.writeJson === 'function') {
    await adapterOverride.writeJson(targetPath, data);
    return;
  }
  if (!shouldUseDatabase()) {
    writeJsonToFile(targetPath, data);
    return;
  }
  const db = await ensureDatabase();
  const payload = JSON.stringify(data);
  await runStatement(
    db,
    'INSERT INTO kv_store(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [targetPath, payload]
  );
  writeJsonToFile(targetPath, data);
}

function configureForTests(adapter) {
  adapterOverride = adapter;
}

function resetForTests() {
  adapterOverride = null;
  dbInstance = null;
  dbReady = null;
}

module.exports = {
  loadJson,
  writeJson,
  shouldUseDatabase,
  configureForTests,
  resetForTests,
};
