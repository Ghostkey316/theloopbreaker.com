const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EscapeVelocityBondsV2 - Poverty Escape ($50-$500)", function () {
    let escapeVelocity;
    let owner, escaper1, escaper2, escaper3, verifier;

    const MIN_STAKE = ethers.parseEther("0.00005"); // $50 equivalent
    const MID_STAKE = ethers.parseEther("0.00025"); // $250 equivalent
    const MAX_STAKE = ethers.parseEther("0.0005");  // $500 equivalent

    beforeEach(async function () {
        [owner, escaper1, escaper2, escaper3, verifier] = await ethers.getSigners();

        const EscapeVelocity = await ethers.getContractFactory("EscapeVelocityBondsV2");
        escapeVelocity = await EscapeVelocity.deploy();
    });

    describe("Bond Creation - Small Stakes ($50-$500)", function () {
        it("Should create escape velocity bond with minimum stake ($50)", async function () {
            const initialIncome = 2000; // $2000/month

            const tx = await escapeVelocity.connect(escaper1).createBond(
                "Maria - escaping poverty",
                initialIncome,
                { value: MIN_STAKE }
            );

            const receipt = await tx.wait();
            const bond = await escapeVelocity.getBond(1);

            expect(bond.staker).to.equal(escaper1.address);
            expect(bond.stakerName).to.equal("Maria - escaping poverty");
            expect(bond.initialIncome).to.equal(initialIncome);
            expect(bond.stakeAmount).to.equal(MIN_STAKE);
            expect(bond.escaped).to.be.false;
            expect(bond.active).to.be.true;

            await expect(tx)
                .to.emit(escapeVelocity, "BondCreated")
                .withArgs(1, escaper1.address, initialIncome, MIN_STAKE, await time.latest());
        });

        it("Should create bond with maximum stake ($500)", async function () {
            await escapeVelocity.connect(escaper1).createBond(
                "John - building a better life",
                1500,
                { value: MAX_STAKE }
            );

            const bond = await escapeVelocity.getBond(1);
            expect(bond.stakeAmount).to.equal(MAX_STAKE);
        });

        it("Should reject stakes below minimum ($50)", async function () {
            const tooSmall = ethers.parseEther("0.00001"); // < $50

            await expect(
                escapeVelocity.connect(escaper1).createBond("Alice", 1000, { value: tooSmall })
            ).to.be.revertedWith("Stake must be $50-$500 equivalent");
        });

        it("Should reject stakes above maximum ($500)", async function () {
            const tooLarge = ethers.parseEther("0.001"); // > $500

            await expect(
                escapeVelocity.connect(escaper1).createBond("Bob", 2000, { value: tooLarge })
            ).to.be.revertedWith("Stake must be $50-$500 equivalent");
        });

        it("Should reject zero initial income", async function () {
            await expect(
                escapeVelocity.connect(escaper1).createBond("Alice", 0, { value: MID_STAKE })
            ).to.be.reverted;
        });

        it("Should allow multiple people to create escape bonds", async function () {
            await escapeVelocity.connect(escaper1).createBond("Maria", 1500, { value: MIN_STAKE });
            await escapeVelocity.connect(escaper2).createBond("John", 1800, { value: MID_STAKE });
            await escapeVelocity.connect(escaper3).createBond("Sarah", 2200, { value: MAX_STAKE });

            const bond1 = await escapeVelocity.getBond(1);
            const bond2 = await escapeVelocity.getBond(2);
            const bond3 = await escapeVelocity.getBond(3);

            expect(bond1.staker).to.equal(escaper1.address);
            expect(bond2.staker).to.equal(escaper2.address);
            expect(bond3.staker).to.equal(escaper3.address);
        });
    });

    describe("Progress Tracking - Escape Velocity", function () {
        beforeEach(async function () {
            await escapeVelocity.connect(escaper1).createBond(
                "Maria",
                2000, // Initial: $2000/month
                { value: MID_STAKE }
            );
        });

        it("Should submit progress showing income growth", async function () {
            const tx = await escapeVelocity.connect(escaper1).submitProgress(
                1,
                2800,  // currentIncome: $2800 (40% gain)
                7000,  // autonomyGain
                6500,  // stabilityScore
                2,     // peopleHelped
                "Got a better job, helping 2 friends find work too"
            );

            await expect(tx).to.emit(escapeVelocity, "ProgressSubmitted");

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(4000); // 40% = 4000 basis points
        });

        it("Should achieve ESCAPE VELOCITY at 150% income gain", async function () {
            // Submit progress reaching 150% gain (income from $2000 to $5000)
            const tx = await escapeVelocity.connect(escaper1).submitProgress(
                1,
                5000,  // currentIncome: $5000 (150% gain)
                9000,  // autonomyGain - high
                8500,  // stabilityScore - high
                5,     // peopleHelped
                "ESCAPED! Income tripled, stable job, helping others"
            );

            await expect(tx).to.emit(escapeVelocity, "EscapeVelocityAchieved");

            const bond = await escapeVelocity.getBond(1);
            expect(bond.escaped).to.be.true;

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.be.at.least(15000); // >= 150%
        });

        it("Should NOT achieve escape velocity below 150% threshold", async function () {
            // Submit progress at 140% gain (not enough)
            await escapeVelocity.connect(escaper1).submitProgress(
                1,
                4800,  // currentIncome: $4800 (140% gain)
                7000,
                7000,
                3,
                "Good progress but not there yet"
            );

            const bond = await escapeVelocity.getBond(1);
            expect(bond.escaped).to.be.false; // Still not escaped
        });

        it("Should emit RECAPTURE WARNING if income falls after escape", async function () {
            // First: achieve escape velocity
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 5000, 9000, 8500, 5, "Escaped!"
            );

            let bond = await escapeVelocity.getBond(1);
            expect(bond.escaped).to.be.true;

            // Then: submit progress showing income falling below threshold
            const tx = await escapeVelocity.connect(escaper1).submitProgress(
                1,
                2500,  // Income fell from $5000 to $2500 (still above initial but below threshold)
                4000,  // autonomyGain - declining
                4500,  // stabilityScore - declining
                0,     // peopleHelped - can't help others anymore
                "Lost job, falling back"
            );

            await expect(tx)
                .to.emit(escapeVelocity, "RecaptureWarning")
                .withArgs(1, "Income falling back - recapture risk");
        });

        it("Should handle negative income change (depression)", async function () {
            // Submit progress with income LOWER than initial
            await escapeVelocity.connect(escaper1).submitProgress(
                1,
                1500,  // currentIncome: $1500 (down from $2000)
                3000,  // autonomyGain - low
                3000,  // stabilityScore - low
                0,     // peopleHelped
                "Struggling, lost hours at work"
            );

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(0); // No gain, in fact losing
        });

        it("Should reject invalid score inputs", async function () {
            // Autonomy gain > 10000
            await expect(
                escapeVelocity.connect(escaper1).submitProgress(1, 3000, 15000, 5000, 1, "Invalid")
            ).to.be.reverted;

            // Stability score > 10000
            await expect(
                escapeVelocity.connect(escaper1).submitProgress(1, 3000, 5000, 15000, 1, "Invalid")
            ).to.be.reverted;
        });

        it("Should only allow staker to submit progress", async function () {
            await expect(
                escapeVelocity.connect(escaper2).submitProgress(1, 3000, 7000, 7000, 1, "Not my bond")
            ).to.be.revertedWith("Only staker");
        });
    });

    describe("Income Gain Calculations", function () {
        beforeEach(async function () {
            await escapeVelocity.connect(escaper1).createBond(
                "Maria",
                2000, // Initial: $2000
                { value: MID_STAKE }
            );
        });

        it("Should calculate 50% income gain correctly", async function () {
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 3000, 7000, 7000, 2, "50% gain" // $2000 -> $3000 = 50%
            );

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(5000); // 50% = 5000 basis points
        });

        it("Should calculate 100% income gain (doubled)", async function () {
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 4000, 8000, 8000, 3, "Doubled income" // $2000 -> $4000 = 100%
            );

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(10000); // 100% = 10000 basis points
        });

        it("Should calculate 200% income gain (tripled)", async function () {
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 6000, 9500, 9500, 10, "Tripled income" // $2000 -> $6000 = 200%
            );

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(20000); // 200% = 20000 basis points
        });

        it("Should return 0 gain when no metrics submitted", async function () {
            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(0);
        });
    });

    describe("Bond Value Based on Income Growth", function () {
        beforeEach(async function () {
            await escapeVelocity.connect(escaper1).createBond(
                "Maria",
                2000,
                { value: MID_STAKE }
            );
        });

        it("Should calculate bond value: stake + (stake × income_gain)", async function () {
            // 50% income gain
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 3000, 7000, 7000, 2, "50% gain"
            );

            const bondValue = await escapeVelocity.calculateBondValue(1);
            const expectedValue = MID_STAKE + (MID_STAKE * BigInt(5000)) / BigInt(10000);

            expect(bondValue).to.equal(expectedValue); // Stake + 50% of stake
        });

        it("Should show appreciation when income grows", async function () {
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 4000, 8000, 8000, 3, "100% gain"
            );

            const appreciation = await escapeVelocity.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);
            expect(appreciation).to.equal(MID_STAKE); // Doubled, so appreciation = original stake
        });

        it("Should show no change when income doesn't grow", async function () {
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 2000, 5000, 5000, 0, "Stagnant"
            );

            const appreciation = await escapeVelocity.calculateAppreciation(1);
            expect(appreciation).to.equal(0);
        });
    });

    describe("Distribution - 80/20 Pay-It-Forward Split", function () {
        beforeEach(async function () {
            await escapeVelocity.connect(escaper1).createBond(
                "Maria",
                2000,
                { value: MID_STAKE }
            );

            // Submit progress showing escape achieved
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 5000, 9000, 8500, 5, "Escaped!"
            );
        });

        it("Should request distribution (start timelock)", async function () {
            const tx = await escapeVelocity.connect(escaper1).requestDistribution(1);

            const bond = await escapeVelocity.getBond(1);
            expect(bond.distributionPending).to.be.true;

            const timelock = 604800; // 7 days
            await expect(tx)
                .to.emit(escapeVelocity, "DistributionRequested")
                .withArgs(1, escaper1.address, await time.latest(), bond.distributionRequestedAt + BigInt(timelock));
        });

        it("Should reject distribution before timelock expires", async function () {
            await escapeVelocity.connect(escaper1).requestDistribution(1);

            await expect(
                escapeVelocity.connect(escaper1).distributeBond(1)
            ).to.be.revertedWith("Timelock not expired");
        });

        it("Should distribute with 80/20 split (escaper/pay-it-forward)", async function () {
            await escapeVelocity.connect(escaper1).requestDistribution(1);
            await time.increase(604800); // Wait 7 days

            const appreciation = await escapeVelocity.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);

            const escaperBalBefore = await ethers.provider.getBalance(escaper1.address);

            const tx = await escapeVelocity.connect(escaper1).distributeBond(1);
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            const escaperBalAfter = await ethers.provider.getBalance(escaper1.address);

            // Calculate expected shares
            const escaperShare = (appreciation * BigInt(80)) / BigInt(100);
            const payItForwardShare = (appreciation * BigInt(20)) / BigInt(100);

            // Verify escaper received 80%
            expect(escaperBalAfter + gasCost - escaperBalBefore).to.be.closeTo(escaperShare, ethers.parseEther("0.0001"));

            // Verify pay-it-forward pool received 20%
            const pool = await escapeVelocity.payItForwardPool();
            expect(pool).to.equal(payItForwardShare);

            await expect(tx).to.emit(escapeVelocity, "BondDistributed");
        });

        it("Should support escaper during setback (negative appreciation)", async function () {
            // Create new bond
            await escapeVelocity.connect(escaper2).createBond("John", 3000, { value: MID_STAKE });

            // Submit progress showing income LOSS
            await escapeVelocity.connect(escaper2).submitProgress(
                2, 2000, 3000, 3000, 0, "Lost job"
            );

            await escapeVelocity.connect(escaper2).requestDistribution(2);
            await time.increase(604800);

            const appreciation = await escapeVelocity.calculateAppreciation(2);
            expect(appreciation).to.be.below(0); // Negative

            const tx = await escapeVelocity.connect(escaper2).distributeBond(2);

            // During setback, escaper gets support, pay-it-forward gets 0
            await expect(tx).to.emit(escapeVelocity, "BondDistributed");
        });

        it("Should only allow staker to request/distribute", async function () {
            await expect(
                escapeVelocity.connect(escaper2).requestDistribution(1)
            ).to.be.revertedWith("Only staker");

            await escapeVelocity.connect(escaper1).requestDistribution(1);
            await time.increase(604800);

            await expect(
                escapeVelocity.connect(escaper2).distributeBond(1)
            ).to.be.revertedWith("Only staker");
        });

        it("Should reject distribution when no appreciation", async function () {
            // Create bond with no progress
            await escapeVelocity.connect(escaper2).createBond("John", 2000, { value: MID_STAKE });

            await escapeVelocity.connect(escaper2).requestDistribution(2);
            await time.increase(604800);

            await expect(
                escapeVelocity.connect(escaper2).distributeBond(2)
            ).to.be.revertedWith("No appreciation");
        });
    });

    describe("Pay-It-Forward Pool", function () {
        it("Should accumulate funds from multiple escapers", async function () {
            // First escaper
            await escapeVelocity.connect(escaper1).createBond("Maria", 2000, { value: MID_STAKE });
            await escapeVelocity.connect(escaper1).submitProgress(1, 5000, 9000, 8500, 5, "Escaped");
            await escapeVelocity.connect(escaper1).requestDistribution(1);
            await time.increase(604800);

            const appreciation1 = await escapeVelocity.calculateAppreciation(1);
            const expectedPool1 = (appreciation1 * BigInt(20)) / BigInt(100);

            await escapeVelocity.connect(escaper1).distributeBond(1);
            let pool = await escapeVelocity.payItForwardPool();
            expect(pool).to.equal(expectedPool1);

            // Second escaper
            await escapeVelocity.connect(escaper2).createBond("John", 1800, { value: MID_STAKE });
            await escapeVelocity.connect(escaper2).submitProgress(2, 4500, 8500, 8000, 4, "Escaped");
            await escapeVelocity.connect(escaper2).requestDistribution(2);
            await time.increase(604800);

            const appreciation2 = await escapeVelocity.calculateAppreciation(2);
            const expectedPool2 = (appreciation2 * BigInt(20)) / BigInt(100);

            await escapeVelocity.connect(escaper2).distributeBond(2);
            pool = await escapeVelocity.payItForwardPool();
            expect(pool).to.equal(expectedPool1 + expectedPool2);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle multiple escape attempts from same person", async function () {
            await escapeVelocity.connect(escaper1).createBond("Maria - Attempt 1", 1500, { value: MIN_STAKE });
            await escapeVelocity.connect(escaper1).createBond("Maria - Attempt 2", 1800, { value: MID_STAKE });

            const bond1 = await escapeVelocity.getBond(1);
            const bond2 = await escapeVelocity.getBond(2);

            expect(bond1.staker).to.equal(escaper1.address);
            expect(bond2.staker).to.equal(escaper1.address);
            expect(bond1.bondId).to.equal(1);
            expect(bond2.bondId).to.equal(2);
        });

        it("Should handle very high income gains (10x income)", async function () {
            await escapeVelocity.connect(escaper1).createBond("Maria", 1000, { value: MIN_STAKE });

            // Income goes from $1000 to $10000 (900% gain)
            await escapeVelocity.connect(escaper1).submitProgress(
                1, 10000, 9900, 9900, 50, "Started a successful business!"
            );

            const incomeGain = await escapeVelocity.calculateIncomeGain(1);
            expect(incomeGain).to.equal(90000); // 900% = 90000 basis points

            const bond = await escapeVelocity.getBond(1);
            expect(bond.escaped).to.be.true;
        });

        it("Should reject operations on non-existent bonds", async function () {
            await expect(
                escapeVelocity.calculateIncomeGain(999)
            ).to.be.revertedWith("Bond does not exist");

            await expect(
                escapeVelocity.connect(escaper1).submitProgress(999, 3000, 7000, 7000, 1, "Invalid")
            ).to.be.revertedWith("Bond does not exist");
        });
    });

    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for bond creation", async function () {
            const tx = await escapeVelocity.connect(escaper1).createBond(
                "Maria",
                2000,
                { value: MID_STAKE }
            );

            const receipt = await tx.wait();
            console.log("EscapeVelocity Bond Creation Gas:", receipt.gasUsed.toString());

            expect(receipt.gasUsed).to.be.below(400000);
        });
    });
});
