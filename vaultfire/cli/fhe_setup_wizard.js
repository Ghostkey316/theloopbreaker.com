'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const { FHEAdapter } = require('../encryption/fhe_adapter');
const { validateEncryptionProofs } = require('../audits/validate_encryption_proofs');

class FHESetupWizard {
  constructor({
    adapterFactory = (options) => new FHEAdapter(options),
    stdin = process.stdin,
    stdout = process.stdout,
    logger = console,
  } = {}) {
    this._adapterFactory = adapterFactory;
    this._stdin = stdin;
    this._stdout = stdout;
    this._logger = logger || console;
    this._adapter = null;
    this._answers = {};
  }

  async run({ interactive = this._stdin.isTTY, defaults = {}, mode, network, diagnostics = false } = {}) {
    this._answers.mode = mode || defaults.mode || 'auto';
    this._answers.network = network || defaults.network || (interactive ? null : 'testnet');

    if (interactive) {
      await this._promptInteractive();
    } else {
      if (!this._answers.network) {
        this._answers.network = 'testnet';
      }
    }

    this._adapter = this._adapterFactory({ mode: this._answers.mode, logger: this._logger });
    await this._adapter?.switchBackend?.(this._answers.mode ?? 'auto');

    const keyMaterial = await this._adapter.keygen({
      domain: `vaultfire::${this._answers.network}`,
      metadata: { createdBy: 'fhe-setup-wizard', network: this._answers.network },
    });

    const diagnosticsReport = diagnostics
      ? await validateEncryptionProofs({
          iterations: 25,
          concurrency: 2,
          adapterOptions: { adapter: this._adapter },
          logger: this._logger,
        })
      : null;

    const plan = {
      mode: this._answers.mode,
      network: this._answers.network,
      keyMaterial,
      migrationState: typeof this._adapter.getMigrationState === 'function'
        ? this._adapter.getMigrationState()
        : null,
      diagnostics: diagnosticsReport,
      nextSteps: buildNextSteps({ network: this._answers.network, diagnostics }),
    };

    return plan;
  }

  async _promptInteractive() {
    const rl = readline.createInterface({ input: this._stdin, output: this._stdout });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    if (!this._answers.mode) {
      const modeAnswer = await question('Select FHE mode [auto/tfhe/zama/simulation]: ');
      this._answers.mode = normaliseMode(modeAnswer.trim()) || 'auto';
    }

    if (!this._answers.network) {
      const networkAnswer = await question('Target network [mainnet/testnet/devnet]: ');
      this._answers.network = normaliseNetwork(networkAnswer.trim()) || 'testnet';
    }

    rl.close();
  }
}

function normaliseMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['auto', 'tfhe', 'zama', 'simulation'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normaliseNetwork(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['mainnet', 'testnet', 'devnet'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function buildNextSteps({ network, diagnostics }) {
  const steps = [
    'Distribute public keys to partners via secure channel.',
    'Store secret keys in a hardware security module or KMS.',
    `Register FHE public key with partner verifier loader for ${network}.`,
  ];
  if (diagnostics) {
    steps.push('Review diagnostics report and archive checksum for audit purposes.');
  }
  steps.push('Schedule periodic rotation using FHESetupWizard in non-interactive mode.');
  return steps;
}

function parseWizardArgs(argv = process.argv.slice(2), { stdin = process.stdin } = {}) {
  const options = {
    interactive: Boolean(stdin && stdin.isTTY),
    diagnostics: false,
    mode: undefined,
    network: undefined,
    output: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const [key, value] = arg.split('=');
    const normalized = key.replace(/^--/, '');
    switch (normalized) {
      case 'mode':
        options.mode = value ?? argv[i + 1];
        if (value === undefined) i += 1;
        break;
      case 'network':
        options.network = value ?? argv[i + 1];
        if (value === undefined) i += 1;
        break;
      case 'non-interactive':
        options.interactive = false;
        break;
      case 'diagnostics':
        options.diagnostics = true;
        break;
      case 'output':
        options.output = value ?? argv[i + 1];
        if (value === undefined) i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

async function runWizardCli() {
  const args = parseWizardArgs(undefined, { stdin: process.stdin });
  const wizard = new FHESetupWizard();
  const plan = await wizard.run({
    interactive: args.interactive,
    mode: args.mode,
    network: args.network,
    diagnostics: args.diagnostics,
  });

  if (args.output) {
    const target = path.resolve(args.output);
    fs.writeFileSync(target, JSON.stringify(plan, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Wizard plan saved to ${target}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(plan, null, 2));
  }
}

module.exports = {
  FHESetupWizard,
  parseWizardArgs,
  runWizardCli,
  normaliseMode,
  normaliseNetwork,
  buildNextSteps,
};

if (require.main === module) {
  runWizardCli().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[fhe-setup-wizard] fatal error', error);
    process.exitCode = 1;
  });
}
