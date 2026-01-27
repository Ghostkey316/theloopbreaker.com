/**
 * Production RISC Zero Belief Attestation Verifier Deployment Script
 *
 * This script deploys the production-ready BeliefAttestationVerifierProduction contract
 * with real RISC Zero STARK verifier integration.
 *
 * CRITICAL PRE-DEPLOYMENT CHECKLIST:
 * 1. ✅ RISC Zero verifier contract deployed/located on target chain
 * 2. ✅ Belief attestation guest program compiled and imageId extracted
 * 3. ✅ Test proofs generated and validated locally
 * 4. ✅ Environment variables configured (.env file)
 * 5. ✅ Deployment wallet funded with gas
 *
 * Usage:
 *   npx hardhat run scripts/deploy-production-verifier.js --network base
 *   npx hardhat run scripts/deploy-production-verifier.js --network baseSepolia
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// RISC Zero Verifier Addresses (update these with actual deployed addresses)
const RISC_ZERO_VERIFIERS = {
    // Base Mainnet
    base: process.env.RISC_ZERO_VERIFIER_BASE || "0x0000000000000000000000000000000000000000",

    // Base Sepolia Testnet
    baseSepolia: process.env.RISC_ZERO_VERIFIER_BASE_SEPOLIA || "0x0000000000000000000000000000000000000000",

    // Ethereum Mainnet
    ethereum: process.env.RISC_ZERO_VERIFIER_ETHEREUM || "0x0000000000000000000000000000000000000000",

    // Local development
    localhost: process.env.RISC_ZERO_VERIFIER_LOCALHOST || "0x0000000000000000000000000000000000000000",
};

// Belief Circuit Image ID (generated during guest program compilation)
// This should be extracted from: risc0-prover/target/release/methods/BELIEF_ATTESTATION_ID
const BELIEF_CIRCUIT_IMAGE_ID = process.env.BELIEF_CIRCUIT_IMAGE_ID || "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    console.log("🚀 Deploying Vaultfire Production Belief Attestation Verifier\n");

    // Get network
    const network = await ethers.provider.getNetwork();
    const networkName = network.name;
    console.log(`📡 Network: ${networkName} (Chain ID: ${network.chainId})\n`);

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Get RISC Zero verifier address for this network
    const riscZeroVerifierAddress = RISC_ZERO_VERIFIERS[networkName];

    // Validate configuration
    console.log("🔍 Pre-Deployment Validation:\n");

    const validationChecks = [
        {
            name: "RISC Zero Verifier Address",
            value: riscZeroVerifierAddress,
            valid: riscZeroVerifierAddress !== "0x0000000000000000000000000000000000000000",
            error: "RISC Zero verifier address not configured. Set RISC_ZERO_VERIFIER_* in .env"
        },
        {
            name: "Belief Circuit Image ID",
            value: BELIEF_CIRCUIT_IMAGE_ID,
            valid: BELIEF_CIRCUIT_IMAGE_ID !== "0x0000000000000000000000000000000000000000000000000000000000000000",
            error: "Belief circuit imageId not configured. Compile guest program and set BELIEF_CIRCUIT_IMAGE_ID in .env"
        },
        {
            name: "Deployer Balance",
            value: `${ethers.formatEther(balance)} ETH`,
            valid: balance > ethers.parseEther("0.01"),
            error: "Insufficient ETH balance for deployment. Need at least 0.01 ETH for gas"
        }
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
        console.error("❌ Pre-deployment validation failed. Please fix the errors above.\n");
        process.exit(1);
    }

    console.log("\n✅ All validation checks passed!\n");

    // Verify RISC Zero verifier contract exists
    console.log("🔍 Verifying RISC Zero verifier contract...");
    const verifierCode = await ethers.provider.getCode(riscZeroVerifierAddress);
    if (verifierCode === "0x") {
        console.error(`❌ No contract found at RISC Zero verifier address: ${riscZeroVerifierAddress}`);
        console.error("   Please deploy RISC Zero verifier first or verify the address.\n");
        process.exit(1);
    }
    console.log("✅ RISC Zero verifier contract verified\n");

    // Deploy BeliefAttestationVerifierProduction
    console.log("📝 Deploying BeliefAttestationVerifierProduction...");
    const BeliefVerifierProduction = await ethers.getContractFactory("BeliefAttestationVerifierProduction");

    console.log(`   - RISC Zero Verifier: ${riscZeroVerifierAddress}`);
    console.log(`   - Belief Circuit ImageId: ${BELIEF_CIRCUIT_IMAGE_ID}\n`);

    const verifier = await BeliefVerifierProduction.deploy(
        riscZeroVerifierAddress,
        BELIEF_CIRCUIT_IMAGE_ID
    );

    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();

    console.log(`✅ BeliefAttestationVerifierProduction deployed: ${verifierAddress}\n`);

    // Verify deployment
    console.log("🔍 Verifying deployment configuration...");
    const deployedRiscZeroVerifier = await verifier.getRiscZeroVerifier();
    const deployedImageId = await verifier.getBeliefCircuitImageId();
    const proofSystemId = await verifier.getProofSystemId();
    const minBeliefThreshold = await verifier.getMinBeliefThreshold();

    console.log(`   - Configured RISC Zero Verifier: ${deployedRiscZeroVerifier}`);
    console.log(`   - Configured Image ID: ${deployedImageId}`);
    console.log(`   - Proof System ID: ${proofSystemId}`);
    console.log(`   - Min Belief Threshold: ${minBeliefThreshold / 100}%`);

    // Try to get RISC Zero version
    try {
        const riscZeroVersion = await verifier.getRiscZeroVersion();
        console.log(`   - RISC Zero Version: ${riscZeroVersion}`);
    } catch (error) {
        console.log(`   - RISC Zero Version: Unable to fetch (verifier may not support version())`);
    }

    console.log("\n✅ Deployment configuration verified!\n");

    // Save deployment info
    const deploymentInfo = {
        network: networkName,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            BeliefAttestationVerifierProduction: verifierAddress,
        },
        configuration: {
            riscZeroVerifier: riscZeroVerifierAddress,
            beliefCircuitImageId: BELIEF_CIRCUIT_IMAGE_ID,
            proofSystemId: proofSystemId,
            minBeliefThreshold: minBeliefThreshold.toString(),
        },
        gasUsed: {
            // Will be populated after deployment transaction is mined
        }
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `belief-verifier-production-${networkName}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

    // Update .env.production file
    const envProductionPath = path.join(__dirname, "..", ".env.production");
    const envContent = `# Vaultfire Production Deployment - ${new Date().toISOString()}
# Network: ${networkName} (Chain ID: ${network.chainId})

# RISC Zero Configuration
RISC_ZERO_VERIFIER_ADDRESS=${riscZeroVerifierAddress}
BELIEF_CIRCUIT_IMAGE_ID=${BELIEF_CIRCUIT_IMAGE_ID}

# Deployed Contracts
BELIEF_VERIFIER_PRODUCTION_ADDRESS=${verifierAddress}

# Deployment Info
DEPLOYER_ADDRESS=${deployer.address}
DEPLOYMENT_TIMESTAMP=${new Date().toISOString()}
`;

    fs.writeFileSync(envProductionPath, envContent);
    console.log(`✅ .env.production updated\n`);

    // Print next steps
    console.log("📋 NEXT STEPS:\n");
    console.log("1. ✅ Verify contract on Basescan:");
    console.log(`   npx hardhat verify --network ${networkName} ${verifierAddress} ${riscZeroVerifierAddress} ${BELIEF_CIRCUIT_IMAGE_ID}\n`);

    console.log("2. ✅ Test with real proofs:");
    console.log(`   npx hardhat test test/risc0-production-verifier.test.js --network ${networkName}\n`);

    console.log("3. ✅ Generate test proof:");
    console.log("   cd risc0-prover");
    console.log("   cargo run --release -- --belief-message \"Test belief\" --output test-proof.bin\n");

    console.log("4. ✅ Integrate with DilithiumAttestor:");
    console.log("   Update DilithiumAttestor deployment to use this verifier address\n");

    console.log("5. ✅ Set up monitoring:");
    console.log("   Monitor ProofVerified and ProofVerificationFailed events\n");

    console.log("6. ✅ Update documentation:");
    console.log("   Add verifier address to README.md and integration guides\n");

    console.log("🎉 Production Belief Attestation Verifier Deployment Complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
