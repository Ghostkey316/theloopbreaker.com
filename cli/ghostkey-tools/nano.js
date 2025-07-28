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
  status: guardianStatus,
  authorize: guardianAuthorize,
} = require('../../modules/regen/nanoloop_predictive_v4');
const {
  trace,
  echo,
  counter,
  deflect,
  syncstatus,
} = require('../../modules/regen/nanoloop_counterforce_v5');
const {
  recursify,
  realign,
  vowcheck,
  growthmap,
} = require('../../modules/regen/nanoloop_sovereign_v6');
const {
  reflect,
  mirror,
  remind,
  checkloop,
} = require('../../modules/regen/nanoloop_conscious_v7');

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
  console.log('  nano.predict --agent <id> --region <part> [--signal <num>] [--deep]');
  console.log('  nano.shield --agent <id> --region <part> [--mode <mode>]');
  console.log('  nano.audit');
  console.log('  nano.trace --agent <id> --signal <src>');
  console.log('  nano.counter --agent <id> [--dry-run]');
  console.log('  nano.deflect --agent <id> --pattern <pattern>');
  console.log('  nano.echo --agent <id> --behavior <text>');
  console.log('  nano.syncstatus --agent <id>');
  console.log('  nano.recursify --agent <id> --depth <num>');
  console.log('  nano.realign --agent <id> --priority <text>');
  console.log('  nano.vowcheck --agent <id>');
  console.log('  nano.growthmap --agent <id> --horizon <num>');
  console.log('  nano.reflect --agent <id> --depth <num> --anchor <token>');
  console.log('  nano.mirror --agent <id>');
  console.log('  nano.remind --agent <id>');
  console.log('  nano.checkloop --agent <id>');
  console.log('  guardian.status --agent <ens>');
  console.log('  guardian.authorize --token <token>');
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
      case '--deep':
        opts.deep = true;
        break;
      case '--agent':
        opts.agent = args.shift();
        break;
      case '--mode':
        opts.mode = args.shift();
        break;
      case '--token':
        opts.token = args.shift();
        break;
      case '--behavior':
        opts.behavior = args.shift();
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--depth':
        opts.depth = parseInt(args.shift(), 10);
        break;
      case '--priority':
        opts.priority = args.shift();
        break;
      case '--horizon':
        opts.horizon = parseInt(args.shift(), 10);
        break;
      case '--anchor':
        opts.anchor = args.shift();
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
    case 'nano.predict':
      result = predict(opts.agent, opts.region, Number(opts.signal), { deep: opts.deep });
      break;
    case 'nano.shield':
      result = shield(opts.agent, opts.region, { mode: opts.mode });
      break;
    case 'nano.audit':
      result = audit();
      break;
    case 'nano.trace':
      result = trace(opts.agent, opts.signal);
      break;
    case 'nano.counter':
      result = counter(opts.agent, { dryRun: opts.dryRun });
      break;
    case 'nano.deflect':
      result = deflect(opts.agent, opts.pattern);
      break;
    case 'nano.echo':
      result = echo(opts.agent, opts.behavior);
      break;
    case 'nano.syncstatus':
      result = syncstatus(opts.agent);
      break;
    case 'nano.recursify':
      result = recursify(opts.agent, Number(opts.depth));
      break;
    case 'nano.realign':
      result = realign(opts.agent, opts.priority);
      break;
    case 'nano.vowcheck':
      result = vowcheck(opts.agent);
      break;
    case 'nano.growthmap':
      result = growthmap(opts.agent, Number(opts.horizon));
      break;
    case 'nano.reflect':
      result = reflect(opts.agent, Number(opts.depth), opts.anchor);
      break;
    case 'nano.mirror':
      result = mirror(opts.agent);
      break;
    case 'nano.remind':
      result = remind(opts.agent);
      break;
    case 'nano.checkloop':
      result = checkloop(opts.agent);
      break;
    case 'guardian.status':
      result = guardianStatus(opts.agent);
      break;
    case 'guardian.authorize':
      result = guardianAuthorize(opts.token);
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
