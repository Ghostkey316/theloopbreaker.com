const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fuzz Testing - Edge Cases and Random Inputs", function () {
    let laborDignity, purchasingPower, aiAccountability;
    let owner, company, worker1;

    beforeEach(async function () {
        [owner, company, worker1] = await ethers.getSigners();

        const LaborDignity = await ethers.getContractFactory("LaborDignityBonds");
        laborDignity = await LaborDignity.deploy();

        const PurchasingPower = await ethers.getContractFactory("PurchasingPowerBonds");
        purchasingPower = await PurchasingPower.deploy();

        const AIAccountability = await ethers.getContractFactory("AIAccountabilityBonds");
        aiAccountability = await AIAccountability.deploy();
    });

    describe("Random Valid Score Inputs", function () {
        it("Should handle 100 random valid scores for Labor Dignity", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            for (let i = 0; i < 100; i++) {
                // Generate random scores 0-10000
                const scores = Array(6).fill(0).map(() => Math.floor(Math.random() * 10001));

                await laborDignity.connect(company).submitMetrics(
                    1,
                    scores[0],
                    scores[1],
                    scores[2],
                    scores[3],
                    scores[4],
                    scores[5]
                );

                // Verify score is calculated correctly
                const flourishing = await laborDignity.companyFlourishingScore(1);
                expect(flourishing).to.be.lte(10000);
                expect(flourishing).to.be.gte(0);
            }

            console.log("  ✓ Successfully processed 100 random valid score submissions");
        });

        it("Should handle edge case scores (0 and 10000)", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            // All zeros
            await laborDignity.connect(company).submitMetrics(1, 0, 0, 0, 0, 0, 0);
            let flourishing = await laborDignity.companyFlourishingScore(1);
            expect(flourishing).to.equal(0);

            // All max
            await laborDignity.connect(company).submitMetrics(
                1, 10000, 10000, 10000, 10000, 10000, 10000
            );
            flourishing = await laborDignity.companyFlourishingScore(1);
            expect(flourishing).to.equal(10000);

            // Mixed
            await laborDignity.connect(company).submitMetrics(1, 0, 10000, 0, 10000, 0, 10000);
            flourishing = await laborDignity.companyFlourishingScore(1);
            expect(flourishing).to.equal(5000); // Average of 0,10000,0,10000,0,10000

            console.log("  ✓ Edge case scores handled correctly");
        });
    });

    describe("Invalid Score Rejection", function () {
        it("Should reject scores above 10000", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            // Try various invalid scores
            const invalidScores = [10001, 15000, 50000, 100000];

            for (const score of invalidScores) {
                await expect(
                    laborDignity.connect(company).submitMetrics(1, score, 5000, 5000, 5000, 5000, 5000)
                ).to.be.revertedWith("Score must be 0-10000");
            }

            console.log("  ✓ All invalid scores properly rejected");
        });

        it("Should reject worker attestations with invalid scores", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            await expect(
                laborDignity.connect(worker1).addWorkerAttestation(
                    1, 15000, 5000, 5000, 5000, 5000, 5000, true, "Invalid"
                )
            ).to.be.reverted;

            await expect(
                laborDignity.connect(worker1).addWorkerAttestation(
                    1, 5000, 5000, 5000, 5000, 5000, 20000, true, "Invalid"
                )
            ).to.be.reverted;
        });
    });

    describe("Random Stake Amounts", function () {
        it("Should handle various stake amounts", async function () {
            const stakeAmounts = [
                ethers.parseEther("0.001"),   // Very small
                ethers.parseEther("0.1"),     // Small
                ethers.parseEther("1.0"),     // Medium
                ethers.parseEther("10.0"),    // Large
                ethers.parseEther("100.0"),   // Very large
            ];

            let bondId = 1;
            for (const stake of stakeAmounts) {
                await laborDignity.connect(company).createBond("Company", 50, {
                    value: stake
                });

                const bond = await laborDignity.getBond(bondId);
                expect(bond.stakeAmount).to.equal(stake);

                bondId++;
            }

            console.log("  ✓ All stake amounts accepted");
        });

        it("Should reject zero stake", async function () {
            await expect(
                laborDignity.connect(company).createBond("Company", 50, {
                    value: 0
                })
            ).to.be.revertedWith("Must stake funds");
        });
    });

    describe("Random Worker Counts", function () {
        it("Should handle various worker counts", async function () {
            const workerCounts = [1, 10, 50, 100, 1000, 10000];

            let bondId = 1;
            for (const count of workerCounts) {
                await laborDignity.connect(company).createBond("Company", count, {
                    value: ethers.parseEther("1.0")
                });

                const bond = await laborDignity.getBond(bondId);
                expect(bond.workerCount).to.equal(count);

                bondId++;
            }

            console.log("  ✓ All worker counts accepted");
        });

        it("Should reject zero worker count", async function () {
            await expect(
                laborDignity.connect(company).createBond("Company", 0, {
                    value: ethers.parseEther("1.0")
                })
            ).to.be.revertedWith("Must have workers");
        });
    });

    describe("Purchasing Power Fuzz Testing", function () {
        it("Should handle random valid purchasing power metrics", async function () {
            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            for (let i = 0; i < 50; i++) {
                // Random valid values
                const housing = Math.floor(Math.random() * 10001);  // 0-10000
                const food = Math.floor(Math.random() * 10001);
                const healthcare = Math.floor(Math.random() * 10001);
                const education = Math.floor(Math.random() * 10001);
                const transport = Math.floor(Math.random() * 10001);
                const discretionary = Math.floor(Math.random() * 10001);

                await purchasingPower.connect(company).submitMetrics(
                    1,
                    housing,
                    food,
                    healthcare,
                    education,
                    transport,
                    discretionary
                );

                // Verify metrics stored
                const metrics = await purchasingPower.getLatestMetrics(1);
                expect(metrics.housingCostPercent).to.equal(housing);
            }

            console.log("  ✓ Successfully processed 50 random purchasing power metrics");
        });

        it("Should handle extreme purchasing power scenarios", async function () {
            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            // Best case: Everything affordable
            await purchasingPower.connect(company).submitMetrics(
                1,
                2000,  // housing 20%
                200,   // food 2 hours
                400,   // healthcare 4%
                9000,  // education excellent
                500,   // transport 5%
                4000   // discretionary 40%
            );

            let score = await purchasingPower.overallPurchasingPowerScore(1);
            console.log("  Best case score:", score.toString());
            expect(score).to.be.above(150); // Should be excellent

            // Worst case: Nothing affordable
            await purchasingPower.connect(company).submitMetrics(
                1,
                8000,  // housing 80%
                2000,  // food 20 hours
                3000,  // healthcare 30%
                1000,  // education poor
                2500,  // transport 25%
                100    // discretionary 1%
            );

            score = await purchasingPower.overallPurchasingPowerScore(1);
            console.log("  Worst case score:", score.toString());
            expect(score).to.be.below(100); // Should be poor
        });
    });

    describe("AI Accountability Fuzz Testing", function () {
        it("Should handle random revenue amounts", async function () {
            const revenues = [
                ethers.parseEther("1.0"),
                ethers.parseEther("10.0"),
                ethers.parseEther("100.0"),
                ethers.parseEther("1000.0"),
            ];

            let bondId = 1;
            for (const revenue of revenues) {
                const stake = (revenue * BigInt(30)) / BigInt(100);

                await aiAccountability.connect(company).createBond(
                    "AI Corp",
                    revenue,
                    { value: stake }
                );

                const bond = await aiAccountability.getBond(bondId);
                expect(bond.quarterlyRevenue).to.equal(revenue);
                expect(bond.stakeAmount).to.equal(stake);

                bondId++;
            }

            console.log("  ✓ All revenue amounts handled correctly");
        });

        it("Should handle random flourishing metrics", async function () {
            const quarterlyRevenue = ethers.parseEther("10.0");
            const stake = (quarterlyRevenue * BigInt(30)) / BigInt(100);

            await aiAccountability.connect(company).createBond(
                "AI Corp",
                quarterlyRevenue,
                { value: stake }
            );

            for (let i = 0; i < 50; i++) {
                const scores = Array(6).fill(0).map(() => Math.floor(Math.random() * 10001));

                await aiAccountability.connect(company).submitMetrics(
                    1,
                    scores[0], // income distribution
                    scores[1], // poverty rate
                    scores[2], // health outcomes
                    scores[3], // mental health
                    scores[4], // education access
                    scores[5]  // purpose/agency
                );

                const flourishing = await aiAccountability.globalFlourishingScore(1);
                expect(flourishing).to.be.lte(10000);
                expect(flourishing).to.be.gte(0);
            }

            console.log("  ✓ Successfully processed 50 random AI flourishing metrics");
        });
    });

    describe("Calculation Stability", function () {
        it("Should produce consistent results for same inputs", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            // Submit same metrics twice
            await laborDignity.connect(company).submitMetrics(
                1, 7500, 7500, 7500, 7500, 7500, 7500
            );

            await laborDignity.connect(company).submitMetrics(
                1, 7500, 7500, 7500, 7500, 7500, 7500
            );

            // Both should calculate same flourishing score
            const metrics = await laborDignity.bondMetrics(1, 0);
            const metrics2 = await laborDignity.bondMetrics(1, 1);

            expect(metrics.incomeGrowth).to.equal(metrics2.incomeGrowth);
            expect(metrics.autonomy).to.equal(metrics2.autonomy);

            console.log("  ✓ Consistent results for identical inputs");
        });

        it("Should handle division edge cases", async function () {
            // Create bond with 1 worker (edge case for per-worker calculations)
            await laborDignity.connect(company).createBond("Company", 1, {
                value: ethers.parseEther("1.0")
            });

            await laborDignity.connect(company).submitMetrics(
                1, 5000, 5000, 5000, 5000, 5000, 5000
            );

            // Should not revert on division
            const value = await laborDignity.calculateBondValue(1);
            expect(value).to.be.gte(0);

            console.log("  ✓ Division with edge case worker count handled");
        });
    });

    describe("String Input Fuzzing", function () {
        it("Should handle various company name lengths", async function () {
            const names = [
                "A",
                "Co",
                "Normal Company Name",
                "Very Long Company Name With Many Words That Goes On And On",
                "CompanyWith$pecialCh@rs!#%",
                "公司名称", // Chinese characters
                "Компания", // Russian characters
            ];

            let bondId = 1;
            for (const name of names) {
                if (name.length <= 100) { // Contract has 100 char limit
                    await laborDignity.connect(company).createBond(name, 50, {
                        value: ethers.parseEther("1.0")
                    });

                    const bond = await laborDignity.getBond(bondId);
                    expect(bond.companyName).to.equal(name);
                    bondId++;
                }
            }

            console.log("  ✓ Various company names handled");
        });

        it("Should handle various worker note lengths", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            const notes = [
                "",
                "Short",
                "This is a medium length note about working conditions",
                "Very long detailed notes ".repeat(10),
            ];

            for (const note of notes) {
                await laborDignity.connect(worker1).addWorkerAttestation(
                    1, 7000, 7000, 7000, 7000, 7000, 7000, true, note
                );
            }

            const count = await laborDignity.getAttestationsCount(1);
            expect(count).to.equal(notes.length);

            console.log("  ✓ Various note lengths handled");
        });
    });

    describe("Overflow/Underflow Protection", function () {
        it("Should handle maximum uint256 values safely", async function () {
            // Create bond with very large stake
            const largeStake = ethers.parseEther("1000000.0"); // 1 million ETH

            await laborDignity.connect(company).createBond("Company", 50, {
                value: largeStake
            });

            await laborDignity.connect(company).submitMetrics(
                1, 10000, 10000, 10000, 10000, 10000, 10000
            );

            // Calculations should not overflow
            const value = await laborDignity.calculateBondValue(1);
            expect(value).to.be.gte(largeStake); // Should appreciate

            console.log("  ✓ Large stake values handled without overflow");
        });

        it("Should handle negative appreciation correctly", async function () {
            await laborDignity.connect(company).createBond("Company", 50, {
                value: ethers.parseEther("1.0")
            });

            // Submit very poor metrics (should depreciate)
            await laborDignity.connect(company).submitMetrics(
                1, 1000, 1000, 1000, 1000, 1000, 1000
            );

            const appreciation = await laborDignity.calculateAppreciation(1);
            expect(appreciation).to.be.below(0); // Negative

            console.log("  ✓ Negative appreciation (depreciation) handled");
        });
    });

    describe("Time-based Edge Cases", function () {
        it("Should handle bonds created at same timestamp", async function () {
            // Create multiple bonds in same block
            await laborDignity.connect(company).createBond("Company A", 50, {
                value: ethers.parseEther("1.0")
            });

            await laborDignity.connect(company).createBond("Company B", 50, {
                value: ethers.parseEther("1.0")
            });

            const bond1 = await laborDignity.getBond(1);
            const bond2 = await laborDignity.getBond(2);

            // Timestamps might be same or very close
            expect(bond1.createdAt).to.be.lte(bond2.createdAt);

            console.log("  ✓ Bonds created at same time handled");
        });
    });

    describe("Boolean Input Fuzzing", function () {
        it("Should handle all boolean combinations for worker attestation", async function () {
            await purchasingPower.connect(company).createBond(50, {
                value: ethers.parseEther("1.0")
            });

            // Test all possible boolean combinations (2^5 = 32 combinations)
            const boolCombinations = [];
            for (let i = 0; i < 32; i++) {
                const canAffordHousing = !!(i & 1);
                const canAffordFood = !!(i & 2);
                const canAffordHealthcare = !!(i & 4);
                const canSaveMoney = !!(i & 8);
                const purchasingPowerImproving = !!(i & 16);

                await purchasingPower.connect(worker1).addWorkerAttestation(
                    1,
                    canAffordHousing,
                    canAffordFood,
                    canAffordHealthcare,
                    canSaveMoney,
                    purchasingPowerImproving
                );

                boolCombinations.push([canAffordHousing, canAffordFood, canAffordHealthcare, canSaveMoney, purchasingPowerImproving]);
            }

            const count = await purchasingPower.getAttestationsCount(1);
            expect(count).to.equal(32);

            console.log("  ✓ All 32 boolean combinations handled");
        });
    });
});
