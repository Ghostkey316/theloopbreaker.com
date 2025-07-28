const {
  syncMirror,
  repair,
  stabilize,
  rebuild,
  adapt,
  upgradeCore,
} = require('../../modules/regen/nanoloop_mirrorsync_v2');
const {
  predict,
  shield,
  audit,
} = require('../../modules/regen/nanoloop_predictive_v3');

function usage() {
  console.log('Usage: node nano.js <command> [options]');
  console.log('Commands:');
  console.log('  repair --patient <id> --thread <thread>');
  console.log('  stabilize --patient <id> --notes <text>');
  console.log('  rebuild --patient <id> --pattern <pattern>');
  console.log('  sync-mirror --signal <num> --belief <num>');
  console.log('  adapt --status <status>');
  console.log('  upgrade-core --tag <tag>');
  console.log('  predict --user <id> --region <part> --signal <num>');
  console.log('  shield --user <id> --region <part>');
  console.log('  audit');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args.shift();
  const opts = {};
  while (args.length) {
    const a = args.shift();
    switch (a) {
      case '--patient':
        opts.patient = args.shift();
        break;
      case '--thread':
        opts.thread = args.shift();
        break;
      case '--notes':
        opts.notes = args.shift();
        break;
      case '--pattern':
        opts.pattern = args.shift();
        break;
      case '--user':
        opts.user = args.shift();
        break;
      case '--region':
        opts.region = args.shift();
        break;
      case '--signal':
        opts.signal = parseFloat(args.shift());
        break;
      case '--belief':
        opts.belief = parseFloat(args.shift());
        break;
      case '--status':
        opts.status = args.shift();
        break;
      case '--tag':
        opts.tag = args.shift();
        break;
      default:
        console.error('Unknown arg', a);
        usage();
    }
  }
  return { cmd, opts };
}

function main() {
  const { cmd, opts } = parseArgs();
  let result;
  switch (cmd) {
    case 'repair':
      result = repair(opts.patient, opts.thread);
      break;
    case 'stabilize':
      result = stabilize(opts.patient, opts.notes);
      break;
    case 'rebuild':
      result = rebuild(opts.patient, opts.pattern);
      break;
    case 'sync-mirror':
      result = syncMirror(Number(opts.signal), Number(opts.belief));
      break;
    case 'adapt':
      result = adapt(opts.status);
      break;
    case 'upgrade-core':
      result = upgradeCore(opts.tag);
      break;
    case 'predict':
      result = predict(opts.user, opts.region, Number(opts.signal));
      break;
    case 'shield':
      result = shield(opts.user, opts.region);
      break;
    case 'audit':
      result = audit();
      break;
    default:
      usage();
  }
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { main };
