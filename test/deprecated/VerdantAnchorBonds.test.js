const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VerdantAnchorBondsV2 - Earth Regeneration > Extraction", function () {
    let verdantAnchor;
    let owner, regenerator, landowner, localResident1, localResident2, observer;

    beforeEach(async function () {
        [owner, regenerator, landowner, localResident1, localResident2, observer] = await ethers.getSigners();

        const VerdantAnchor = await ethers.getContractFactory("VerdantAnchorBondsV2");
        verdantAnchor = await VerdantAnchor.deploy();
    });

    describe("Bond Creation - Regeneration Projects", function () {
        it("Should create verdant anchor bond for regeneration project", async function () {
            const stakeAmount = ethers.parseEther("2.0");
            const tx = await verdantAnchor.connect(regenerator).createBond(
                landowner.address,
                "Earth Healers Collective",
                "Costa Rica, Central Valley",
                "Regenerative agroforestry",
                { value: stakeAmount }
            );

            const receipt = await tx.wait();
            const bond = await verdantAnchor.getBond(1);

            expect(bond.regenerator).to.equal(regenerator.address);
            expect(bond.landowner).to.equal(landowner.address);
            expect(bond.regeneratorName).to.equal("Earth Healers Collective");
            expect(bond.location).to.equal("Costa Rica, Central Valley");
            expect(bond.projectType).to.equal("Regenerative agroforestry");
            expect(bond.stakeAmount).to.equal(stakeAmount);
            expect(bond.active).to.be.true;

            await expect(tx)
                .to.emit(verdantAnchor, "BondCreated")
                .withArgs(1, regenerator.address, "Costa Rica, Central Valley", stakeAmount, await time.latest());
        });

        it("Should reject bond creation with invalid inputs", async function () {
            // Zero stake
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    landowner.address, "Name", "Location", "Type", { value: 0 }
                )
            ).to.be.reverted;

            // Zero address landowner
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    ethers.ZeroAddress, "Name", "Location", "Type", { value: ethers.parseEther("1.0") }
                )
            ).to.be.reverted;

            // Empty name
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    landowner.address, "", "Location", "Type", { value: ethers.parseEther("1.0") }
                )
            ).to.be.reverted;

            // Empty location
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    landowner.address, "Name", "", "Type", { value: ethers.parseEther("1.0") }
                )
            ).to.be.reverted;

            // Empty project type
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    landowner.address, "Name", "Location", "", { value: ethers.parseEther("1.0") }
                )
            ).to.be.reverted;

            // Name too long (>100 chars)
            const longName = "A".repeat(101);
            await expect(
                verdantAnchor.connect(regenerator).createBond(
                    landowner.address, longName, "Location", "Type", { value: ethers.parseEther("1.0") }
                )
            ).to.be.reverted;
        });

        it("Should allow multiple regeneration projects", async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project 1", "Brazil, Amazon", "Rainforest restoration",
                { value: ethers.parseEther("1.0") }
            );

            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project 2", "Kenya, Savanna", "Soil restoration",
                { value: ethers.parseEther("2.0") }
            );

            const bond1 = await verdantAnchor.getBond(1);
            const bond2 = await verdantAnchor.getBond(2);

            expect(bond1.bondId).to.equal(1);
            expect(bond2.bondId).to.equal(2);
            expect(bond1.location).to.equal("Brazil, Amazon");
            expect(bond2.location).to.equal("Kenya, Savanna");
        });
    });

    describe("Regeneration Metrics - 5 Ecological Dimensions", function () {
        beforeEach(async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address,
                "Regeneration Project",
                "Portugal, Alentejo",
                "Holistic land management",
                { value: ethers.parseEther("1.0") }
            );
        });

        it("Should submit excellent regeneration metrics", async function () {
            const tx = await verdantAnchor.submitRegenerationMetrics(
                1,
                9000,  // soilHealthScore - excellent
                8500,  // biodiversityScore - great
                8000,  // carbonSequestration - strong
                9500,  // waterQualityScore - exceptional
                8800,  // ecosystemResilienceScore - excellent
                true,  // physicalWorkVerified
                "Soil carbon increased 40%, 15 new species observed, springs running clear"
            );

            await expect(tx).to.emit(verdantAnchor, "RegenerationMetricsSubmitted");

            // Check bond value appreciation
            const bondValue = await verdantAnchor.calculateBondValue(1);
            expect(bondValue).to.be.above(ethers.parseEther("1.0"));

            const appreciation = await verdantAnchor.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);
        });

        it("Should handle poor regeneration metrics (no improvement)", async function () {
            await verdantAnchor.submitRegenerationMetrics(
                1,
                3000,  // soilHealthScore - poor
                2500,  // biodiversityScore - declining
                2000,  // carbonSequestration - low
                3500,  // waterQualityScore - poor
                3000,  // ecosystemResilienceScore - weak
                false, // physicalWorkVerified - NO WORK DONE
                "No visible improvements, land degrading"
            );

            const bondValue = await verdantAnchor.calculateBondValue(1);
            expect(bondValue).to.be.below(ethers.parseEther("1.0"));

            const appreciation = await verdantAnchor.calculateAppreciation(1);
            expect(appreciation).to.be.below(0); // Depreciation
        });

        it("Should reject invalid score inputs", async function () {
            // Soil health > 10000
            await expect(
                verdantAnchor.submitRegenerationMetrics(1, 15000, 5000, 5000, 5000, 5000, true, "Invalid")
            ).to.be.reverted;

            // Biodiversity > 10000
            await expect(
                verdantAnchor.submitRegenerationMetrics(1, 5000, 15000, 5000, 5000, 5000, true, "Invalid")
            ).to.be.reverted;

            // Carbon sequestration > 10000
            await expect(
                verdantAnchor.submitRegenerationMetrics(1, 5000, 5000, 15000, 5000, 5000, true, "Invalid")
            ).to.be.reverted;

            // Water quality > 10000
            await expect(
                verdantAnchor.submitRegenerationMetrics(1, 5000, 5000, 5000, 15000, 5000, true, "Invalid")
            ).to.be.reverted;

            // Ecosystem resilience > 10000
            await expect(
                verdantAnchor.submitRegenerationMetrics(1, 5000, 5000, 5000, 5000, 15000, true, "Invalid")
            ).to.be.reverted;
        });

        it("Should allow anyone to submit metrics (transparency)", async function () {
            // Regenerator submits
            await verdantAnchor.connect(regenerator).submitRegenerationMetrics(
                1, 7000, 7000, 7000, 7000, 7000, true, "Month 1"
            );

            // Landowner submits
            await verdantAnchor.connect(landowner).submitRegenerationMetrics(
                1, 7500, 7500, 7500, 7500, 7500, true, "Month 2"
            );

            // Observer submits
            await verdantAnchor.connect(observer).submitRegenerationMetrics(
                1, 8000, 8000, 8000, 8000, 8000, true, "Month 3 - independent verification"
            );

            // All metrics recorded, latest used for bond value
            const bondValue = await verdantAnchor.calculateBondValue(1);
            expect(bondValue).to.be.above(ethers.parseEther("1.0"));
        });
    });

    describe("Local Verification - Anti-Greenwashing", function () {
        beforeEach(async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address,
                "Green Project",
                "Spain, Andalusia",
                "Rewilding",
                { value: ethers.parseEther("1.0") }
            );

            await verdantAnchor.submitRegenerationMetrics(
                1, 8000, 8000, 8000, 8000, 8000, true, "Claimed improvements"
            );
        });

        it("Should allow local residents to verify real regeneration", async function () {
            const tx = await verdantAnchor.connect(localResident1).addLocalVerification(
                1,
                "Andalusia, Spain",
                true,  // confirmsPhysicalWork
                true,  // confirmsEcologicalImprovement
                true,  // confirmsNoGreenwashing
                true,  // isLocalResident
                "Neighbor - live 2km away",
                "I walk past this land daily. Significant improvement - birds returning, soil looks healthier"
            );

            await expect(tx)
                .to.emit(verdantAnchor, "LocalVerificationAdded")
                .withArgs(1, localResident1.address, await time.latest());
        });

        it("Should allow multiple local verifications for credibility", async function () {
            // First local resident - positive
            await verdantAnchor.connect(localResident1).addLocalVerification(
                1, "Andalusia", true, true, true, true, "Farmer nearby", "Real improvements visible"
            );

            // Second local resident - also positive
            await verdantAnchor.connect(localResident2).addLocalVerification(
                1, "Andalusia", true, true, true, true, "Local resident", "Biodiversity increasing"
            );

            // Check greenwashing penalty status (should be FALSE with 2 positive verifications)
            const shouldPenalize = await verdantAnchor.shouldActivateGreenwashingPenalty(1);
            expect(shouldPenalize).to.be.false;
        });

        it("Should detect greenwashing when no verifications exist", async function () {
            // No verifications yet
            const shouldPenalize = await verdantAnchor.shouldActivateGreenwashingPenalty(1);
            expect(shouldPenalize).to.be.true; // Penalty because no one verified
        });

        it("Should detect greenwashing when locals report it's fake", async function () {
            // First verification - negative (greenwashing)
            await verdantAnchor.connect(localResident1).addLocalVerification(
                1,
                "Andalusia",
                false, // NO physical work
                false, // NO ecological improvement
                false, // GREENWASHING
                true,
                "Local farmer",
                "This is fake - no real work happening, just marketing"
            );

            // Second verification - also negative
            await verdantAnchor.connect(localResident2).addLocalVerification(
                1,
                "Andalusia",
                false, // NO physical work
                false, // NO improvement
                false, // GREENWASHING
                true,
                "Neighbor",
                "Nothing changed, same degraded land"
            );

            // Check greenwashing penalty (should be TRUE)
            const shouldPenalize = await verdantAnchor.shouldActivateGreenwashingPenalty(1);
            expect(shouldPenalize).to.be.true;
        });

        it("Should handle mixed verifications (majority rules)", async function () {
            // 2 positive verifications
            await verdantAnchor.connect(localResident1).addLocalVerification(
                1, "Andalusia", true, true, true, true, "Farmer", "Real work"
            );

            await verdantAnchor.connect(localResident2).addLocalVerification(
                1, "Andalusia", true, true, true, true, "Resident", "Improvements visible"
            );

            // 1 negative verification
            await verdantAnchor.connect(observer).addLocalVerification(
                1, "Andalusia", false, false, false, false, "Skeptic", "Not convinced"
            );

            // 2 out of 3 are positive (66% > 50% threshold)
            const shouldPenalize = await verdantAnchor.shouldActivateGreenwashingPenalty(1);
            expect(shouldPenalize).to.be.false;
        });
    });

    describe("Distribution Flow - Regenerator + Landowner Split", function () {
        beforeEach(async function () {
            // V2 distributions with positive appreciation require the yield pool to be funded.
            await verdantAnchor.connect(owner).fundYieldPool({ value: ethers.parseEther("100") });

            await verdantAnchor.connect(regenerator).createBond(
                landowner.address,
                "Regeneration Co",
                "New Zealand, North Island",
                "Native forest restoration",
                { value: ethers.parseEther("1.0") }
            );

            // Submit excellent metrics
            await verdantAnchor.submitRegenerationMetrics(
                1, 9000, 9000, 9000, 9000, 9000, true, "Outstanding regeneration"
            );

            // Add local verifications (prevent greenwashing penalty)
            await verdantAnchor.connect(localResident1).addLocalVerification(
                1, "North Island", true, true, true, true, "Local", "Real work confirmed"
            );

            await verdantAnchor.connect(localResident2).addLocalVerification(
                1, "North Island", true, true, true, true, "Farmer", "Forest returning"
            );
        });

        it("Should request distribution (start timelock)", async function () {
            const tx = await verdantAnchor.connect(regenerator).requestDistribution(1);
            const receipt = await tx.wait();

            const bond = await verdantAnchor.getBond(1);
            expect(bond.distributionPending).to.be.true;

            const timelock = 604800; // 7 days
            await expect(tx)
                .to.emit(verdantAnchor, "DistributionRequested")
                .withArgs(1, regenerator.address, await time.latest(), bond.distributionRequestedAt + BigInt(timelock));
        });

        it("Should reject distribution before timelock expires", async function () {
            await verdantAnchor.connect(regenerator).requestDistribution(1);

            // Try to distribute immediately (should fail)
            await expect(
                verdantAnchor.connect(regenerator).distributeBond(1)
            ).to.be.revertedWith("Timelock not expired");
        });

        it("Should distribute with 50/40/10 split (regenerator/landowner/earth fund)", async function () {
            await verdantAnchor.connect(regenerator).requestDistribution(1);

            // Fast forward 7 days
            await time.increase(604800);

            const appreciation = await verdantAnchor.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);

            // Get balances before
            const regeneratorBalBefore = await ethers.provider.getBalance(regenerator.address);
            const landownerBalBefore = await ethers.provider.getBalance(landowner.address);

            // Distribute
            const tx = await verdantAnchor.connect(regenerator).distributeBond(1);
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            // Get balances after
            const regeneratorBalAfter = await ethers.provider.getBalance(regenerator.address);
            const landownerBalAfter = await ethers.provider.getBalance(landowner.address);

            // Calculate expected shares
            const regeneratorShare = (appreciation * BigInt(50)) / BigInt(100);
            const landownerShare = (appreciation * BigInt(40)) / BigInt(100);
            const fundShare = (appreciation * BigInt(10)) / BigInt(100);

            // Verify distributions
            expect(regeneratorBalAfter + gasCost - regeneratorBalBefore).to.be.closeTo(regeneratorShare, ethers.parseEther("0.001"));
            expect(landownerBalAfter - landownerBalBefore).to.equal(landownerShare);

            const earthFund = await verdantAnchor.earthFund();
            expect(earthFund).to.equal(fundShare);

            await expect(tx).to.emit(verdantAnchor, "BondDistributed");
        });

        it("Should apply greenwashing penalty - landowner gets 100%, regenerator gets 0%", async function () {
            // Create new bond without verifications (greenwashing)
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Fake Green", "Location", "Type",
                { value: ethers.parseEther("1.0") }
            );

            // Submit high metrics but NO LOCAL VERIFICATION (greenwashing)
            await verdantAnchor.submitRegenerationMetrics(
                2, 9000, 9000, 9000, 9000, 9000, true, "Claimed improvements but no one verified"
            );

            // Check penalty
            const shouldPenalize = await verdantAnchor.shouldActivateGreenwashingPenalty(2);
            expect(shouldPenalize).to.be.true;

            // Request and distribute
            await verdantAnchor.connect(regenerator).requestDistribution(2);
            await time.increase(604800);

            const regeneratorBalBefore = await ethers.provider.getBalance(regenerator.address);
            const landownerBalBefore = await ethers.provider.getBalance(landowner.address);

            const tx = await verdantAnchor.connect(regenerator).distributeBond(2);
            await expect(tx).to.emit(verdantAnchor, "GreenwashingPenalty");

            const regeneratorBalAfter = await ethers.provider.getBalance(regenerator.address);
            const landownerBalAfter = await ethers.provider.getBalance(landowner.address);

            // Regenerator should get nothing (penalty)
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            expect(regeneratorBalAfter + gasCost).to.be.closeTo(regeneratorBalBefore, ethers.parseEther("0.001"));

            // Landowner gets all appreciation
            expect(landownerBalAfter).to.be.above(landownerBalBefore);
        });

        it("Should only allow regenerator to request/distribute", async function () {
            // Non-regenerator tries to request
            await expect(
                verdantAnchor.connect(landowner).requestDistribution(1)
            ).to.be.revertedWith("Only regenerator");

            // Request as regenerator
            await verdantAnchor.connect(regenerator).requestDistribution(1);
            await time.increase(604800);

            // Non-regenerator tries to distribute
            await expect(
                verdantAnchor.connect(landowner).distributeBond(1)
            ).to.be.revertedWith("Only regenerator");
        });

        it("Should reject distribution when no appreciation exists", async function () {
            // Create bond with no metrics (stays at baseline)
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "New", "Loc", "Type", { value: ethers.parseEther("1.0") }
            );

            await verdantAnchor.connect(regenerator).requestDistribution(2);
            await time.increase(604800);

            await expect(
                verdantAnchor.connect(regenerator).distributeBond(2)
            ).to.be.revertedWith("No appreciation");
        });
    });

    describe("Bond Value Calculation - Ecological Metrics", function () {
        beforeEach(async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project", "Location", "Type",
                { value: ethers.parseEther("1.0") }
            );
        });

        it("Should calculate bond value as average of 5 ecological metrics", async function () {
            // Submit metrics: average = (8000+8500+7500+9000+8000)/5 = 8200
            await verdantAnchor.submitRegenerationMetrics(
                1,
                8000,  // soil
                8500,  // biodiversity
                7500,  // carbon
                9000,  // water
                8000,  // resilience
                true,
                "Good progress"
            );

            const bondValue = await verdantAnchor.calculateBondValue(1);

            // Expected: stake * (average_score / 5000)
            // 1.0 ETH * (8200 / 5000) = 1.64 ETH
            const expectedValue = ethers.parseEther("1.64");
            expect(bondValue).to.be.closeTo(expectedValue, ethers.parseEther("0.01"));

            const appreciation = await verdantAnchor.calculateAppreciation(1);
            expect(appreciation).to.be.above(0);
        });

        it("Should return baseline value when no metrics submitted", async function () {
            const bondValue = await verdantAnchor.calculateBondValue(1);
            expect(bondValue).to.equal(ethers.parseEther("1.0")); // Stake amount
        });

        it("Should update bond value with latest metrics", async function () {
            // First metrics - moderate
            await verdantAnchor.submitRegenerationMetrics(
                1, 6000, 6000, 6000, 6000, 6000, true, "Month 1"
            );

            const value1 = await verdantAnchor.calculateBondValue(1);

            // Second metrics - excellent
            await verdantAnchor.submitRegenerationMetrics(
                1, 9000, 9000, 9000, 9000, 9000, true, "Month 6"
            );

            const value2 = await verdantAnchor.calculateBondValue(1);

            // Value should increase with better metrics
            expect(value2).to.be.above(value1);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle multiple regeneration projects from same regenerator", async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project 1", "Location 1", "Type 1",
                { value: ethers.parseEther("0.5") }
            );

            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project 2", "Location 2", "Type 2",
                { value: ethers.parseEther("1.0") }
            );

            const bond1 = await verdantAnchor.getBond(1);
            const bond2 = await verdantAnchor.getBond(2);

            expect(bond1.regenerator).to.equal(regenerator.address);
            expect(bond2.regenerator).to.equal(regenerator.address);
            expect(bond1.stakeAmount).to.equal(ethers.parseEther("0.5"));
            expect(bond2.stakeAmount).to.equal(ethers.parseEther("1.0"));
        });

        it("Should handle bond with different regenerator and landowner", async function () {
            await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project", "Location", "Type",
                { value: ethers.parseEther("1.0") }
            );

            const bond = await verdantAnchor.getBond(1);
            expect(bond.regenerator).to.equal(regenerator.address);
            expect(bond.landowner).to.equal(landowner.address);
            expect(bond.regenerator).to.not.equal(bond.landowner);
        });

        it("Should reject operations on non-existent bonds", async function () {
            await expect(
                verdantAnchor.calculateBondValue(999)
            ).to.be.revertedWith("Bond does not exist");

            await expect(
                verdantAnchor.submitRegenerationMetrics(999, 5000, 5000, 5000, 5000, 5000, true, "Invalid")
            ).to.be.revertedWith("Bond does not exist");
        });
    });

    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for bond creation", async function () {
            const tx = await verdantAnchor.connect(regenerator).createBond(
                landowner.address, "Project", "Location", "Type",
                { value: ethers.parseEther("1.0") }
            );

            const receipt = await tx.wait();
            console.log("VerdantAnchor Bond Creation Gas:", receipt.gasUsed.toString());

            expect(receipt.gasUsed).to.be.below(500000);
        });
    });
});
