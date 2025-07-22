// CLI to fork Vaultfire stack
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node vaultfire_fork.js <partner_ens> <belief_phrase> [--silent]');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const silentIndex = args.indexOf('--silent');
  const silent = silentIndex !== -1;
  if (silent) args.splice(silentIndex, 1);
  if (args.length < 2) usage();
  const [ens, ...phraseParts] = args;
  const phrase = phraseParts.join(' ');
  if (!phrase) usage();
  return { ens, phrase, silent };
}

function cloneRepo(target) {
  const repo = 'https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git';
  execSync(`git clone ${repo} ${target}`, { stdio: 'inherit' });
}

function injectConfig(dir, ens, phrase) {
  const cfgPath = path.join(dir, 'vaultfire-core', 'vaultfire_config.json');
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    cfg = {};
  }
  cfg.partner_ens = ens;
  cfg.belief_phrase = phrase;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

function runIntegrity(dir, silent) {
  const script = path.join(dir, 'system_integrity_check.py');
  const res = spawnSync('python3', [script, '--silent'], { encoding: 'utf8' });
  if (!silent) process.stdout.write(res.stdout);
  if (res.status !== 0) {
    if (!silent) process.stderr.write(res.stderr);
    return false;
  }
  return true;
}

function main() {
  const { ens, phrase, silent } = parseArgs();
  const target = path.join(process.cwd(), `${ens}-vaultfire`);
  if (!silent) console.log(`Cloning Vaultfire stack to ${target}...`);
  cloneRepo(target);
  if (!silent) console.log('Injecting config...');
  injectConfig(target, ens, phrase);
  if (!silent) console.log('Running integrity check...');
  const ok = runIntegrity(target, silent);
  if (ok) {
    console.log('Fork setup complete');
  } else {
    console.error('Integrity check failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
