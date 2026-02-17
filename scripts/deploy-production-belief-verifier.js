/**
 * Deploy ProductionBeliefAttestationVerifier
 *
 * Production-grade RISC Zero verifier with 48-hour timelock for Image ID
 * updates.  This contract replaces the development-mode
 * BeliefAttestationVerifier that reverts on mainnet.
 *
 * Security Enhancement — Professional Security Audit 2026
 *
 * Prerequisites:
 *   1. RISC Zero verifier router deployed/located on target chain
 *   2. Belief attestation guest program compiled and imageId extracted
 *   3. Test proofs generated and validated locally
 *   4. Deployer wallet funded with gas
 *   5. PRIVATE_KEY set in .env
 *
 * Environment variables:
 *   RISC_ZERO_VERIFIER_BASE — Address of RiscZeroVerifierRouter on Base Mainnet
 *                              (default: 0x0b144e07a0826182b6b59788c34b32bfa86fb711)
 *   BELIEF_CIRCUIT_IMAGE_ID  — Image ID from `cargo risczero build` output
 *
 * Usage:
 *   npx hardhat run scripts/deploy-production-belief-verifier.js --network base
 *   npx hardhat run scripts/deploy-production-belief-verifier.js --network baseSepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// RISC Zero Verifier Router addresses per network
const RISC_ZERO_VERIFIERS = {
  base:
    process.env.RISC_ZERO_VERIFIER_BASE ||
    "0x0b144e07a0826182b6b59788c34b32bfa86fb711",
  baseSepolia:
    process.env.RISC_ZERO_VERIFIER_BASE_SEPOLIA ||
    "0x0000000000000000000000000000000000000000",
  localhost:
    process.env.RISC_ZERO_VERIFIER_LOCALHOST ||
    "0x0000000000000000000000000000000000000000",
};

// Belief circuit image ID — extracted from `cargo risczero build`
const BELIEF_CIRCUIT_IMAGE_ID =
  process.env.BELIEF_CIRCUIT_IMAGE_ID ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🛡️  VAULTFIRE PRODUCTION BELIEF ATTESTATION VERIFIER DEPLOYMENT");
  console.log("=".repeat(80) + "\n");

  // ── Network & Deployer ──────────────────────────────────────────────────

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name;

  console.log(`📡 Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // ── Configuration ───────────────────────────────────────────────────────

  const riscZeroVerifierAddress = RISC_ZERO_VERIFIERS[networkName];

  // ── Validation ──────────────────────────────────────────────────────────

  console.log("🔍 Pre-Deployment Validation:\n");

  const validationChecks = [
    {
      name: "RISC Zero Verifier Address",
      value: riscZeroVerifierAddress,
      valid:
        riscZeroVerifierAddress &&
        riscZeroVerifierAddress !==
          "0x0000000000000000000000000000000000000000",
      error:
        "RISC Zero verifier address not configured. Set RISC_ZERO_VERIFIER_BASE in .env",
    },
    {
      name: "Belief Circuit Image ID",
      value: BELIEF_CIRCUIT_IMAGE_ID,
      valid:
        BELIEF_CIRCUIT_IMAGE_ID !==
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      error:
        "Belief circuit imageId not configured. Compile guest program and set BELIEF_CIRCUIT_IMAGE_ID in .env",
    },
    {
      name: "Deployer Balance",
      value: `${hre.ethers.formatEther(balance)} ETH`,
      valid: balance > hre.ethers.parseEther("0.01"),
      error:
        "Insufficient ETH balance for deployment. Need at least 0.01 ETH for gas",
    },
  ];

  let allValid = true;
  for (const check of validationChecks) {
    const status = check.valid ? "✅" : "❌";
    console.log(`${status} ${check.name}: ${check.value}`);
    if (!check.valid) {
      console.error(`   ERROR: ${check.error}\n`);
      allValid = false;
    }
  }

  if (!allValid) {
    console.error(
      "\n❌ Pre-deployment validation failed. Please fix the errors above.\n"
    );
    process.exit(1);
  }

  console.log("\n✅ All validation checks passed!\n");

  // Verify RISC Zero verifier contract exists on-chain
  console.log("🔍 Verifying RISC Zero verifier contract...");
  const verifierCode = await hre.ethers.provider.getCode(
    riscZeroVerifierAddress
  );
  if (verifierCode === "0x") {
    console.error(
      `❌ No contract found at RISC Zero verifier address: ${riscZeroVerifierAddress}`
    );
    console.error(
      "   Please deploy RISC Zero verifier first or verify the address.\n"
    );
    process.exit(1);
  }
  console.log("✅ RISC Zero verifier contract verified\n");

  // ── Deployment ──────────────────────────────────────────────────────────

  console.log("📦 Deploying ProductionBeliefAttestationVerifier...\n");
  console.log(`   RISC Zero Verifier: ${riscZeroVerifierAddress}`);
  console.log(`   Image ID: ${BELIEF_CIRCUIT_IMAGE_ID}\n`);

  const ProductionVerifier = await hre.ethers.getContractFactory(
    "ProductionBeliefAttestationVerifier"
  );
  const verifier = await ProductionVerifier.deploy(
    riscZeroVerifierAddress,
    BELIEF_CIRCUIT_IMAGE_ID
  );
  await verifier.waitForDeployment();

  const verifierAddress = await verifier.getAddress();
  const deployTx = verifier.deploymentTransaction();

  console.log(
    `✅ ProductionBeliefAttestationVerifier deployed: ${verifierAddress}`
  );
  console.log(`📝 TX: ${deployTx.hash}\n`);

  // ── Post-Deployment Verification ────────────────────────────────────────

  console.log("🔍 Verifying deployment...\n");

  const deployedOwner = await verifier.owner();
  const deployedImageId = await verifier.getImageId();
  const deployedRiscZero = await verifier.getRiscZeroVerifier();
  const timelockDelay = await verifier.getTimelockDelay();
  const proofSystemId = await verifier.getProofSystemId();
  const minBeliefThreshold = await verifier.getMinBeliefThreshold();

  console.log(`   Owner: ${deployedOwner}`);
  console.log(`   RISC Zero Verifier: ${deployedRiscZero}`);
  console.log(`   Image ID: ${deployedImageId}`);
  console.log(`   Timelock Delay: ${Number(timelockDelay) / 3600} hours`);
  console.log(`   Proof System: ${proofSystemId}`);
  console.log(
    `   Min Belief Threshold: ${Number(minBeliefThreshold) / 100}%`
  );

  // Verify no pending image ID change
  const [pendingId, effectiveAt, isReady] =
    await verifier.getPendingImageIdChange();
  console.log(
    `   Pending Image ID Change: ${pendingId === hre.ethers.ZeroHash ? "None" : pendingId}`
  );

  if (deployedOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\n❌ Owner mismatch after deployment!");
    process.exit(1);
  }

  console.log("\n✅ Deployment verified!\n");

  // ── Verification on Basescan ────────────────────────────────────────────

  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("⏳ Waiting for block confirmations...");
    await deployTx.wait(6);

    console.log("🔍 Verifying contract on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: verifierAddress,
        constructorArguments: [
          riscZeroVerifierAddress,
          BELIEF_CIRCUIT_IMAGE_ID,
        ],
      });
      console.log("✅ Contract verified on Basescan\n");
    } catch (error) {
      console.log(`⚠️  Verification failed: ${error.message}\n`);
    }
  }

  // ── Save Deployment Info ────────────────────────────────────────────────

  const deploymentInfo = {
    contract: "ProductionBeliefAttestationVerifier",
    network: networkName,
    chainId: network.chainId.toString(),
    address: verifierAddress,
    deployer: deployer.address,
    tx: deployTx.hash,
    timestamp: new Date().toISOString(),
    configuration: {
      riscZeroVerifier: riscZeroVerifierAddress,
      imageId: BELIEF_CIRCUIT_IMAGE_ID,
      timelockDelayHours: Number(timelockDelay) / 3600,
      proofSystemId: proofSystemId,
      minBeliefThreshold: Number(minBeliefThreshold),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `production-belief-verifier-${networkName}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

  // ── Summary & Next Steps ────────────────────────────────────────────────

  console.log("=".repeat(80));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(80) + "\n");

  console.log(
    `ProductionBeliefAttestationVerifier: ${verifierAddress}`
  );
  console.log(`Owner: ${deployedOwner}`);
  console.log(`RISC Zero Verifier: ${deployedRiscZero}`);
  console.log(`Image ID Timelock: 48 hours\n`);

  console.log("🎯 Next Steps:\n");
  console.log("1. Test with a real proof:");
  console.log(
    "   cd risc0-prover && cargo run --release -- --belief-message \"Test\" --output test-proof.bin\n"
  );
  console.log(
    "2. Update DilithiumAttestor to reference this verifier address\n"
  );
  console.log("3. Transfer ownership to MultisigGovernance:");
  console.log(
    "   verifier.transferOwnership(multisigGovernanceAddress)\n"
  );
  console.log("4. To update the Image ID (after ownership transfer):");
  console.log(
    "   a. Propose via multisig: verifier.proposeImageIdChange(newImageId)"
  );
  console.log("   b. Wait 48 hours");
  console.log(
    "   c. Execute via multisig: verifier.executeImageIdChange()\n"
  );
  console.log(
    `5. View on BaseScan: https://basescan.org/address/${verifierAddress}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
