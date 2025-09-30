#!/usr/bin/env node
const { Command } = require('commander');
const { ethers } = require('ethers');

const streamAbi = [
  'function streamReward(address recipient, uint256 amount) external',
  'function streamDuration() external view returns (uint64)',
  'function claimable(address recipient) external view returns (uint256)',
];

const erc20Abi = [
  'function decimals() external view returns (uint8)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
];

function formatUnits(value, decimals) {
  return Number(ethers.formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(6, decimals),
  });
}

async function fetchDecimals(tokenContract, fallback) {
  if (!tokenContract) return fallback;
  try {
    return await tokenContract.decimals();
  } catch (error) {
    return fallback;
  }
}

async function ensureAllowance(tokenContract, owner, spender, amount) {
  if (!tokenContract) {
    return;
  }
  const allowance = await tokenContract.allowance(owner, spender);
  if (allowance >= amount) {
    return;
  }
  const tx = await tokenContract.approve(spender, amount);
  await tx.wait();
}

function buildSummary({ amount, duration, perSecond, perMinute, decimals }) {
  return {
    amount: formatUnits(amount, decimals),
    durationSeconds: duration.toString(),
    perSecond: formatUnits(perSecond, decimals),
    perMinute: formatUnits(perMinute, decimals),
  };
}

async function main(argv) {
  const program = new Command();
  program
    .option('--recipient <address>', 'Recipient address')
    .option('--amount <amount>', 'Reward amount in token units')
    .option('--duration <seconds>', 'Stream duration in seconds')
    .option('--stream <address>', 'VaultfireRewardStream contract address', process.env.VF_REWARD_STREAM)
    .option('--token <address>', 'ERC20 token address', process.env.VF_REWARD_TOKEN)
    .option('--rpc <url>', 'RPC endpoint', process.env.RPC_URL || 'http://localhost:8545')
    .option('--private-key <key>', 'Private key for automation/admin role', process.env.PRIVATE_KEY)
    .option('--decimals <decimals>', 'Token decimals override')
    .option('--simulate-only', 'Skip on-chain execution', false)
    .option('--gas-price <gwei>', 'Gas price override in gwei')
    .option('--dry-run', 'Alias for --simulate-only', false)
    .parse(argv);

  const options = program.opts();
  if (!options.recipient) {
    throw new Error('Recipient address is required');
  }
  if (!options.amount) {
    throw new Error('Amount is required');
  }
  if (!options.duration) {
    throw new Error('Duration is required');
  }
  if (!options.stream) {
    throw new Error('VaultfireRewardStream contract address is required');
  }

  const provider = new ethers.JsonRpcProvider(options.rpc);
  const dryRun = options.simulateOnly || options.dryRun;
  let signer = null;
  if (!dryRun) {
    if (!options.privateKey) {
      throw new Error('Private key is required for execution');
    }
    signer = new ethers.Wallet(options.privateKey, provider);
  }

  const streamContract = new ethers.Contract(options.stream, streamAbi, signer || provider);
  const tokenContract = options.token ? new ethers.Contract(options.token, erc20Abi, signer || provider) : null;

  let decimals = Number(options.decimals ?? NaN);
  if (!Number.isFinite(decimals)) {
    decimals = await fetchDecimals(tokenContract, 18);
  }

  const amountInWei = ethers.parseUnits(options.amount, decimals);
  const durationSeconds = BigInt(options.duration);
  if (durationSeconds <= 0n) {
    throw new Error('Duration must be greater than zero');
  }

  const perSecond = amountInWei / durationSeconds;
  const perMinute = perSecond * 60n;
  const summary = buildSummary({
    amount: amountInWei,
    duration: durationSeconds,
    perSecond,
    perMinute,
    decimals,
  });

  console.log('Vaultfire reward stream simulation');
  console.table(summary);

  if (dryRun) {
    return summary;
  }

  const account = await signer.getAddress();
  await ensureAllowance(tokenContract, account, options.stream, amountInWei);

  const overrides = {};
  if (options.gasPrice) {
    overrides.gasPrice = ethers.parseUnits(options.gasPrice, 'gwei');
  }

  const tx = await streamContract.streamReward(options.recipient, amountInWei, overrides);
  console.log('Submitted transaction', tx.hash);
  const receipt = await tx.wait();
  console.log('Reward stream scheduled in block', receipt.blockNumber);

  const claimable = await streamContract.claimable(options.recipient);
  console.log(`Recipient can claim ${formatUnits(claimable, decimals)} tokens after stream unlocks.`);

  return { summary, tx: receipt.transactionHash };
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { main };
