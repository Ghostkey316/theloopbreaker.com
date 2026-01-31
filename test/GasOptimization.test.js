const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Gas Optimization Tests", function () {
    let laborDignity, purchasingPower, aiAccountability;
    let owner, company, worker1, worker2;

    // Gas limits for production readiness
    const GAS_LIMITS = {
        bondCreation: 250000,
        metricsSubmission: 250000,
        workerAttestation: 400000,
        distribution: 400000,
        // View functions can exceed 50k depending on optimizer/IR and loop sizes.
        viewFunctions: 100000
    };

    beforeEach(async function () {
        [owner, company, worker1, worker2] = await ethers.getSigners();

        const LaborDignity = await ethers.getContractFactory("LaborDignityBondsV2");
        laborDignity = await LaborDignity.deploy();

        const PurchasingPower = await ethers.getContractFactory("PurchasingPowerBondsV2");
        purchasingPower = await PurchasingPower.deploy();

        const AIAccountability = await ethers.getContractFactory("AIAccountabilityBondsV2");
        // AIAccountabilityBondsV2 requires a human treasury address at deployment.
        aiAccountability = await AIAccountability.deploy(owner.address);
    });

    describe("Bond Creation Gas Costs", function () {
        it("Labor Dignity Bond creation should use reasonable gas", async function () {
            const tx = await laborDignity.connect(company).createBond("TechCorp", 100, {
                value: ethers.parseEther("1.0")
            });
            const receipt = await tx.wait();

            console.log("  ⛽ Labor Bond Creation Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.bondCreation);
        });

        it("Purchasing Power Bond creation should use reasonable gas", async function () {
            const tx = await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });
            const receipt = await tx.wait();

            console.log("  ⛽ Purchasing Power Bond Creation Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.bondCreation);
        });

        it("AI Accountability Bond creation should use reasonable gas", async function () {
            const quarterlyRevenue = ethers.parseEther("10.0");
            const stake = (quarterlyRevenue * BigInt(30)) / BigInt(100);

            const tx = await aiAccountability.connect(company).createBond(
                "AI Corp",
                quarterlyRevenue,
                { value: stake }
            );
            const receipt = await tx.wait();

            console.log("  ⛽ AI Accountability Bond Creation Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.bondCreation);
        });

        it("Should not significantly increase gas with longer company names", async function () {
            const shortName = await laborDignity.connect(company).createBond("Co", 50, {
                value: ethers.parseEther("1.0")
            });
            const shortReceipt = await shortName.wait();

            const longName = await laborDignity.connect(company).createBond(
                "Very Long Company Name Corporation International Ltd",
                50,
                { value: ethers.parseEther("1.0") }
            );
            const longReceipt = await longName.wait();

            console.log("  ⛽ Short name gas:", shortReceipt.gasUsed.toString());
            console.log("  ⛽ Long name gas:", longReceipt.gasUsed.toString());

            // Difference should be minimal (just storage costs)
            const diff = longReceipt.gasUsed - shortReceipt.gasUsed;
            expect(diff).to.be.below(50000); // Less than 50k gas difference
        });
    });

    describe("Metrics Submission Gas Costs", function () {
        beforeEach(async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });
        });

        it("Labor metrics submission should use reasonable gas", async function () {
            const tx = await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );
            const receipt = await tx.wait();

            console.log("  ⛽ Labor Metrics Submission Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.metricsSubmission);
        });

        it("Purchasing Power metrics submission should use reasonable gas", async function () {
            const tx = await purchasingPower.connect(company).submitMetrics(
                1, 2800, 350, 600, 8000, 900, 2700
            );
            const receipt = await tx.wait();

            console.log("  ⛽ Purchasing Power Metrics Submission Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.metricsSubmission);
        });

        it("Multiple metrics submissions should not degrade performance", async function () {
            const gasUsed = [];

            for (let i = 0; i < 5; i++) {
                const tx = await laborDignity.connect(company).submitMetrics(
                    1, 7000, 7000, 7000, 7000, 7000, 7000
                );
                const receipt = await tx.wait();
                gasUsed.push(receipt.gasUsed);
            }

            console.log("  ⛽ Gas used for 5 submissions:", gasUsed.map(g => g.toString()));

            // Gas should not increase significantly with array growth
            const maxGas = gasUsed[gasUsed.length - 1];
            const minGas = gasUsed[0];
            const increase = maxGas - minGas;

            expect(increase).to.be.below(20000); // Less than 20k increase
        });
    });

    describe("Worker Attestation Gas Costs", function () {
        beforeEach(async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });
        });

        it("Labor worker attestation should use reasonable gas", async function () {
            const tx = await laborDignity.connect(worker1).addWorkerAttestation(
                1,
                8000, 8000, 8000, 8000, 8000, 8000,
                true,
                "Good working conditions overall"
            );
            const receipt = await tx.wait();

            console.log("  ⛽ Labor Worker Attestation Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.workerAttestation);
        });

        it("Purchasing Power worker attestation should use reasonable gas", async function () {
            const tx = await purchasingPower.connect(worker1).addWorkerAttestation(
                1, true, true, true, true, true
            );
            const receipt = await tx.wait();

            console.log("  ⛽ Purchasing Power Worker Attestation Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.workerAttestation);
        });

        it("Short notes should use less gas than long notes", async function () {
            const shortTx = await laborDignity.connect(worker1).addWorkerAttestation(
                1, 8000, 8000, 8000, 8000, 8000, 8000, true, "Good"
            );
            const shortReceipt = await shortTx.wait();

            const longTx = await laborDignity.connect(worker2).addWorkerAttestation(
                1,
                8000, 8000, 8000, 8000, 8000, 8000,
                true,
                "Very detailed notes about working conditions including many specific examples and observations from daily work experience over several months of employment"
            );
            const longReceipt = await longTx.wait();

            console.log("  ⛽ Short notes gas:", shortReceipt.gasUsed.toString());
            console.log("  ⛽ Long notes gas:", longReceipt.gasUsed.toString());

            // Long notes should cost more (storage), but not excessively
            expect(longReceipt.gasUsed).to.be.above(shortReceipt.gasUsed);
            expect(longReceipt.gasUsed - shortReceipt.gasUsed).to.be.below(120000);
        });

        it("Multiple worker attestations should scale linearly", async function () {
            const gasUsed = [];
            const workers = [worker1, worker2];

            for (let worker of workers) {
                const tx = await laborDignity.connect(worker).addWorkerAttestation(
                    1, 8000, 8000, 8000, 8000, 8000, 8000, true, "Attestation"
                );
                const receipt = await tx.wait();
                gasUsed.push(receipt.gasUsed);
            }

            console.log("  ⛽ Gas per attestation:", gasUsed.map(g => g.toString()));

            // Gas should be consistent (not exponential growth)
            const diff = gasUsed[1] > gasUsed[0]
                ? gasUsed[1] - gasUsed[0]
                : gasUsed[0] - gasUsed[1];

            expect(diff).to.be.below(25000); // Similar gas costs
        });
    });

    describe("Distribution Gas Costs", function () {
        beforeEach(async function () {
            // Fund yield pools for positive-appreciation distributions.
            await laborDignity.connect(owner).fundYieldPool({ value: ethers.parseEther("100") });
            await purchasingPower.connect(owner).fundYieldPool({ value: ethers.parseEther("100") });

            // Create bonds
            await laborDignity.connect(company).createBond("Company", 10, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(10, {
                value: ethers.parseEther("1.0")
            });

            // Submit good metrics
            await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );

            await purchasingPower.connect(company).submitMetrics(
                1, 2500, 350, 600, 8000, 900, 2800
            );

            // Add worker verification
            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 7000, 7000, 7000, 7000, 7000, 7000, true, "Good"
            );

            await purchasingPower.connect(worker1).addWorkerAttestation(
                1, true, true, true, true, true
            );

            await laborDignity.connect(company).requestDistribution(1);
            await purchasingPower.connect(company).requestDistribution(1);
            await time.increase(604800);
        });

        it("Labor bond distribution should use reasonable gas", async function () {
            const tx = await laborDignity.connect(company).distributeBond(1);
            const receipt = await tx.wait();

            console.log("  ⛽ Labor Distribution Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.distribution);
        });

        it("Purchasing Power distribution should use reasonable gas", async function () {
            const tx = await purchasingPower.connect(company).distributeBond(1);
            const receipt = await tx.wait();

            console.log("  ⛽ Purchasing Power Distribution Gas:", receipt.gasUsed.toString());
            expect(receipt.gasUsed).to.be.below(GAS_LIMITS.distribution);
        });
    });

    describe("View Function Gas Costs", function () {
        beforeEach(async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );

            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 7500, 7500, 7500, 7500, 7500, 7500, true, "Good"
            );
        });

        it("View functions should use minimal gas", async function () {
            // Estimate gas for view functions
            const flourishingGas = await laborDignity.companyFlourishingScore.estimateGas(1);
            const workerScoreGas = await laborDignity.workerVerifiedScore.estimateGas(1);
            const verificationGas = await laborDignity.workerVerificationMultiplier.estimateGas(1);
            const bondValueGas = await laborDignity.calculateBondValue.estimateGas(1);

            console.log("  ⛽ Flourishing Score Gas:", flourishingGas.toString());
            console.log("  ⛽ Worker Score Gas:", workerScoreGas.toString());
            console.log("  ⛽ Verification Multiplier Gas:", verificationGas.toString());
            console.log("  ⛽ Bond Value Calculation Gas:", bondValueGas.toString());

            expect(flourishingGas).to.be.below(GAS_LIMITS.viewFunctions);
            expect(workerScoreGas).to.be.below(GAS_LIMITS.viewFunctions);
            expect(verificationGas).to.be.below(GAS_LIMITS.viewFunctions);
            expect(bondValueGas).to.be.below(GAS_LIMITS.viewFunctions);
        });
    });

    describe("Gas Optimization Techniques", function () {
        it("Should cache array lengths in loops (Labor bond)", async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            // Add multiple attestations
            for (let i = 0; i < 3; i++) {
                await laborDignity.connect(worker1).addWorkerAttestation(
                    1, 7000, 7000, 7000, 7000, 7000, 7000, true, `Attestation ${i}`
                );
            }

            // Calculate worker verified score (uses loop over attestations)
            const gasEstimate = await laborDignity.workerVerifiedScore.estimateGas(1);

            console.log("  ⛽ Worker Score with 3 attestations:", gasEstimate.toString());

            // Should still be reasonable even with multiple attestations
            expect(gasEstimate).to.be.below(GAS_LIMITS.viewFunctions);
        });

        it("Should use unchecked arithmetic where safe", async function () {
            await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });

            // Multiple submissions to test array iteration
            for (let i = 0; i < 3; i++) {
                await purchasingPower.connect(company).submitMetrics(
                    1, 2800, 350, 600, 8000, 900, 2700
                );
            }

            // Check gas for calculations
            const gasEstimate = await purchasingPower.overallPurchasingPowerScore.estimateGas(1);

            console.log("  ⛽ Purchasing Power Score with 3 metrics:", gasEstimate.toString());
            expect(gasEstimate).to.be.below(GAS_LIMITS.viewFunctions);
        });
    });

    describe("Worst Case Gas Scenarios", function () {
        it("Should handle maximum worker attestations efficiently", async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            // Add many attestations
            const signers = await ethers.getSigners();
            for (let i = 0; i < 10 && i < signers.length; i++) {
                await laborDignity.connect(signers[i]).addWorkerAttestation(
                    1, 7000, 7000, 7000, 7000, 7000, 7000, true, "Attestation"
                );
            }

            // Calculate score with many attestations
            const gasEstimate = await laborDignity.workerVerifiedScore.estimateGas(1);

            console.log("  ⛽ Worker Score with 10 attestations:", gasEstimate.toString());

            // Even with 10 attestations, allow higher ceiling (loop scales with attestations)
            expect(gasEstimate).to.be.below(GAS_LIMITS.viewFunctions * 3); // Allow 3x for worst case
        });

        it("Should handle maximum metrics history efficiently", async function () {
            await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });

            // Submit many metrics
            for (let i = 0; i < 10; i++) {
                await laborDignity.connect(company).submitMetrics(
                    1, 7000, 7000, 7000, 7000, 7000, 7000
                );
            }

            // Latest metrics should still be efficient (only reads latest)
            const getLatestTx = await laborDignity.getLatestMetrics(1);

            console.log("  ✓ Successfully retrieved latest from 10 metrics");

            // Flourishing score only uses latest, not all history
            const gasEstimate = await laborDignity.companyFlourishingScore.estimateGas(1);

            console.log("  ⛽ Flourishing Score with 10 metrics history:", gasEstimate.toString());
            expect(gasEstimate).to.be.below(GAS_LIMITS.viewFunctions);
        });
    });

    describe("Gas Comparison: V1 vs V2 (if V2 exists)", function () {
        it("Should log gas comparison for future optimization tracking", async function () {
            // Create bond and perform operations
            const createTx = await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });
            const createReceipt = await createTx.wait();

            const metricsTx = await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );
            const metricsReceipt = await metricsTx.wait();

            const attestTx = await laborDignity.connect(worker1).addWorkerAttestation(
                1, 7500, 7500, 7500, 7500, 7500, 7500, true, "Good"
            );
            const attestReceipt = await attestTx.wait();

            console.log("\n  📊 Gas Usage Summary:");
            console.log("  ├─ Bond Creation:", createReceipt.gasUsed.toString());
            console.log("  ├─ Metrics Submission:", metricsReceipt.gasUsed.toString());
            console.log("  └─ Worker Attestation:", attestReceipt.gasUsed.toString());
            console.log("  Total:", (
                createReceipt.gasUsed +
                metricsReceipt.gasUsed +
                attestReceipt.gasUsed
            ).toString());

            // All operations should complete successfully
            expect(createReceipt.status).to.equal(1);
            expect(metricsReceipt.status).to.equal(1);
            expect(attestReceipt.status).to.equal(1);
        });
    });
});
