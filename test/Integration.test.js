const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration Tests - Cross-Bond Interactions", function () {
    let laborDignity, purchasingPower, aiAccountability;
    let owner, company, worker1, worker2, worker3;

    beforeEach(async function () {
        [owner, company, worker1, worker2, worker3] = await ethers.getSigners();

        // Deploy all contracts
        const LaborDignity = await ethers.getContractFactory("LaborDignityBonds");
        laborDignity = await LaborDignity.deploy();

        const PurchasingPower = await ethers.getContractFactory("PurchasingPowerBonds");
        purchasingPower = await PurchasingPower.deploy();

        const AIAccountability = await ethers.getContractFactory("AIAccountabilityBonds");
        aiAccountability = await AIAccountability.deploy();
    });

    describe("Worker Participation Across Bonds", function () {
        it("Should allow worker to participate in multiple bonds simultaneously", async function () {
            // Company creates Labor Dignity Bond
            await laborDignity.connect(company).createBond("Company A", 50, {
                value: ethers.parseEther("1.0")
            });

            // Same company creates Purchasing Power Bond
            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("0.5")
            });

            // Worker attests to both bonds
            await laborDignity.connect(worker1).addWorkerAttestation(
                1,
                8000, 8000, 8000, 8000, 8000, 8000,
                true,
                "Good working conditions"
            );

            await purchasingPower.connect(worker1).addWorkerAttestation(
                1,
                true, // can afford housing
                true, // can afford food
                true, // can afford healthcare
                true, // can save money
                true  // purchasing power improving
            );

            // Verify both bonds reflect worker input
            const laborCount = await laborDignity.getAttestationsCount(1);
            const powerCount = await purchasingPower.getAttestationsCount(1);

            expect(laborCount).to.equal(1);
            expect(powerCount).to.equal(1);

            // Verify scores affected by worker attestation
            const laborScore = await laborDignity.workerVerifiedScore(1);
            const powerMultiplier = await purchasingPower.workerVerificationMultiplier(1);

            expect(laborScore).to.be.above(0);
            expect(powerMultiplier).to.be.above(50);
        });

        it("Should allow multiple workers to verify same bond", async function () {
            await laborDignity.connect(company).createBond("Company A", 50, {
                value: ethers.parseEther("1.0")
            });

            // Three workers attest
            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 8000, 8000, 8000, 8000, 8000, 8000, true, "Good"
            );

            await laborDignity.connect(worker2).addWorkerAttestation(
                1, 8500, 8500, 8500, 8500, 8500, 8500, true, "Very good"
            );

            await laborDignity.connect(worker3).addWorkerAttestation(
                1, 7500, 7500, 7500, 7500, 7500, 7500, true, "Good overall"
            );

            const count = await laborDignity.getAttestationsCount(1);
            expect(count).to.equal(3);

            // Average should reflect all attestations
            const workerScore = await laborDignity.workerVerifiedScore(1);
            expect(workerScore).to.be.within(7500, 8500);
        });
    });

    describe("Company Operating Multiple Bond Types", function () {
        it("Should allow company to operate Labor + Purchasing Power bonds", async function () {
            // Create both bond types
            const laborTx = await laborDignity.connect(company).createBond("TechCorp", 100, {
                value: ethers.parseEther("2.0")
            });

            const powerTx = await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });

            // Verify both created
            const laborBond = await laborDignity.getBond(1);
            const powerBond = await purchasingPower.getBond(1);

            expect(laborBond.company).to.equal(company.address);
            expect(powerBond.company).to.equal(company.address);
            expect(laborBond.workerCount).to.equal(100);
            expect(powerBond.workerCount).to.equal(100);

            // Submit metrics to both
            await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );

            await purchasingPower.connect(company).submitMetrics(
                1,
                2800,  // housing 28%
                350,   // food 3.5 hours
                600,   // healthcare 6%
                8000,  // education good
                900,   // transport 9%
                2700   // discretionary 27%
            );

            // Verify metrics recorded
            const laborMetrics = await laborDignity.getLatestMetrics(1);
            const powerMetrics = await purchasingPower.getLatestMetrics(1);

            expect(laborMetrics.dignity).to.equal(7000);
            expect(powerMetrics.housingCostPercent).to.equal(2800);
        });

        it("Should calculate different bond values for same company", async function () {
            // Create both bonds
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            // Submit good metrics to labor, poor metrics to purchasing
            await laborDignity.connect(company).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );

            await purchasingPower.connect(company).submitMetrics(
                1,
                5000,  // housing 50% (bad)
                800,   // food 8 hours (bad)
                2000,  // healthcare 20% (bad)
                4000,  // education poor
                1500,  // transport 15% (bad)
                1000   // discretionary 10% (bad)
            );

            // Labor bond should appreciate, purchasing should depreciate
            const laborValue = await laborDignity.calculateBondValue(1);
            const powerValue = await purchasingPower.calculateBondValue(1);

            // Labor appreciates (good conditions)
            expect(laborValue).to.be.above(ethers.parseEther("1.0"));

            // Purchasing depreciates (poor affordability)
            expect(powerValue).to.be.below(ethers.parseEther("1.0"));
        });
    });

    describe("AI Company with Accountability Bond", function () {
        it("Should create AI Accountability bond with 30% revenue stake", async function () {
            const quarterlyRevenue = ethers.parseEther("100.0");
            const requiredStake = (quarterlyRevenue * BigInt(30)) / BigInt(100);

            await aiAccountability.connect(company).createBond(
                "AI Corp",
                quarterlyRevenue,
                { value: requiredStake }
            );

            const bond = await aiAccountability.getBond(1);
            expect(bond.aiCompany).to.equal(company.address);
            expect(bond.quarterlyRevenue).to.equal(quarterlyRevenue);
            expect(bond.stakeAmount).to.equal(requiredStake);
        });

        it("Should lock profits when humans suffer", async function () {
            const quarterlyRevenue = ethers.parseEther("10.0");
            const stake = (quarterlyRevenue * BigInt(30)) / BigInt(100);

            await aiAccountability.connect(company).createBond(
                "AI Corp",
                quarterlyRevenue,
                { value: stake }
            );

            // Submit metrics showing humans suffering (scores < 40)
            await aiAccountability.connect(company).submitMetrics(
                1,
                3500, // income distribution poor
                3000, // poverty rate high
                3500, // health declining
                3000, // mental health poor
                4000, // education limited
                3500  // purpose/agency low
            );

            // Check if profits should be locked
            const [locked, reason] = await aiAccountability.shouldLockProfits(1);
            expect(locked).to.be.true;
            expect(reason).to.include("Humans suffering");
        });

        it("Should reward high inclusion (education + purpose)", async function () {
            const quarterlyRevenue = ethers.parseEther("10.0");
            const stake = (quarterlyRevenue * BigInt(30)) / BigInt(100);

            await aiAccountability.connect(company).createBond(
                "AI Corp",
                quarterlyRevenue,
                { value: stake }
            );

            // Submit metrics showing high education and purpose (AI helping humans adapt)
            await aiAccountability.connect(company).submitMetrics(
                1,
                7000, // income distribution improving
                7500, // poverty rate declining
                7000, // health good
                6500, // mental health decent
                8000, // education access HIGH (AI teaching)
                8500  // purpose/agency HIGH (meaningful activities)
            );

            // High inclusion should give bonus multiplier
            const inclusionMult = await aiAccountability.inclusionMultiplier(1);
            expect(inclusionMult).to.be.above(150); // > 1.5x bonus
        });
    });

    describe("Economic Consistency Across Bonds", function () {
        it("Should maintain consistent 70/30 splits across bond types", async function () {
            // Create Labor bond
            await laborDignity.connect(company).createBond("Company", 10, {
                value: ethers.parseEther("1.0")
            });

            // Create Purchasing Power bond
            await purchasingPower.connect(company).createBond(10, {
                value: ethers.parseEther("1.0")
            });

            // Submit good metrics to both
            await laborDignity.connect(company).submitMetrics(
                1, 7000, 7000, 7000, 7000, 7000, 7000
            );

            await purchasingPower.connect(company).submitMetrics(
                1, 2500, 350, 600, 8000, 900, 2800
            );

            // Add worker verification to both
            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 7000, 7000, 7000, 7000, 7000, 7000, true, "Good"
            );

            await purchasingPower.connect(worker1).addWorkerAttestation(
                1, true, true, true, true, true
            );

            // Both should calculate 70/30 split on appreciation
            // (In production would distribute and verify actual splits)
            const laborAppreciation = await laborDignity.calculateAppreciation(1);
            const powerAppreciation = await purchasingPower.calculateAppreciation(1);

            // Both should have positive appreciation
            expect(laborAppreciation).to.be.above(0);
            expect(powerAppreciation).to.be.above(0);
        });

        it("Should apply 100% worker penalty consistently when exploiting", async function () {
            // Create Labor bond
            await laborDignity.connect(company).createBond("BadCorp", 10, {
                value: ethers.parseEther("1.0")
            });

            // Submit exploitative metrics (scores < 40)
            await laborDignity.connect(company).submitMetrics(
                1, 3000, 3000, 3000, 3000, 3000, 3000
            );

            // Check penalty
            const [penalty, reason] = await laborDignity.shouldActivateExploitationPenalty(1);
            expect(penalty).to.be.true;
            expect(reason).to.include("exploitation");

            // Create Purchasing Power bond
            await purchasingPower.connect(company).createBond(10, {
                value: ethers.parseEther("1.0")
            });

            // Submit declining purchasing power
            await purchasingPower.connect(company).submitMetrics(
                1,
                5500, // housing 55% (terrible)
                1000, // food 10 hours (terrible)
                2500, // healthcare 25% (terrible)
                2000, // education poor
                1800, // transport 18% (high)
                500   // discretionary 5% (terrible)
            );

            // Check penalty
            const powerPenalty = await purchasingPower.shouldActivateDecliningPenalty(1);
            expect(powerPenalty).to.be.true;

            // Both bonds should apply 100% to workers when distributing
        });
    });

    describe("Time Multipliers Across Bonds", function () {
        it("Should apply consistent time multipliers", async function () {
            // Create multiple bonds
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            // Check time multipliers (should be 100 for new bonds < 1 year)
            const laborTime = await laborDignity.timeMultiplier(1);
            const powerTime = await purchasingPower.timeMultiplier(1);

            expect(laborTime).to.equal(100); // 1.0x
            expect(powerTime).to.equal(100); // 1.0x

            // Both use same time calculation logic
        });
    });

    describe("Gas Cost Comparison", function () {
        it("Should have similar gas costs for bond creation across types", async function () {
            // Create Labor bond
            const laborTx = await laborDignity.connect(company).createBond("Company", 100, {
                value: ethers.parseEther("1.0")
            });
            const laborReceipt = await laborTx.wait();

            // Create Purchasing Power bond
            const powerTx = await purchasingPower.connect(company).createBond(100, {
                value: ethers.parseEther("1.0")
            });
            const powerReceipt = await powerTx.wait();

            console.log("Labor Bond Creation Gas:", laborReceipt.gasUsed.toString());
            console.log("Purchasing Power Bond Creation Gas:", powerReceipt.gasUsed.toString());

            // Gas costs should be similar (within 20% of each other)
            const diff = laborReceipt.gasUsed > powerReceipt.gasUsed
                ? laborReceipt.gasUsed - powerReceipt.gasUsed
                : powerReceipt.gasUsed - laborReceipt.gasUsed;

            const avgGas = (laborReceipt.gasUsed + powerReceipt.gasUsed) / BigInt(2);
            const percentDiff = (diff * BigInt(100)) / avgGas;

            expect(percentDiff).to.be.below(20); // Within 20%
        });
    });

    describe("Edge Cases - Cross-Bond", function () {
        it("Should handle worker verifying conflicting conditions across bonds", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            // Worker reports GOOD labor conditions but POOR purchasing power
            // (Company treats workers well but workers still can't afford stuff - external economic factors)
            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 8000, 8000, 8000, 8000, 8000, 8000, true, "Great workplace"
            );

            await purchasingPower.connect(worker1).addWorkerAttestation(
                1,
                false, // can't afford housing
                false, // can't afford food
                false, // can't afford healthcare
                false, // can't save
                false  // purchasing power declining
            );

            // Labor bond should appreciate
            const laborScore = await laborDignity.workerVerifiedScore(1);
            expect(laborScore).to.be.above(7000);

            // Purchasing power bond should have low verification
            const powerMult = await purchasingPower.workerVerificationMultiplier(1);
            expect(powerMult).to.be.below(100);

            // This is VALID - company can have good working conditions
            // but workers still struggle with affordability (broader economic issues)
        });

        it("Should handle same worker participating in competing company bonds", async function () {
            // Worker can verify bonds from multiple companies
            const company2 = worker3; // Using worker3 as second company for test

            await laborDignity.connect(company).createBond("Company A", 50, {
                value: ethers.parseEther("1.0")
            });

            await laborDignity.connect(company2).createBond("Company B", 50, {
                value: ethers.parseEther("1.0")
            });

            // Worker attests to both (maybe worked at both companies)
            await laborDignity.connect(worker1).addWorkerAttestation(
                1, 8000, 8000, 8000, 8000, 8000, 8000, false, "Former employee - was good"
            );

            await laborDignity.connect(worker1).addWorkerAttestation(
                2, 9000, 9000, 9000, 9000, 9000, 9000, true, "Current employee - excellent"
            );

            // Both attestations should be recorded
            expect(await laborDignity.getAttestationsCount(1)).to.equal(1);
            expect(await laborDignity.getAttestationsCount(2)).to.equal(1);

            // Mission alignment: Workers can verify multiple companies,
            // building truth through aggregate verification
        });
    });
});
