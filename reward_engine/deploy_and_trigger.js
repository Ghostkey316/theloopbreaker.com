#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const STREAM_ARTIFACT_PATH = path.join(
  __dirname,
  '..',
  'artifacts',
  'contracts',
  'VaultfireStreamNFT.sol',
  'VaultfireStreamNFT.json'
);

function loadArtifact() {
  if (!fs.existsSync(STREAM_ARTIFACT_PATH)) {
    throw new Error(
      `Compiled artifact not found at ${STREAM_ARTIFACT_PATH}. Run \"npx hardhat compile\" before executing this script.`
    );
  }
  return JSON.parse(fs.readFileSync(STREAM_ARTIFACT_PATH, 'utf8'));
}

function hashLog(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    rpcUrl: process.env.VF_REWARD_RPC_URL,
    privateKey: process.env.VF_REWARD_PRIVATE_KEY,
    contract: process.env.VF_REWARD_CONTRACT || null,
    userId: null,
    wallet: null,
    multiplier: 1,
    duration: 7 * 24 * 60 * 60,
    metadata: null,
    amount: null,
    simulate: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--rpc':
        options.rpcUrl = args[i + 1];
        i += 1;
        break;
      case '--private-key':
        options.privateKey = args[i + 1];
        i += 1;
        break;
      case '--contract':
        options.contract = args[i + 1];
        i += 1;
        break;
      case '--user':
        options.userId = args[i + 1];
        i += 1;
        break;
      case '--wallet':
        options.wallet = args[i + 1];
        i += 1;
        break;
      case '--multiplier':
        options.multiplier = Number(args[i + 1]);
        i += 1;
        break;
      case '--duration':
        options.duration = Number(args[i + 1]);
        i += 1;
        break;
      case '--metadata':
        options.metadata = args[i + 1];
        i += 1;
        break;
      case '--amount':
        options.amount = args[i + 1];
        i += 1;
        break;
      case '--simulate':
        options.simulate = true;
        break;
      case '--help':
      case '-h':
        console.log(`Usage: deploy_and_trigger.js [options]\n\n` +
          `--rpc <url>            RPC endpoint (default VF_REWARD_RPC_URL)\n` +
          `--private-key <hex>    Private key for deployment and triggering\n` +
          `--contract <address>   Existing contract address to reuse\n` +
          `--user <id>            Vaultfire user identifier\n` +
          `--wallet <address>     Recipient wallet address\n` +
          `--multiplier <float>   Multiplier to encode (default 1)\n` +
          `--duration <seconds>   Stream duration in seconds (default 604800)\n` +
          `--amount <value>       Explicit stream amount in micro-units\n` +
          `--metadata <uri>       Metadata URI for the NFT\n` +
          `--simulate             Dry-run without on-chain transactions`);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return options;
}

function ensureHexAddress(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return ethers.getAddress(address);
}

async function getSigner(rpcUrl, privateKey) {
  if (!rpcUrl) {
    throw new Error('RPC URL is required');
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  if (!privateKey) {
    throw new Error('Private key required to deploy/trigger streams');
  }
  return new ethers.Wallet(privateKey, provider);
}

async function deployContract(signer, artifact) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(await signer.getAddress());
  console.log('Deploying VaultfireStreamNFT...');
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`Contract deployed at ${address}`);
  return contract;
}

function microsFromMultiplier(multiplier) {
  const numeric = Number(multiplier);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Multiplier must be a positive number. Received ${multiplier}`);
  }
  return BigInt(Math.round(numeric * 1_000_000));
}

function parseAmount(amount) {
  if (amount === null || amount === undefined) {
    return null;
  }
  if (/^0x[0-9a-fA-F]+$/.test(amount)) {
    return BigInt(amount);
  }
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
  return BigInt(Math.round(Number(amount)));
}

async function triggerStream(contract, params) {
  const startTime = params.startTime || Math.floor(Date.now() / 1000);
  const endTime = startTime + params.duration;
  const metadata = params.metadata || `ipfs://vaultfire/${params.userId || 'unattributed'}`;
  const userHash = params.userId ? ethers.id(params.userId) : ethers.id(params.wallet);
  const tx = await contract.startStream(params.wallet, params.amount, startTime, endTime, metadata, userHash);
  console.log('Submitting stream transaction...');
  const receipt = await tx.wait();
  const logEntry = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .find((parsed) => parsed.name === 'StreamStarted');

  const eventData = logEntry ? {
    tokenId: logEntry.args.tokenId.toString(),
    userId: logEntry.args.userId,
    startTime: Number(logEntry.args.startTime),
    endTime: Number(logEntry.args.endTime),
  } : null;

  const payload = {
    action: 'trigger',
    userId: params.userId,
    wallet: params.wallet,
    txHash: receipt.hash,
    startTime: new Date((eventData?.startTime || startTime) * 1000).toISOString(),
    contract: await contract.getAddress(),
    tokenId: eventData?.tokenId || null,
    multiplierMicros: params.amount.toString(),
  };

  const digest = hashLog(payload);
  console.log(JSON.stringify({ ...payload, digest }, null, 2));
}

async function main() {
  const options = parseArgs();
  if (options.simulate) {
    const simulated = {
      action: 'simulate',
      userId: options.userId,
      wallet: options.wallet,
      multiplier: options.multiplier,
      duration: options.duration,
      generatedAt: new Date().toISOString(),
    };
    console.log(JSON.stringify({ ...simulated, digest: hashLog(simulated) }, null, 2));
    return;
  }

  if (!options.rpcUrl) {
    throw new Error('RPC URL is required. Pass --rpc or set VF_REWARD_RPC_URL');
  }

  const signer = await getSigner(options.rpcUrl, options.privateKey);
  const artifact = loadArtifact();
  let contract;
  if (options.contract) {
    ensureHexAddress(options.contract);
    contract = new ethers.Contract(options.contract, artifact.abi, signer);
    console.log(`Using existing contract at ${options.contract}`);
  } else {
    contract = await deployContract(signer, artifact);
  }

  if (!options.wallet) {
    throw new Error('Recipient wallet (--wallet) is required to trigger a stream');
  }

  const wallet = ensureHexAddress(options.wallet);
  const amount = options.amount !== null ? parseAmount(options.amount) : microsFromMultiplier(options.multiplier);

  await triggerStream(contract, {
    wallet,
    userId: options.userId,
    amount,
    duration: options.duration,
    metadata: options.metadata,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { main };
