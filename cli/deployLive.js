#!/usr/bin/env node
/**
 * Live oracle deployment helper.
 * Emits BaseOracle contract using ethers and .env credentials.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'BaseOracle.sol', 'BaseOracle.json');

function loadArtifact() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error('Compile BaseOracle.sol before deploying (artifact missing)');
  }
  const raw = fs.readFileSync(artifactPath, 'utf8');
  return JSON.parse(raw);
}

async function deploy({ live }) {
  const rpcUrl = process.env.BASE_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error('BASE_RPC_URL and PRIVATE_KEY must be provided');
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const artifact = loadArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  if (!live) {
    console.log('Dry run only. Use --live to broadcast. Guardian address:', wallet.address);
    return;
  }

  const contract = await factory.deploy(wallet.address, { gasLimit: 250000 });
  await contract.deployed();
  console.log(JSON.stringify({ address: contract.address, tx: contract.deployTransaction.hash }));
}

const args = process.argv.slice(2);
const live = args.includes('--live');

deploy({ live }).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
