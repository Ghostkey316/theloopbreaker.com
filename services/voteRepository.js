const fs = require('fs');
const path = require('path');

function ensureFile(filePath, fallback = []) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${path.basename(filePath)}: ${error.message}`);
  }
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);

  // Best-effort durability: on some platforms (notably Windows or locked filesystems)
  // fsync can throw EPERM even though the write succeeded.
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      if (process.platform !== 'win32' || error?.code !== 'EPERM') {
        throw error;
      }
    }
  } finally {
    if (typeof fd === 'number') {
      try {
        fs.closeSync(fd);
      } catch (error) {
        // ignore close errors; file content is already on disk
      }
    }
  }
}

class VoteRepository {
  constructor({ filePath }) {
    if (!filePath) {
      throw new Error('VoteRepository requires a filePath');
    }
    this.filePath = filePath;
    ensureFile(this.filePath, []);
    this.queue = Promise.resolve();
  }

  async loadVotes() {
    return readJson(this.filePath);
  }

  async #runExclusive(task) {
    const next = this.queue.then(() => task());
    this.queue = next
      .then(
        () => Promise.resolve(),
        () => Promise.resolve()
      )
      .catch(() => Promise.resolve());
    return next;
  }

  async appendVote(vote) {
    if (!vote || typeof vote !== 'object') {
      throw new Error('Vote payload must be an object');
    }
    return this.#runExclusive(async () => {
      const votes = readJson(this.filePath);
      votes.push(vote);
      writeJsonAtomic(this.filePath, votes);
      return vote;
    });
  }
}

module.exports = { VoteRepository };
