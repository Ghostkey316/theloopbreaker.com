const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function usage() {
  console.log('Usage: node vaultfire-fork.js --base <file> --wallet <address|ENS> [options]');
  console.log('Options:');
  console.log('  --traitMutations <file>   JSON file of trait modifications');
  console.log('  --ethicalOverlay <file>   JSON or markdown overlay for ethics');
  console.log('  --yieldLogic <file>       JSON file for yield logic');
  console.log('  --ethicalOverride <val>   override level for ethics');
  console.log('  --behaviorWeight <num>    behavior weight multiplier');
  console.log('  --loyaltyMultiplier <num> loyalty multiplier');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { flags: {} };
  while (args.length) {
    const arg = args.shift();
    switch (arg) {
      case '--base':
        opts.base = args.shift();
        break;
      case '--wallet':
        opts.wallet = args.shift();
        break;
      case '--traitMutations':
        opts.traitPath = args.shift();
        break;
      case '--ethicalOverlay':
        opts.ethicalPath = args.shift();
        break;
      case '--yieldLogic':
        opts.yieldPath = args.shift();
        break;
      case '--ethicalOverride':
        opts.flags.ethicalOverride = args.shift();
        break;
      case '--behaviorWeight':
        opts.flags.behaviorWeight = parseFloat(args.shift());
        break;
      case '--loyaltyMultiplier':
        opts.flags.loyaltyMultiplier = parseFloat(args.shift());
        break;
      default:
        usage();
    }
  }
  if (!opts.base || !opts.wallet) usage();
  return opts;
}

function loadFile(p) {
  const content = fs.readFileSync(p, 'utf8');
  if (p.endsWith('.json')) return JSON.parse(content);
  return { text: content };
}

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.substr(0,8)}-${hex.substr(8,4)}-${hex.substr(12,4)}-${hex.substr(16,4)}-${hex.substr(20)}`;
}

function createFork(opts) {
  const base = loadFile(opts.base);
  const fork = { base };
  if (opts.traitPath) fork.traits = loadFile(opts.traitPath);
  if (opts.ethicalPath) fork.ethics = loadFile(opts.ethicalPath);
  if (opts.yieldPath) fork.yield = loadFile(opts.yieldPath);
  fork.flags = opts.flags;
  fork.signed_by = opts.wallet;
  return fork;
}

function finalize(obj) {
  const data = JSON.stringify(obj);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const uuid = generateUUID();
  return { protocol_hash: hash, uuid };
}

function main() {
  const opts = parseArgs();
  const fork = createFork(opts);
  const result = finalize(fork);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}
