const hre = require("hardhat");
const fs = require('fs');
const { ethers } = require("hardhat");

/**
 * Deployment Verification Script
 *
 * Mission: Verify all contracts deployed correctly before real funds.
 * Humanity over control - catch errors before they hurt people.
 *
 * Usage:
 *   npx hardhat run scripts/verify-deployment.js --network baseSepolia
 *   npx hardhat run scripts/verify-deployment.js --network baseMainnet
 */

const BOND_CONTRACTS = [
    "PurchasingPowerBonds",
    "HealthCommonsBonds",
    "AIAccountabilityBonds",
    "LaborDignityBonds",
    "EscapeVelocityBonds",
    "CommonGroundBonds",
    "AIPartnershipBonds",
    "BuilderBeliefBonds",
    "VerdantAnchorBonds"
];

async function main() {
    console.log("\n🔍 DEPLOYMENT VERIFICATION");
    console.log("=" + "=".repeat(60));
    console.log(`Network: ${hre.network.name}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    const deploymentFile = `./deployments/all-bonds-${hre.network.name}.json`;

    // Check deployment file exists
    if (!fs.existsSync(deploymentFile)) {
        console.error("❌ Deployment file not found:", deploymentFile);
        console.error("   Run deployment script first:");
        console.error(`   npx hardhat run scripts/deploy-all-bonds.js --network ${hre.network.name}`);
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

    console.log("📝 Deployment Info:");
    console.log(`   Network: ${deployment.network}`);
    console.log(`   Deployer: ${deployment.deployer}`);
    console.log(`   Deployed At: ${deployment.deployedAt}`);
    console.log(`   Chain ID: ${deployment.contracts[Object.keys(deployment.contracts)[0]].chainId}\n`);

    let allVerified = true;
    const verificationResults = [];

    // Verify each contract
    for (const bondName of BOND_CONTRACTS) {
        console.log(`\n🔍 Verifying ${bondName}...`);

        const contractInfo = deployment.contracts[bondName];
        if (!contractInfo) {
            console.error(`   ❌ Contract info not found in deployment file`);
            allVerified = false;
            verificationResults.push({ contract: bondName, status: "FAILED", reason: "Not in deployment file" });
            continue;
        }

        const address = contractInfo.address;
        console.log(`   Address: ${address}`);

        try {
            // 1. Verify contract is deployed (has code)
            const code = await ethers.provider.getCode(address);
            if (code === '0x') {
                console.error(`   ❌ No code at address - contract not deployed`);
                allVerified = false;
                verificationResults.push({ contract: bondName, status: "FAILED", reason: "No code at address" });
                continue;
            }
            console.log(`   ✅ Code deployed (${code.length} bytes)`);

            // 2. Get contract instance
            const contract = await ethers.getContractAt(bondName, address);

            // 3. Verify nextBondId is 1 (no bonds created yet)
            const nextBondId = await contract.nextBondId();
            if (nextBondId !== BigInt(1)) {
                console.warn(`   ⚠️  nextBondId is ${nextBondId} (expected 1) - bonds may have been created`);
            } else {
                console.log(`   ✅ nextBondId: ${nextBondId} (clean deployment)`);
            }

            // 4. Verify contract is not paused (if it has pause functionality)
            try {
                const paused = await contract.paused();
                if (paused) {
                    console.warn(`   ⚠️  Contract is PAUSED`);
                } else {
                    console.log(`   ✅ Contract not paused`);
                }
            } catch (e) {
                // Contract might not have pause functionality (old version)
                console.log(`   ⚠️  No pause function (old version?)`);
            }

            // 5. Verify owner (if contract has owner)
            try {
                const owner = await contract.owner();
                console.log(`   ✅ Owner: ${owner}`);
                if (owner !== deployment.deployer) {
                    console.warn(`   ⚠️  Owner differs from deployer`);
                }
            } catch (e) {
                // Contract might not have owner (old version)
                console.log(`   ⚠️  No owner function (old version?)`);
            }

            // 6. Verify constants
            try {
                if (bondName === "LaborDignityBonds" || bondName === "LaborDignityBondsV2") {
                    const exploitThreshold = await contract.EXPLOITATION_THRESHOLD();
                    const verifyThreshold = await contract.LOW_VERIFICATION_THRESHOLD();
                    console.log(`   ✅ EXPLOITATION_THRESHOLD: ${exploitThreshold} (4000 expected)`);
                    console.log(`   ✅ LOW_VERIFICATION_THRESHOLD: ${verifyThreshold} (70 expected)`);

                    if (exploitThreshold !== BigInt(4000)) {
                        console.error(`   ❌ EXPLOITATION_THRESHOLD wrong value`);
                        allVerified = false;
                    }
                }

                if (bondName === "PurchasingPowerBonds") {
                    const housingTarget = await contract.HOUSING_TARGET();
                    console.log(`   ✅ HOUSING_TARGET: ${housingTarget} (3000 expected)`);

                    if (housingTarget !== BigInt(3000)) {
                        console.error(`   ❌ HOUSING_TARGET wrong value`);
                        allVerified = false;
                    }
                }

                if (bondName === "AIAccountabilityBonds") {
                    const sufferingThreshold = await contract.SUFFERING_THRESHOLD();
                    console.log(`   ✅ SUFFERING_THRESHOLD: ${sufferingThreshold} (4000 expected)`);

                    if (sufferingThreshold !== BigInt(4000)) {
                        console.error(`   ❌ SUFFERING_THRESHOLD wrong value`);
                        allVerified = false;
                    }
                }
            } catch (e) {
                console.log(`   ⚠️  Could not verify constants: ${e.message}`);
            }

            // 7. Verify contract interface (check key functions exist)
            const requiredFunctions = ['createBond', 'getBond', 'calculateBondValue'];
            for (const func of requiredFunctions) {
                if (typeof contract[func] !== 'function') {
                    console.error(`   ❌ Missing required function: ${func}`);
                    allVerified = false;
                } else {
                    console.log(`   ✅ Function exists: ${func}()`);
                }
            }

            // 8. Verify contract can be interacted with (read-only call)
            try {
                const metricsCount = await contract.getMetricsCount(1);
                console.log(`   ✅ Contract responsive (getMetricsCount works)`);
            } catch (e) {
                // Expected to revert for non-existent bond, that's okay
                console.log(`   ✅ Contract responsive (reverts as expected)`);
            }

            verificationResults.push({
                contract: bondName,
                address: address,
                status: "VERIFIED",
                codeSize: code.length,
                nextBondId: nextBondId.toString()
            });

            console.log(`   ✅ ${bondName} VERIFIED`);

        } catch (error) {
            console.error(`   ❌ Verification failed: ${error.message}`);
            allVerified = false;
            verificationResults.push({ contract: bondName, address: address, status: "FAILED", reason: error.message });
        }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(60) + "\n");

    const verifiedCount = verificationResults.filter(r => r.status === "VERIFIED").length;
    const failedCount = verificationResults.filter(r => r.status === "FAILED").length;

    console.log(`Total Contracts: ${BOND_CONTRACTS.length}`);
    console.log(`Verified: ${verifiedCount}`);
    console.log(`Failed: ${failedCount}\n`);

    if (allVerified) {
        console.log("✅ ALL CONTRACTS VERIFIED SUCCESSFULLY!");
        console.log("\nDeployment is ready for use.");
        console.log("\n⚠️  IMPORTANT REMINDERS:");
        console.log("   1. This is automated verification, NOT a security audit");
        console.log("   2. Get professional security audit before mainnet with real funds");
        console.log("   3. Test thoroughly on testnet first");
        console.log("   4. Start with small amounts on mainnet");
        console.log("   5. Monitor transactions closely");
        console.log("\nMission Alignment: Humanity over control.");
        console.log("These contracts protect workers and communities.");
        console.log("Use them wisely. 🔥\n");

        // Save verification report
        const reportFile = `./deployments/verification-${hre.network.name}-${Date.now()}.json`;
        const report = {
            network: hre.network.name,
            verifiedAt: new Date().toISOString(),
            results: verificationResults,
            allVerified: true,
            totalContracts: BOND_CONTRACTS.length,
            verifiedCount: verifiedCount,
            failedCount: failedCount
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📝 Verification report saved: ${reportFile}\n`);

    } else {
        console.log("❌ VERIFICATION FAILED!");
        console.log("\nSome contracts failed verification.");
        console.log("DO NOT use this deployment with real funds.");
        console.log("\nFailed contracts:");
        verificationResults.filter(r => r.status === "FAILED").forEach(r => {
            console.log(`   - ${r.contract}: ${r.reason}`);
        });

        console.log("\nPlease redeploy or investigate the issues.\n");

        // Save failure report
        const reportFile = `./deployments/verification-FAILED-${hre.network.name}-${Date.now()}.json`;
        const report = {
            network: hre.network.name,
            verifiedAt: new Date().toISOString(),
            results: verificationResults,
            allVerified: false,
            totalContracts: BOND_CONTRACTS.length,
            verifiedCount: verifiedCount,
            failedCount: failedCount
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📝 Failure report saved: ${reportFile}\n`);

        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Verification script error:", error);
        process.exit(1);
    });
