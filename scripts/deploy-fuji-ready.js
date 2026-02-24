/**
 * Vaultfire Protocol — Fuji Testnet Deployment (Ready-to-Run)
 *
 * Deploys all 13 core Vaultfire contracts to Avalanche Fuji testnet in the
 * correct dependency order.  This script is designed for the Avalanche Build
 * Games program and mirrors the Base mainnet deployment.
 *
 * ============================================================================
 * BEFORE YOU RUN — CHECKLIST
 * ============================================================================
 *
 * 1. Get Fuji testnet AVAX from the faucet:
 *      https://core.app/tools/testnet-faucet/
 *    You need at least 1 AVAX.  The faucet gives 2 AVAX per request.
 *
 * 2. Create a .env file in the project root (or export the variable):
 *      PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
 *
 * 3. (Optional) Set a Snowtrace / Routescan API key for verification:
 *      SNOWTRACE_API_KEY=your_api_key
 *
 * 4. Run the deployment:
 *      npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji
 *
 * 5. After deployment, verify contracts using the printed commands.
 *
 * ============================================================================
 * DEPLOYMENT ORDER (dependency graph)
 * ============================================================================
 *
 * Phase 1 — Independent contracts (no constructor arguments):
 *   1. PrivacyGuarantees
 *   2. MissionEnforcement
 *   3. AntiSurveillance
 *   4. ERC8004IdentityRegistry
 *   5. BeliefAttestationVerifier
 *   6. AIPartnershipBondsV2
 *   7. FlourishingMetricsOracle
 *
 * Phase 2 — Dependent contracts (require Phase 1 addresses):
 *   8.  ERC8004ReputationRegistry(identityRegistry)
 *   9.  ERC8004ValidationRegistry(identityRegistry, beliefVerifier)
 *   10. AIAccountabilityBondsV2(humanTreasury)
 *   11. VaultfireERC8004Adapter(partnershipBonds, identity, reputation, validation)
 *   12. MultisigGovernance([signers], threshold)
 *   13. ProductionBeliefAttestationVerifier(riscZeroVerifier, imageId)
 *
 * ============================================================================
 *
 * Deployer wallet: 0xA054f831B562e729F8D268291EBde1B2EDcFb84F
 * Network: Avalanche Fuji (Chain ID 43113)
 * Base mainnet remains the PRIMARY / CANONICAL deployment.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEPLOYER_EXPECTED = "0xA054f831B562e729F8D268291EBde1B2EDcFb84F";

// MultisigGovernance — single signer for testnet
const MULTISIG_SIGNERS = [DEPLOYER_EXPECTED];
const MULTISIG_THRESHOLD = 1;

// ProductionBeliefAttestationVerifier — placeholder RISC Zero verifier
const RISC_ZERO_VERIFIER_PLACEHOLDER = DEPLOYER_EXPECTED;
const BELIEF_CIRCUIT_IMAGE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

// Human treasury for AIAccountabilityBondsV2
const HUMAN_TREASURY = DEPLOYER_EXPECTED;

// Output paths
const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const OUTPUT_FILE = path.join(DEPLOYMENTS_DIR, "fuji-deployment.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function deployContract(name, args = []) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  console.log(`  [OK] ${name}`);
  console.log(`       Address : ${address}`);
  console.log(`       TX      : ${tx.hash}\n`);
  return { contract, address, txHash: tx.hash };
}

function snowtraceUrl(address) {
  return `https://testnet.snowtrace.io/address/${address}`;
}

// ---------------------------------------------------------------------------
// Pre-flight Checks
// ---------------------------------------------------------------------------

async function preflight() {
  console.log("\n" + "=".repeat(80));
  console.log("  PRE-FLIGHT CHECKS");
  console.log("=".repeat(80) + "\n");

  // 1. Network / Chain ID
  const networkName = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();

  if (networkName !== "avalancheFuji" || chainId !== 43113n) {
    console.error(
      `  [FAIL] Wrong network: ${networkName} (Chain ID ${chainId})\n` +
      `         Expected: avalancheFuji (Chain ID 43113)\n\n` +
      `  Run with:  npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji\n`
    );
    process.exit(1);
  }
  console.log(`  [OK] Network : ${networkName} (Chain ID ${chainId})`);

  // 2. Deployer wallet
  const [deployer] = await hre.ethers.getSigners();
  console.log(`  [OK] Deployer: ${deployer.address}`);

  // 3. Balance check
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceAVAX = hre.ethers.formatEther(balance);
  console.log(`  [OK] Balance : ${balanceAVAX} AVAX`);

  if (balance < hre.ethers.parseEther("0.5")) {
    console.error(
      `\n  [FAIL] Insufficient AVAX for deployment (need >= 0.5 AVAX).\n` +
      `         Get testnet AVAX from: https://core.app/tools/testnet-faucet/\n`
    );
    process.exit(1);
  }

  console.log("\n  All pre-flight checks passed.\n");
  return { deployer, networkName, chainId, balance };
}

// ---------------------------------------------------------------------------
// Main Deployment
// ---------------------------------------------------------------------------

async function main() {
  const { deployer, networkName, chainId } = await preflight();

  console.log("=".repeat(80));
  console.log("  VAULTFIRE PROTOCOL — FUJI TESTNET DEPLOYMENT");
  console.log("  Deploying all 13 core contracts");
  console.log("  Base mainnet remains the PRIMARY / CANONICAL deployment.");
  console.log("=".repeat(80) + "\n");

  const startTime = Date.now();
  const deployed = {};

  // ========================================================================
  // Phase 1 — Independent contracts (no constructor dependencies)
  // ========================================================================
  console.log("-".repeat(60));
  console.log("  Phase 1: Independent contracts (7 contracts)");
  console.log("-".repeat(60) + "\n");

  const privacyGuarantees = await deployContract("PrivacyGuarantees");
  deployed.PrivacyGuarantees = privacyGuarantees.address;

  const missionEnforcement = await deployContract("MissionEnforcement");
  deployed.MissionEnforcement = missionEnforcement.address;

  const antiSurveillance = await deployContract("AntiSurveillance");
  deployed.AntiSurveillance = antiSurveillance.address;

  const identityRegistry = await deployContract("ERC8004IdentityRegistry");
  deployed.ERC8004IdentityRegistry = identityRegistry.address;

  const beliefVerifier = await deployContract("BeliefAttestationVerifier");
  deployed.BeliefAttestationVerifier = beliefVerifier.address;

  const partnershipBonds = await deployContract("AIPartnershipBondsV2");
  deployed.AIPartnershipBondsV2 = partnershipBonds.address;

  const flourishingOracle = await deployContract("FlourishingMetricsOracle");
  deployed.FlourishingMetricsOracle = flourishingOracle.address;

  // ========================================================================
  // Phase 2 — Dependent contracts (require Phase 1 addresses)
  // ========================================================================
  console.log("-".repeat(60));
  console.log("  Phase 2: Dependent contracts (6 contracts)");
  console.log("-".repeat(60) + "\n");

  const reputationRegistry = await deployContract("ERC8004ReputationRegistry", [
    identityRegistry.address,
  ]);
  deployed.ERC8004ReputationRegistry = reputationRegistry.address;

  const validationRegistry = await deployContract("ERC8004ValidationRegistry", [
    identityRegistry.address,
    beliefVerifier.address,
  ]);
  deployed.ERC8004ValidationRegistry = validationRegistry.address;

  const accountabilityBonds = await deployContract("AIAccountabilityBondsV2", [
    HUMAN_TREASURY,
  ]);
  deployed.AIAccountabilityBondsV2 = accountabilityBonds.address;

  const adapter = await deployContract("VaultfireERC8004Adapter", [
    partnershipBonds.address,
    identityRegistry.address,
    reputationRegistry.address,
    validationRegistry.address,
  ]);
  deployed.VaultfireERC8004Adapter = adapter.address;

  const multisig = await deployContract("MultisigGovernance", [
    MULTISIG_SIGNERS,
    MULTISIG_THRESHOLD,
  ]);
  deployed.MultisigGovernance = multisig.address;

  const productionVerifier = await deployContract(
    "ProductionBeliefAttestationVerifier",
    [RISC_ZERO_VERIFIER_PLACEHOLDER, BELIEF_CIRCUIT_IMAGE_ID]
  );
  deployed.ProductionBeliefAttestationVerifier = productionVerifier.address;

  // ========================================================================
  // Save deployment manifest
  // ========================================================================
  const endTime = Date.now();
  const deploymentMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

  const manifest = {
    protocol: "Vaultfire",
    chain: "avalancheFuji",
    chainId: 43113,
    canonical: false,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    deploymentTimeMinutes: deploymentMinutes,
    contracts: deployed,
  };

  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

  // ========================================================================
  // Summary
  // ========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("  DEPLOYMENT COMPLETE — Avalanche Fuji Testnet");
  console.log("=".repeat(80) + "\n");
  console.log(`  Time: ${deploymentMinutes} minutes`);
  console.log(`  Manifest saved: ${OUTPUT_FILE}\n`);

  console.log("  Deployed contracts:\n");
  for (const [name, addr] of Object.entries(deployed)) {
    console.log(`    ${name}`);
    console.log(`      ${snowtraceUrl(addr)}\n`);
  }

  // ========================================================================
  // Verification commands
  // ========================================================================
  console.log("=".repeat(80));
  console.log("  CONTRACT VERIFICATION (Snowtrace / Routescan)");
  console.log("=".repeat(80) + "\n");
  console.log("  Run the following commands to verify each contract:\n");

  // No-arg contracts
  const noArgContracts = [
    "PrivacyGuarantees",
    "MissionEnforcement",
    "AntiSurveillance",
    "ERC8004IdentityRegistry",
    "BeliefAttestationVerifier",
    "AIPartnershipBondsV2",
    "FlourishingMetricsOracle",
  ];
  for (const name of noArgContracts) {
    console.log(
      `  npx hardhat verify --network avalancheFuji ${deployed[name]}`
    );
  }

  // Contracts with constructor args
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.ERC8004ReputationRegistry} "${deployed.ERC8004IdentityRegistry}"`
  );
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.ERC8004ValidationRegistry} "${deployed.ERC8004IdentityRegistry}" "${deployed.BeliefAttestationVerifier}"`
  );
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.AIAccountabilityBondsV2} "${HUMAN_TREASURY}"`
  );
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.VaultfireERC8004Adapter} "${deployed.AIPartnershipBondsV2}" "${deployed.ERC8004IdentityRegistry}" "${deployed.ERC8004ReputationRegistry}" "${deployed.ERC8004ValidationRegistry}"`
  );
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.MultisigGovernance} "[${MULTISIG_SIGNERS.map((s) => '"' + s + '"').join(",")}]" ${MULTISIG_THRESHOLD}`
  );
  console.log(
    `  npx hardhat verify --network avalancheFuji ${deployed.ProductionBeliefAttestationVerifier} "${RISC_ZERO_VERIFIER_PLACEHOLDER}" "${BELIEF_CIRCUIT_IMAGE_ID}"`
  );

  console.log("\n" + "=".repeat(80));
  console.log("  NEXT STEPS");
  console.log("=".repeat(80) + "\n");
  console.log("  1. Verify contracts using the commands above.");
  console.log("  2. Run the demo script:");
  console.log("       npx hardhat run scripts/demo-vaultfire.js --network avalancheFuji");
  console.log("  3. Update agent/.env with VAULTFIRE_CHAIN=avalancheFuji to point the");
  console.log("     Sentinel Agent at Fuji.");
  console.log("  4. Base mainnet remains the PRIMARY deployment.\n");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n  Deployment failed:\n");
    console.error(error);
    process.exit(1);
  });
