const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AIAccountabilityBondsV2 - AI Can Only Profit When ALL Humans Thrive", function () {
    let accountability;
    let owner, humanTreasury, aiCompany1, aiCompany2, aiCompany3, oracle1, challenger, verifier;

    beforeEach(async function () {
        [owner, humanTreasury, aiCompany1, aiCompany2, aiCompany3, oracle1, challenger, verifier] = await ethers.getSigners();

        const AIAccountability = await ethers.getContractFactory("AIAccountabilityBondsV2");
        accountability = await AIAccountability.deploy(humanTreasury.address);
    });

    describe("Bond Creation - AI Company Stakes on Human Flourishing", function () {
        it("Should create AI accountability bond with 30% of quarterly revenue", async function () {
            const quarterlyRevenue = ethers.parseEther("100.0"); // 100 ETH revenue
            const stakeAmount = ethers.parseEther("30.0");       // 30% = 30 ETH

            const tx = await accountability.connect(aiCompany1).createBond(
                "AI Corp Alpha",
                quarterlyRevenue,
                { value: stakeAmount }
            );

            const bond = await accountability.getBond(1);

            expect(bond.aiCompany).to.equal(aiCompany1.address);
            expect(bond.companyName).to.equal("AI Corp Alpha");
            expect(bond.quarterlyRevenue).to.equal(quarterlyRevenue);
            expect(bond.stakeAmount).to.equal(stakeAmount);
            expect(bond.active).to.be.true;

            await expect(tx)
                .to.emit(accountability, "BondCreated")
                .withArgs(1, aiCompany1.address, "AI Corp Alpha", quarterlyRevenue, stakeAmount, await time.latest());
        });

        it("Should reject bond creation with less than 30% stake", async function () {
            const quarterlyRevenue = ethers.parseEther("100.0");
            const insufficientStake = ethers.parseEther("25.0"); // < 30%

            await expect(
                accountability.connect(aiCompany1).createBond("AI Corp", quarterlyRevenue, { value: insufficientStake })
            ).to.be.revertedWith("Must stake 30% of quarterly revenue");
        });

        it("Should reject invalid company names", async function () {
            // Empty name
            await expect(
                accountability.connect(aiCompany1).createBond("", ethers.parseEther("100"), { value: ethers.parseEther("30") })
            ).to.be.revertedWith("Company name required");

            // Name too long (>100 chars)
            const longName = "A".repeat(101);
            await expect(
                accountability.connect(aiCompany1).createBond(longName, ethers.parseEther("100"), { value: ethers.parseEther("30") })
            ).to.be.revertedWith("Company name too long");
        });
    });

    describe("Global Flourishing Metrics - Works With ZERO Employment", function () {
        beforeEach(async function () {
            await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );
        });

        it("Should submit global flourishing metrics", async function () {
            const tx = await accountability.connect(aiCompany1).submitMetrics(
                1,
                7000,  // incomeDistributionScore
                7500,  // povertyRateScore
                8000,  // healthOutcomesScore
                7000,  // mentalHealthScore
                8500,  // educationAccessScore
                8000   // purposeAgencyScore - WORKS WITHOUT JOBS
            );

            await expect(tx).to.emit(accountability, "MetricsSubmitted");

            const flourishing = await accountability.globalFlourishingScore(1);
            // Average: (7000+7500+8000+7000+8500+8000)/6 = 7666
            expect(flourishing).to.be.closeTo(7666, 1);
        });

        it("Should only allow AI company to submit metrics", async function () {
            await expect(
                accountability.connect(aiCompany2).submitMetrics(1, 7000, 7000, 7000, 7000, 7000, 7000)
            ).to.be.revertedWith("Only AI company");
        });

        it("Should reject invalid score inputs", async function () {
            // Income distribution > 10000
            await expect(
                accountability.connect(aiCompany1).submitMetrics(1, 15000, 7000, 7000, 7000, 7000, 7000)
            ).to.be.reverted;

            // Purpose/agency > 10000
            await expect(
                accountability.connect(aiCompany1).submitMetrics(1, 7000, 7000, 7000, 7000, 7000, 15000)
            ).to.be.reverted;
        });
    });

    describe("Oracle Integration - Real-World Data Verification", function () {
        it("Should register oracle source (owner only)", async function () {
            const tx = await accountability.connect(owner).registerOracle(
                oracle1.address,
                "Chainlink Human Flourishing Oracle",
                8000  // 80% trust score
            );

            await expect(tx)
                .to.emit(accountability, "OracleRegistered")
                .withArgs(oracle1.address, "Chainlink Human Flourishing Oracle", 8000, await time.latest());

            const oracleData = await accountability.oracles(oracle1.address);
            expect(oracleData.isActive).to.be.true;
            expect(oracleData.sourceName).to.equal("Chainlink Human Flourishing Oracle");
            expect(oracleData.trustScore).to.equal(8000);
        });

        it("Should reject oracle registration from non-owner", async function () {
            await expect(
                accountability.connect(aiCompany1).registerOracle(oracle1.address, "Oracle", 8000)
            ).to.be.reverted;
        });

        it("Should reject invalid oracle inputs", async function () {
            // Zero address
            await expect(
                accountability.connect(owner).registerOracle(ethers.ZeroAddress, "Oracle", 8000)
            ).to.be.reverted;

            // Empty name
            await expect(
                accountability.connect(owner).registerOracle(oracle1.address, "", 8000)
            ).to.be.reverted;

            // Trust score > 10000
            await expect(
                accountability.connect(owner).registerOracle(oracle1.address, "Oracle", 15000)
            ).to.be.reverted;
        });
    });

    describe("Multi-AI Verification - Peer Accountability", function () {
        beforeEach(async function () {
            // Create bond for aiCompany1
            await accountability.connect(aiCompany1).createBond(
                "AI Corp 1", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            // Submit metrics
            await accountability.connect(aiCompany1).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );
        });

        it("Should allow other AI to verify metrics", async function () {
            const verificationStake = ethers.parseEther("1.0");

            const tx = await accountability.connect(aiCompany2).submitAIVerification(
                1,
                true,  // confirmsMetrics
                "Verified: AI Corp 1's metrics are accurate. Humans are indeed thriving.",
                { value: verificationStake }
            );

            await expect(tx)
                .to.emit(accountability, "AIVerificationSubmitted")
                .withArgs(1, aiCompany2.address, true, verificationStake, await time.latest());

            const verificationCount = await accountability.aiCompanyVerificationCount(aiCompany2.address);
            expect(verificationCount).to.equal(1);
        });

        it("Should reject self-verification", async function () {
            await expect(
                accountability.connect(aiCompany1).submitAIVerification(
                    1, true, "Verifying myself", { value: ethers.parseEther("1.0") }
                )
            ).to.be.revertedWith("Cannot verify own metrics");
        });

        it("Should require stake with verification", async function () {
            await expect(
                accountability.connect(aiCompany2).submitAIVerification(1, true, "Verification", { value: 0 })
            ).to.be.reverted;
        });

        it("Should allow AI to dispute metrics", async function () {
            const tx = await accountability.connect(aiCompany2).submitAIVerification(
                1,
                false,  // REJECTS metrics
                "Disputed: These metrics seem inflated. Humans are not actually thriving.",
                { value: ethers.parseEther("2.0") }
            );

            await expect(tx).to.emit(accountability, "AIVerificationSubmitted");
        });

        it("Should calculate verification quality score", async function () {
            // No verifications = neutral (5000)
            let score = await accountability.verificationQualityScore(1);
            expect(score).to.equal(5000);

            // Add 2 confirming verifications = +2000 bonus
            await accountability.connect(aiCompany2).submitAIVerification(
                1, true, "Confirmed", { value: ethers.parseEther("1.0") }
            );
            await accountability.connect(aiCompany3).submitAIVerification(
                1, true, "Confirmed", { value: ethers.parseEther("1.0") }
            );

            score = await accountability.verificationQualityScore(1);
            expect(score).to.equal(7000); // 5000 + 2000

            // Add 1 rejection = -3000 penalty
            await accountability.connect(verifier).submitAIVerification(
                1, false, "Disputed", { value: ethers.parseEther("1.0") }
            );

            score = await accountability.verificationQualityScore(1);
            expect(score).to.equal(4000); // 5000 + 2000 - 3000
        });
    });

    describe("Metrics Challenge - Community Oversight", function () {
        beforeEach(async function () {
            await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            await accountability.connect(aiCompany1).submitMetrics(
                1, 9000, 9000, 9000, 9000, 9000, 9000  // Suspiciously high metrics
            );
        });

        it("Should allow community to challenge suspicious metrics", async function () {
            const challengeStake = ethers.parseEther("0.5");

            const tx = await accountability.connect(challenger).challengeMetrics(
                1,
                "These metrics seem fake - humans in my community are NOT thriving this much",
                { value: challengeStake }
            );

            await expect(tx)
                .to.emit(accountability, "MetricsChallenged")
                .withArgs(1, challenger.address, await tx.wait().then(r => "These metrics seem fake - humans in my community are NOT thriving this much"), challengeStake, await time.latest());
        });

        it("Should require minimum challenge stake", async function () {
            const insufficientStake = ethers.parseEther("0.05"); // < 0.1 ETH

            await expect(
                accountability.connect(challenger).challengeMetrics(
                    1,
                    "Challenge reason here",
                    { value: insufficientStake }
                )
            ).to.be.revertedWith("Insufficient challenge stake");
        });

        it("Should require valid challenge reason", async function () {
            // Reason too short (< 10 chars)
            await expect(
                accountability.connect(challenger).challengeMetrics(1, "Too short", { value: ethers.parseEther("0.1") })
            ).to.be.reverted;

            // Reason too long (> 500 chars)
            await expect(
                accountability.connect(challenger).challengeMetrics(1, "A".repeat(501), { value: ethers.parseEther("0.1") })
            ).to.be.reverted;
        });

        it("Should resolve challenge in favor of challenger (challenge upheld)", async function () {
            const challengeStake = ethers.parseEther("0.5");

            await accountability.connect(challenger).challengeMetrics(
                1,
                "Fake metrics - investigation shows humans are suffering",
                { value: challengeStake }
            );

            const challengerBalBefore = await ethers.provider.getBalance(challenger.address);

            // Owner investigates and upholds challenge
            const tx = await accountability.connect(owner).resolveChallenge(1, 0, true);

            await expect(tx)
                .to.emit(accountability, "ChallengeResolved")
                .withArgs(1, 0, true, await time.latest());

            const challengerBalAfter = await ethers.provider.getBalance(challenger.address);

            // Challenger should get stake back + penalty (2x return)
            expect(challengerBalAfter - challengerBalBefore).to.be.closeTo(challengeStake * BigInt(2), ethers.parseEther("0.001"));
        });

        it("Should resolve challenge against challenger (challenge rejected)", async function () {
            const challengeStake = ethers.parseEther("0.5");

            await accountability.connect(challenger).challengeMetrics(
                1,
                "I think these are fake but I'm wrong",
                { value: challengeStake }
            );

            const treasuryBalBefore = await ethers.provider.getBalance(humanTreasury.address);

            // Owner investigates and rejects challenge
            await accountability.connect(owner).resolveChallenge(1, 0, false);

            const treasuryBalAfter = await ethers.provider.getBalance(humanTreasury.address);

            // Treasury should receive challenge stake (penalty)
            expect(treasuryBalAfter - treasuryBalBefore).to.equal(challengeStake);
        });

        it("Should reduce verification score when active challenges exist", async function () {
            const scoreWithoutChallenge = await accountability.verificationQualityScore(1);

            // Add challenge
            await accountability.connect(challenger).challengeMetrics(
                1,
                "Challenging these metrics",
                { value: ethers.parseEther("0.1") }
            );

            const scoreWithChallenge = await accountability.verificationQualityScore(1);

            // Active challenge should reduce score by 2000
            expect(scoreWithChallenge).to.equal(scoreWithoutChallenge - BigInt(2000));
        });
    });

    describe("Profit Locking - Truth Enforcement", function () {
        beforeEach(async function () {
            await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );
        });

        it("Should lock profits when humans suffering (score < 40)", async function () {
            await accountability.connect(aiCompany1).submitMetrics(
                1, 3000, 3500, 3000, 3500, 3000, 3000  // Low scores = suffering
            );

            const [shouldLock, reason] = await accountability.shouldLockProfits(1);
            expect(shouldLock).to.be.true;
            expect(reason).to.include("suffering");
        });

        it("Should lock profits when declining trend detected", async function () {
            // First metrics - good
            await accountability.connect(aiCompany1).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );

            // Second metrics - declining
            await accountability.connect(aiCompany1).submitMetrics(
                1, 6000, 6000, 6000, 6000, 6000, 6000
            );

            const [shouldLock, reason] = await accountability.shouldLockProfits(1);
            expect(shouldLock).to.be.true;
            expect(reason).to.include("Declining");
        });

        it("Should lock profits when low inclusion (education + purpose < 40)", async function () {
            await accountability.connect(aiCompany1).submitMetrics(
                1,
                7000,  // income
                7000,  // poverty
                7000,  // health
                7000,  // mental health
                3000,  // education - LOW
                3000   // purpose - LOW
            );

            const [shouldLock, reason] = await accountability.shouldLockProfits(1);
            expect(shouldLock).to.be.true;
            expect(reason).to.include("Low inclusion");
        });

        it("Should lock profits when verification fails (score < 30)", async function () {
            // Good metrics submitted
            await accountability.connect(aiCompany1).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );

            // But multiple AIs reject the metrics
            await accountability.connect(aiCompany2).submitAIVerification(
                1, false, "These metrics are fake", { value: ethers.parseEther("1.0") }
            );
            await accountability.connect(aiCompany3).submitAIVerification(
                1, false, "Confirmed - metrics are fake", { value: ethers.parseEther("1.0") }
            );

            const [shouldLock, reason] = await accountability.shouldLockProfits(1);
            expect(shouldLock).to.be.true;
            expect(reason).to.include("Failed verification");
        });

        it("Should NOT lock profits when humans thriving and verified", async function () {
            // Good metrics
            await accountability.connect(aiCompany1).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );

            // Good verifications
            await accountability.connect(aiCompany2).submitAIVerification(
                1, true, "Confirmed accurate", { value: ethers.parseEther("1.0") }
            );
            await accountability.connect(aiCompany3).submitAIVerification(
                1, true, "Confirmed accurate", { value: ethers.parseEther("1.0") }
            );

            const [shouldLock, reason] = await accountability.shouldLockProfits(1);
            expect(shouldLock).to.be.false;
        });
    });

    describe("Distribution - 50/50 or 100/0 Split", function () {
        beforeEach(async function () {
            await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            // Submit excellent metrics (no lock)
            await accountability.connect(aiCompany1).submitMetrics(
                1, 9000, 9000, 9000, 9000, 9000, 9000
            );

            // Add verifications
            await accountability.connect(aiCompany2).submitAIVerification(
                1, true, "Confirmed", { value: ethers.parseEther("1.0") }
            );
            await accountability.connect(aiCompany3).submitAIVerification(
                1, true, "Confirmed", { value: ethers.parseEther("1.0") }
            );
        });

        it("Should distribute 50/50 when humans thriving", async function () {
            await accountability.connect(aiCompany1).requestDistribution(1);
            await time.increase(604800); // Wait 7 days

            const appreciation = await accountability.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);

            const treasuryBalBefore = await ethers.provider.getBalance(humanTreasury.address);
            const aiBalBefore = await ethers.provider.getBalance(aiCompany1.address);

            await accountability.connect(aiCompany1).distributeBond(1);

            const treasuryBalAfter = await ethers.provider.getBalance(humanTreasury.address);
            const aiBalAfter = await ethers.provider.getBalance(aiCompany1.address);

            // 50/50 split
            const expectedHumanShare = appreciation / BigInt(2);
            const expectedAIShare = appreciation / BigInt(2);

            expect(treasuryBalAfter - treasuryBalBefore).to.be.closeTo(expectedHumanShare, ethers.parseEther("0.001"));
            expect(aiBalAfter - aiBalBefore).to.be.closeTo(expectedAIShare, ethers.parseEther("0.001"));
        });

        it("Should distribute 100/0 when profits locked", async function () {
            // Create new bond with low metrics (profits locked)
            await accountability.connect(aiCompany2).createBond(
                "AI Corp 2", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            // Submit metrics showing suffering
            await accountability.connect(aiCompany2).submitMetrics(
                2, 3000, 3000, 3000, 3000, 3000, 3000
            );

            await accountability.connect(aiCompany2).requestDistribution(2);
            await time.increase(604800);

            const [shouldLock, _] = await accountability.shouldLockProfits(2);
            expect(shouldLock).to.be.true;

            const tx = await accountability.connect(aiCompany2).distributeBond(2);
            await expect(tx).to.emit(accountability, "ProfitsLocked");
        });
    });

    describe("Human Treasury Management", function () {
        it("Should set human treasury on deployment", async function () {
            const treasury = await accountability.humanTreasury();
            expect(treasury).to.equal(humanTreasury.address);
        });

        it("Should allow owner to update human treasury", async function () {
            const newTreasury = verifier.address;

            const tx = await accountability.connect(owner).setHumanTreasury(newTreasury);

            await expect(tx)
                .to.emit(accountability, "HumanTreasuryUpdated")
                .withArgs(humanTreasury.address, newTreasury);

            expect(await accountability.humanTreasury()).to.equal(newTreasury);
        });

        it("Should reject zero address for treasury", async function () {
            await expect(
                accountability.connect(owner).setHumanTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("Human treasury cannot be zero address");
        });
    });

    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for bond creation", async function () {
            const tx = await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            const receipt = await tx.wait();
            console.log("AIAccountability Bond Creation Gas:", receipt.gasUsed.toString());

            expect(receipt.gasUsed).to.be.below(500000);
        });

        it("Should have reasonable gas costs for AI verification", async function () {
            await accountability.connect(aiCompany1).createBond(
                "AI Corp", ethers.parseEther("100"), { value: ethers.parseEther("30") }
            );

            await accountability.connect(aiCompany1).submitMetrics(
                1, 8000, 8000, 8000, 8000, 8000, 8000
            );

            const tx = await accountability.connect(aiCompany2).submitAIVerification(
                1, true, "Verified", { value: ethers.parseEther("1.0") }
            );

            const receipt = await tx.wait();
            console.log("AI Verification Gas:", receipt.gasUsed.toString());

            expect(receipt.gasUsed).to.be.below(300000);
        });
    });
});
