// Simple Base Sepolia Testnet Deployment Script
// Deploys core Vaultfire contracts to testnet

const hre = require("hardhat");

async function main() {
    console.log("\n🔥 VAULTFIRE TESTNET DEPLOYMENT 🔥\n");
    console.log("Network:", hre.network.name);

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying from:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

    if (balance === 0n) {
        console.error("❌ No ETH in wallet! Get testnet ETH from faucet first.");
        process.exit(1);
    }

    const deployedContracts = {};

    // 1. Deploy BaseYieldPoolBond (will fail - it's abstract, but that's ok)
    // We'll deploy the concrete implementations instead

    // 2. Deploy AIAccountabilityBondsV2
    console.log("📝 Deploying AIAccountabilityBondsV2...");
    const humanTreasury = deployer.address; // Use deployer as treasury for testnet

    const AIAccountabilityBondsV2 = await hre.ethers.getContractFactory("AIAccountabilityBondsV2");
    const accountabilityBonds = await AIAccountabilityBondsV2.deploy(humanTreasury);
    await accountabilityBonds.waitForDeployment();
    const accountabilityAddress = await accountabilityBonds.getAddress();
    console.log("✅ AIAccountabilityBondsV2:", accountabilityAddress);
    deployedContracts.AIAccountabilityBondsV2 = accountabilityAddress;

    // 3. Deploy AIPartnershipBondsV2
    console.log("\n📝 Deploying AIPartnershipBondsV2...");
    const AIPartnershipBondsV2 = await hre.ethers.getContractFactory("AIPartnershipBondsV2");
    const partnershipBonds = await AIPartnershipBondsV2.deploy();
    await partnershipBonds.waitForDeployment();
    const partnershipAddress = await partnershipBonds.getAddress();
    console.log("✅ AIPartnershipBondsV2:", partnershipAddress);
    deployedContracts.AIPartnershipBondsV2 = partnershipAddress;

    // 4. Deploy MultiOracleConsensus
    console.log("\n📝 Deploying MultiOracleConsensus...");
    const MultiOracleConsensus = await hre.ethers.getContractFactory("MultiOracleConsensus");
    const oracleConsensus = await MultiOracleConsensus.deploy();
    await oracleConsensus.waitForDeployment();
    const oracleAddress = await oracleConsensus.getAddress();
    console.log("✅ MultiOracleConsensus:", oracleAddress);
    deployedContracts.MultiOracleConsensus = oracleAddress;

    // 5. Deploy AntiSurveillance
    console.log("\n📝 Deploying AntiSurveillance...");
    const AntiSurveillance = await hre.ethers.getContractFactory("AntiSurveillance");
    const antiSurveillance = await AntiSurveillance.deploy();
    await antiSurveillance.waitForDeployment();
    const antiSurvAddress = await antiSurveillance.getAddress();
    console.log("✅ AntiSurveillance:", antiSurvAddress);
    deployedContracts.AntiSurveillance = antiSurvAddress;

    // 6. Deploy PrivacyGuarantees
    console.log("\n📝 Deploying PrivacyGuarantees...");
    const PrivacyGuarantees = await hre.ethers.getContractFactory("PrivacyGuarantees");
    const privacyGuarantees = await PrivacyGuarantees.deploy();
    await privacyGuarantees.waitForDeployment();
    const privacyAddress = await privacyGuarantees.getAddress();
    console.log("✅ PrivacyGuarantees:", privacyAddress);
    deployedContracts.PrivacyGuarantees = privacyAddress;

    // 7. Deploy MissionEnforcement
    console.log("\n📝 Deploying MissionEnforcement...");
    const MissionEnforcement = await hre.ethers.getContractFactory("MissionEnforcement");
    const missionEnforcement = await MissionEnforcement.deploy();
    await missionEnforcement.waitForDeployment();
    const missionAddress = await missionEnforcement.getAddress();
    console.log("✅ MissionEnforcement:", missionAddress);
    deployedContracts.MissionEnforcement = missionAddress;

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
        network: "baseSepolia",
        chainId: 84532,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: deployedContracts
    };

    fs.writeFileSync(
        'deployment/testnet-deployment.json',
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE! 🎉");
    console.log("=".repeat(60));
    console.log("\n📋 Deployment Summary:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
        console.log(`   ${name}: ${address}`);
    });

    console.log("\n🔍 View on BaseScan:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
        console.log(`   ${name}: https://sepolia.basescan.org/address/${address}`);
    });

    console.log("\n💾 Deployment info saved to: deployment/testnet-deployment.json");
    console.log("\n✅ All contracts are live on Base Sepolia testnet!");
    console.log("\n🔥 Vaultfire is now running on testnet! 🔥\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
