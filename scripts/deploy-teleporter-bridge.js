/**
 * @title Vaultfire Teleporter Bridge — Deployment Script
 * @notice Deploys VaultfireTeleporterBridge to both Base mainnet and Avalanche C-Chain,
 *         then configures each bridge to point to its remote peer.
 *
 * Usage:
 *   PRIVATE_KEY=<key> npx hardhat run scripts/deploy-teleporter-bridge.js --network baseMainnet
 *   PRIVATE_KEY=<key> npx hardhat run scripts/deploy-teleporter-bridge.js --network avalanche
 *
 * Or deploy to both sequentially:
 *   node scripts/deploy-teleporter-bridge.js --both
 *
 * Environment variables:
 *   PRIVATE_KEY              — Deployer private key
 *   BASE_RPC_URL             — Base mainnet RPC (default: https://mainnet.base.org)
 *   AVAX_RPC_URL             — Avalanche C-Chain RPC (default: https://api.avax.network/ext/bc/C/rpc)
 *   TELEPORTER_MESSENGER     — TeleporterMessenger address on Avalanche (default: 0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf)
 *   REQUIRED_GAS_LIMIT       — Gas limit for cross-chain message execution (default: 500000)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Chain IDs
  BASE_CHAIN_ID: 8453,
  AVAX_CHAIN_ID: 43114,

  // RPC endpoints
  BASE_RPC: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  AVAX_RPC: process.env.AVAX_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",

  // TeleporterMessenger on Avalanche C-Chain (universal address via Nick's method)
  TELEPORTER_MESSENGER: process.env.TELEPORTER_MESSENGER || "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf",

  // Gas limit for Teleporter message execution on destination
  REQUIRED_GAS_LIMIT: parseInt(process.env.REQUIRED_GAS_LIMIT || "500000"),

  // Existing Vaultfire contract addresses
  contracts: {
    base: {
      ERC8004IdentityRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
      AIPartnershipBondsV2: "0x895a550B351B58352e10659232b2254b15E8152c",
      AIAccountabilityBondsV2: "0x9c316d3a436F73957b1263150752533C05341C6A",
      ERC8004ReputationRegistry: "0x544B575431ECD927bA83E85008446fA1e100204a",
      ERC8004ValidationRegistry: "0x501fE0f960c1e061C4d295Af241f9F1512775556",
    },
    avalanche: {
      ERC8004IdentityRegistry: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5",
      AIPartnershipBondsV2: "0x37679B1dCfabE6eA6b8408626815A1426bE2D717",
      AIAccountabilityBondsV2: "0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192",
      ERC8004ReputationRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
      ERC8004ValidationRegistry: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getBlockchainID(chainId) {
  return ethers.keccak256(ethers.toBeHex(chainId, 32));
}

function loadArtifact() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "teleporter",
    "VaultfireTeleporterBridge.sol",
    "VaultfireTeleporterBridge.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found at ${artifactPath}. Run 'npx hardhat compile' first.`
    );
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployBridge(provider, wallet, teleporterAddress, gasLimit, chainName) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Deploying VaultfireTeleporterBridge to ${chainName}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Deployer:    ${wallet.address}`);
  console.log(`  Teleporter:  ${teleporterAddress}`);
  console.log(`  Gas Limit:   ${gasLimit}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance:     ${ethers.formatEther(balance)} native`);

  if (balance === 0n) {
    throw new Error(`Deployer has zero balance on ${chainName}`);
  }

  const artifact = loadArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log(`\n  Sending deployment transaction...`);
  const contract = await factory.deploy(teleporterAddress, gasLimit);
  console.log(`  TX hash:     ${contract.deploymentTransaction().hash}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ✅ Deployed:  ${address}`);

  return { contract, address };
}

async function configurePeer(bridge, remoteBlockchainID, remoteBridgeAddress, remoteChainId, remoteName) {
  console.log(`\n  Configuring remote peer → ${remoteName}`);
  console.log(`    Remote blockchain ID: ${remoteBlockchainID}`);
  console.log(`    Remote bridge addr:   ${remoteBridgeAddress}`);
  console.log(`    Remote chain ID:      ${remoteChainId}`);

  const tx = await bridge.setRemoteBridge(remoteBlockchainID, remoteBridgeAddress, remoteChainId);
  console.log(`    TX hash: ${tx.hash}`);
  await tx.wait();
  console.log(`    ✅ Remote peer configured`);
}

function saveDeployment(baseBridgeAddr, avaxBridgeAddr) {
  const deployment = {
    timestamp: new Date().toISOString(),
    network: "mainnet",
    bridges: {
      base: {
        chainId: CONFIG.BASE_CHAIN_ID,
        blockchainID: getBlockchainID(CONFIG.BASE_CHAIN_ID),
        bridgeAddress: baseBridgeAddr,
        teleporterMessenger: ethers.ZeroAddress,
        rpc: CONFIG.BASE_RPC,
      },
      avalanche: {
        chainId: CONFIG.AVAX_CHAIN_ID,
        blockchainID: getBlockchainID(CONFIG.AVAX_CHAIN_ID),
        bridgeAddress: avaxBridgeAddr,
        teleporterMessenger: CONFIG.TELEPORTER_MESSENGER,
        rpc: CONFIG.AVAX_RPC,
      },
    },
    vaultfireContracts: CONFIG.contracts,
    gasLimit: CONFIG.REQUIRED_GAS_LIMIT,
  };

  const outPath = path.join(__dirname, "..", "teleporter-bridge-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n  📄 Deployment saved to: ${outPath}`);
  return deployment;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN — Deploy to both chains
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Vaultfire Teleporter Bridge — Production Deployment   ║");
  console.log("║   Cross-Chain Trust Portability: Base ↔ Avalanche       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // ── Connect to both chains ────────────────────────────────────────────
  const baseProvider = new ethers.JsonRpcProvider(CONFIG.BASE_RPC);
  const avaxProvider = new ethers.JsonRpcProvider(CONFIG.AVAX_RPC);

  const baseWallet = new ethers.Wallet(privateKey, baseProvider);
  const avaxWallet = new ethers.Wallet(privateKey, avaxProvider);

  // ── Deploy to Base (no Teleporter — relayer only) ─────────────────────
  const baseDeploy = await deployBridge(
    baseProvider,
    baseWallet,
    ethers.ZeroAddress,  // No Teleporter on Base
    CONFIG.REQUIRED_GAS_LIMIT,
    "Base Mainnet"
  );

  // ── Deploy to Avalanche (with Teleporter) ─────────────────────────────
  const avaxDeploy = await deployBridge(
    avaxProvider,
    avaxWallet,
    CONFIG.TELEPORTER_MESSENGER,
    CONFIG.REQUIRED_GAS_LIMIT,
    "Avalanche C-Chain"
  );

  // ── Configure peers ───────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log("  Configuring Cross-Chain Peers");
  console.log(`${"═".repeat(60)}`);

  // Base → Avalanche
  await configurePeer(
    baseDeploy.contract,
    getBlockchainID(CONFIG.AVAX_CHAIN_ID),
    avaxDeploy.address,
    CONFIG.AVAX_CHAIN_ID,
    "Avalanche"
  );

  // Avalanche → Base
  await configurePeer(
    avaxDeploy.contract,
    getBlockchainID(CONFIG.BASE_CHAIN_ID),
    baseDeploy.address,
    CONFIG.BASE_CHAIN_ID,
    "Base"
  );

  // ── Save deployment ───────────────────────────────────────────────────
  const deployment = saveDeployment(baseDeploy.address, avaxDeploy.address);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log("  ✅ DEPLOYMENT COMPLETE");
  console.log(`${"═".repeat(60)}`);
  console.log(`  Base Bridge:      ${baseDeploy.address}`);
  console.log(`  Avalanche Bridge: ${avaxDeploy.address}`);
  console.log(`  Gas Limit:        ${CONFIG.REQUIRED_GAS_LIMIT}`);
  console.log(`\n  Next steps:`);
  console.log(`  1. Verify contracts on BaseScan and Snowtrace`);
  console.log(`  2. Start the off-chain relayer (scripts/relayer.js)`);
  console.log(`  3. Test with a cross-chain agent registration`);
  console.log(`${"═".repeat(60)}\n`);
}

// ── Hardhat task entry point ────────────────────────────────────────────
// When run via `npx hardhat run`, module.exports is not used.
// When run directly with `node`, we call main().
if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  });
}

module.exports = { main, CONFIG, getBlockchainID };
