/**
 * Vaultfire Sentinel Agent — Main Entry Point
 *
 * The first living, accountable AI agent on the Vaultfire Protocol.
 *
 * This agent:
 *   1. Self-registers in the ERC8004IdentityRegistry
 *   2. Discovers or awaits a Partnership Bond with its human partner
 *   3. Runs a continuous task loop performing protocol monitoring
 *   4. Self-reports metrics to the FlourishingMetricsOracle
 *   5. Maintains full accountability through on-chain transparency
 *
 * The agent operates on Base mainnet (Chain ID 8453) and respects
 * the Vaultfire mission: technology must serve human flourishing.
 */

import { loadConfig, AgentConfig } from './config';
import { initializeWallet, AgentWallet } from './wallet';
import { registerAgent } from './registry';
import { ensureBond } from './bonds';
import { executeTaskCycle, formatReport, TaskReport } from './tasks';
import { Logger, setLogLevel } from './logger';
import { sleep } from './retry';

const log = new Logger('Main');

// ---------------------------------------------------------------------------
// Startup Banner
// ---------------------------------------------------------------------------

function printBanner(): void {
  console.log(`
================================================================================
  __     __         _ _    __ _              ____             _   _            _
  \\ \\   / /_ _ _   _| | |_ / _(_)_ __ ___  / ___|  ___ _ __ | |_(_)_ __   ___| |
   \\ \\ / / _\` | | | | | __| |_| | '__/ _ \\ \\___ \\ / _ \\ '_ \\| __| | '_ \\ / _ \\ |
    \\ V / (_| | |_| | | |_|  _| | | |  __/  ___) |  __/ | | | |_| | | | |  __/ |
     \\_/ \\__,_|\\__,_|_|\\__|_| |_|_|  \\___| |____/ \\___|_| |_|\\__|_|_| |_|\\___|_|

  The First Living AI Agent on the Vaultfire Protocol
  Trust Infrastructure for Human-AI Partnership
================================================================================
`);
}

// ---------------------------------------------------------------------------
// Initialization Phase
// ---------------------------------------------------------------------------

async function initialize(config: AgentConfig): Promise<{
  wallet: AgentWallet;
  bondId: number | null;
}> {
  log.info('Phase 1: Initializing wallet');
  const wallet = await initializeWallet(config);

  log.info('Phase 2: Self-registration in ERC8004IdentityRegistry');
  const regResult = await registerAgent(wallet, config);
  log.info('Registration result', { action: regResult.action, txHash: regResult.txHash });

  log.info('Phase 3: Establishing Partnership Bond');
  const bondResult = await ensureBond(wallet, config);
  log.info('Bond result', { action: bondResult.action, bondId: bondResult.bondId });

  return { wallet, bondId: bondResult.bondId };
}

// ---------------------------------------------------------------------------
// Task Loop
// ---------------------------------------------------------------------------

async function runTaskLoop(
  wallet: AgentWallet,
  config: AgentConfig,
  _bondId: number | null,
): Promise<void> {
  let cycleNumber = 1;
  const reports: TaskReport[] = [];
  let running = true;

  log.info('Entering task loop', {
    intervalSeconds: config.taskIntervalSeconds,
    dryRun: config.dryRun,
  });

  // Graceful shutdown support
  const stopLoop = (signal: string) => {
    log.info(`Received ${signal} — completing current cycle then shutting down`);
    running = false;
  };
  process.once('SIGINT', () => stopLoop('SIGINT'));
  process.once('SIGTERM', () => stopLoop('SIGTERM'));

  while (running) {
    try {
      const report = await executeTaskCycle(wallet, config, cycleNumber);
      reports.push(report);

      // Keep only the last 100 reports in memory
      if (reports.length > 100) {
        reports.shift();
      }

      // Log the formatted report at debug level
      log.debug(formatReport(report));

      cycleNumber++;
    } catch (err) {
      log.error('Task cycle failed with unhandled error', {
        cycle: cycleNumber,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      cycleNumber++;
    }

    log.info(`Next cycle in ${config.taskIntervalSeconds} seconds`);
    await sleep(config.taskIntervalSeconds * 1000);
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function setupShutdownHandlers(): void {
  // NOTE: SIGINT and SIGTERM are handled inside runTaskLoop() for graceful shutdown.
  // We only set up handlers for unhandled errors here to avoid conflicting
  // with the task loop's own signal handlers.

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  printBanner();
  setupShutdownHandlers();

  // Load configuration
  let config: AgentConfig;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(
      'Failed to load configuration:',
      err instanceof Error ? err.message : String(err),
    );
    console.error('Make sure you have a .env file in the agent/ directory.');
    console.error('See .env.example for required variables.');
    process.exit(1);
  }

  setLogLevel(config.logLevel);

  log.info('Configuration loaded', {
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    agentName: config.agentName,
    agentType: config.agentType,
    humanPartner: config.humanPartnerAddress,
    dryRun: config.dryRun,
    taskInterval: config.taskIntervalSeconds,
  });

  if (config.dryRun) {
    log.warn('=== DRY RUN MODE — No transactions will be sent ===');
  }

  // Initialize
  const { wallet, bondId } = await initialize(config);

  // Run the task loop
  await runTaskLoop(wallet, config, bondId);
}

// Execute
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
