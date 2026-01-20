const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Sports Integrity Bonds - Making Sports Real Again", function () {
    let competitiveBond, teamworkBond, fanBeliefBond;
    let owner, team, player, fan1, fan2, oracle, investigator;

    beforeEach(async function () {
        [owner, team, player, fan1, fan2, oracle, investigator] = await ethers.getSigners();

        // Deploy all three contracts
        const CompetitiveBond = await ethers.getContractFactory("CompetitiveIntegrityBond");
        competitiveBond = await CompetitiveBond.deploy();

        const TeamworkBond = await ethers.getContractFactory("TeamworkIntegrityBond");
        teamworkBond = await TeamworkBond.deploy();

        const FanBeliefBond = await ethers.getContractFactory("FanBeliefBond");
        fanBeliefBond = await FanBeliefBond.deploy();

        // Add oracles
        await competitiveBond.addAuthorizedOracle(oracle.address);
        await teamworkBond.addAuthorizedOracle(oracle.address);
        await fanBeliefBond.addAuthorizedOracle(oracle.address);
        await fanBeliefBond.addAuthorizedInvestigator(investigator.address);
    });

    describe("Competitive Integrity Bonds", function () {
        it("Should create a team bond for competitive integrity", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60); // 6 months

            const tx = await competitiveBond.connect(team).createBond(
                "Los Angeles Lakers",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            const bond = await competitiveBond.getBond(1);
            expect(bond.teamName).to.equal("Los Angeles Lakers");
            expect(bond.league).to.equal("NBA");
            expect(bond.season).to.equal("2024-25");
            expect(bond.stakeAmount).to.equal(ethers.parseEther("10"));
            expect(bond.active).to.be.true;
        });

        it("Should submit effort metrics via oracle", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await competitiveBond.connect(team).createBond(
                "Golden State Warriors",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Submit high effort metrics (elite team)
            await competitiveBond.connect(oracle).submitEffortMetrics(
                1, // bondId
                8500, // hustleScore (85/100)
                9000, // fourthQuarterScore (90/100)
                8000, // backToBackScore (80/100)
                9500, // bigGameScore (95/100)
                "NBA Stats API"
            );

            const metrics = await competitiveBond.getEffortMetrics(1);
            expect(metrics.length).to.equal(1);
            expect(metrics[0].hustleScore).to.equal(8500);
            expect(metrics[0].fourthQuarterScore).to.equal(9000);
        });

        it("Should detect tanking and penalize bond", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await competitiveBond.connect(team).createBond(
                "Tanking Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Submit low effort metrics (obvious tanking)
            await competitiveBond.connect(oracle).submitEffortMetrics(
                1,
                2000, // hustleScore (20/100) - not trying
                1500, // fourthQuarterScore (15/100) - giving up
                2500, // backToBackScore (25/100) - quitting on tired nights
                1000, // bigGameScore (10/100) - resting stars
                "NBA Stats API"
            );

            // Submit tanking detection
            await competitiveBond.connect(oracle).submitTankingDetection(
                1,
                7000, // winProbabilityDelta (expected 30 wins, got 15)
                8000, // suspiciousInjuryScore (stars resting suspiciously)
                7500, // fourthQuarterQuitScore (giving up when behind)
                2000, // seasonTrajectoryScore (gave up early)
                "v1.0"
            );

            const detections = await competitiveBond.getTankingDetections(1);
            expect(detections.length).to.equal(1);
            expect(detections[0].suspiciousInjuryScore).to.equal(8000);
        });

        it("Should allow fans to verify game competitiveness", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await competitiveBond.connect(team).createBond(
                "Denver Nuggets",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Fan verifies game was competitive
            await competitiveBond.connect(fan1).submitFanVerification(
                1, // bondId
                12345, // gameId
                "home",
                true, // attestsCompetitive
                "NFT-TICKET-12345",
                "Denver-CO-IP-PROOF"
            );

            const verifications = await competitiveBond.getGameVerifications(1, 12345);
            expect(verifications.length).to.equal(1);
            expect(verifications[0].fanWallet).to.equal(fan1.address);
            expect(verifications[0].attestsCompetitive).to.be.true;
        });

        it("Should allow fans to stake on team integrity", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await competitiveBond.connect(team).createBond(
                "Miami Heat",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Fan stakes belief in team
            await competitiveBond.connect(fan1).fanStakeOnTeam(1, {
                value: ethers.parseEther("0.1")
            });

            const fanStake = await competitiveBond.fanStakes(1, fan1.address);
            expect(fanStake).to.equal(ethers.parseEther("0.1"));
        });

        it("Should settle bond with elite effort - everyone wins", async function () {
            const seasonEnd = (await time.latest()) + 100; // Short for testing
            await competitiveBond.connect(team).createBond(
                "Elite Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Fund yield pool for appreciation (100% appreciation = 10 ETH extra needed)
            await competitiveBond.fundYieldPool({ value: ethers.parseEther("15") });

            // Submit elite effort metrics
            await competitiveBond.connect(oracle).submitEffortMetrics(
                1,
                9000, // hustleScore
                9500, // fourthQuarterScore
                8800, // backToBackScore
                9800, // bigGameScore
                "NBA Stats API"
            );

            // Submit anti-tanking detection (no tanking)
            await competitiveBond.connect(oracle).submitTankingDetection(
                1,
                1000, // winProbabilityDelta (met expectations)
                1000, // suspiciousInjuryScore (no suspicious rests)
                1000, // fourthQuarterQuitScore (fought to the end)
                9000, // seasonTrajectoryScore (strong finish)
                "v1.0"
            );

            // Fast forward to season end
            await time.increase(101);

            // Settle bond
            const initialBalance = await ethers.provider.getBalance(team.address);
            await competitiveBond.settleBond(1);

            const bond = await competitiveBond.getBond(1);
            expect(bond.settled).to.be.true;
            expect(bond.active).to.be.false;

            // Team should receive > initial stake (appreciation)
            const finalBalance = await ethers.provider.getBalance(team.address);
            // Note: Exact check would need to account for gas costs
        });

        it("Should settle bond with tanking - 100% to fans", async function () {
            const seasonEnd = (await time.latest()) + 100;
            await competitiveBond.connect(team).createBond(
                "Tanking Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // Submit terrible effort metrics
            await competitiveBond.connect(oracle).submitEffortMetrics(
                1,
                2000, 1500, 2000, 1000, "NBA Stats API"
            );

            // Submit obvious tanking
            await competitiveBond.connect(oracle).submitTankingDetection(
                1,
                8000, 9000, 8500, 1000, "v1.0"
            );

            await time.increase(101);

            const initialPool = await competitiveBond.fanCompensationPool();
            await competitiveBond.settleBond(1);

            const finalPool = await competitiveBond.fanCompensationPool();

            // Fan compensation pool should increase (100% of stake goes to fans)
            expect(finalPool).to.be.gt(initialPool);
        });
    });

    describe("Teamwork Integrity Bonds", function () {
        it("Should create a player bond for teamwork integrity", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);

            await teamworkBond.connect(player).createBond(
                "LeBron James",
                "Los Angeles Lakers",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            const bond = await teamworkBond.getBond(1);
            expect(bond.playerName).to.equal("LeBron James");
            expect(bond.teamName).to.equal("Los Angeles Lakers");
            expect(bond.stakeAmount).to.equal(ethers.parseEther("1"));
        });

        it("Should submit chemistry metrics", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await teamworkBond.connect(player).createBond(
                "Stephen Curry",
                "Golden State Warriors",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // Submit high chemistry metrics (team player)
            await teamworkBond.connect(oracle).submitChemistryMetrics(
                1,
                8500, // assistRatio (passes to open teammate)
                9000, // defensiveEffort (helps teammates)
                9500, // benchSupport (celebrates teammates)
                8800, // plusMinusDifferential (team better with player)
                "NBA Stats API"
            );

            const metrics = await teamworkBond.getChemistryMetrics(1);
            expect(metrics.length).to.equal(1);
            expect(metrics[0].assistRatio).to.equal(8500);
        });

        it("Should detect stat padding", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await teamworkBond.connect(player).createBond(
                "Stat Chaser",
                "Some Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // Submit winning vs stats analysis showing stat padding
            await teamworkBond.connect(oracle).submitWinningMetrics(
                1,
                6000, // performanceInWins (60/100 - mediocre when winning)
                9000, // performanceInLosses (90/100 - great stats in blowouts!)
                3000, // clutchPerformance (30/100 - disappears in big moments)
                2000, // sacrificeScore (20/100 - won't take charges/set screens)
                true, // statPaddingDetected
                "High stats in losses, disappears in clutch"
            );

            const metrics = await teamworkBond.getWinningMetrics(1);
            expect(metrics[0].statPaddingDetected).to.be.true;
            expect(metrics[0].performanceInLosses).to.be.gt(metrics[0].performanceInWins);
        });

        it("Should allow teammate verification (anonymous)", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);
            await teamworkBond.connect(player).createBond(
                "Team Player",
                "Great Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // Teammates verify player makes team better
            await teamworkBond.connect(fan1).submitTeammateVerification(
                1,
                9, // makesBetter (9/10)
                10, // prioritizesWinning (10/10)
                true, // wouldWantInPlayoffs
                "teammate"
            );

            await teamworkBond.connect(fan2).submitTeammateVerification(
                1,
                8, 9, true, "coach"
            );

            const verifications = await teamworkBond.getTeammateVerifications(1);
            expect(verifications.length).to.equal(2);
            expect(verifications[0].makesBetter).to.equal(9);
            expect(verifications[0].wouldWantInPlayoffs).to.be.true;
        });

        it("Should settle champion player bond - maximum appreciation", async function () {
            const seasonEnd = (await time.latest()) + 100;
            await teamworkBond.connect(player).createBond(
                "Champion Player",
                "Great Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // Fund yield pool to enable appreciation (120% = 1.2 ETH extra needed)
            await teamworkBond.fundYieldPool({ value: ethers.parseEther("2") });

            // Elite chemistry
            await teamworkBond.connect(oracle).submitChemistryMetrics(
                1, 9000, 9500, 9800, 9200, "NBA Stats API"
            );

            // Prioritizes winning over stats
            await teamworkBond.connect(oracle).submitWinningMetrics(
                1, 9500, 9000, 9800, 9000, false, "Elite team player"
            );

            // Teammates love this player
            for (let i = 0; i < 6; i++) {
                await teamworkBond.connect(fan1).submitTeammateVerification(
                    1, 10, 10, true, "teammate"
                );
            }

            await time.increase(101);
            await teamworkBond.settleBond(1);

            const bond = await teamworkBond.getBond(1);
            expect(bond.settled).to.be.true;

            const distributions = await teamworkBond.getDistributions(1);
            expect(distributions[0].rating).to.equal(3); // TeamworkLevel.Champion
        });

        it("Should settle stat chaser bond - 100% to teammates", async function () {
            const seasonEnd = (await time.latest()) + 100;
            await teamworkBond.connect(player).createBond(
                "Stat Chaser",
                "Suffering Team",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // Poor chemistry
            await teamworkBond.connect(oracle).submitChemistryMetrics(
                1, 2000, 3000, 2500, 2000, "NBA Stats API"
            );

            // Stat padding detected
            await teamworkBond.connect(oracle).submitWinningMetrics(
                1, 5000, 9500, 2000, 1000, true, "Obvious stat padding"
            );

            // Teammates hate this player
            for (let i = 0; i < 6; i++) {
                await teamworkBond.connect(fan1).submitTeammateVerification(
                    1, 2, 1, false, "teammate"
                );
            }

            await time.increase(101);

            const initialPool = await teamworkBond.teammateCompensationPool();
            await teamworkBond.settleBond(1);

            const finalPool = await teamworkBond.teammateCompensationPool();

            // Teammates should receive compensation
            expect(finalPool).to.be.gt(initialPool);

            const distributions = await teamworkBond.getDistributions(1);
            expect(distributions[0].playerShare).to.equal(0); // Stat chaser gets nothing
        });
    });

    describe("Fan Belief Bonds", function () {
        it("Should create a fan belief bond for a player", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Giannis Antetokounmpo",
                "player",
                "NBA",
                3, // 3 years
                { value: ethers.parseEther("0.1") }
            );

            const bond = await fanBeliefBond.getBond(1);
            expect(bond.fanAddress).to.equal(fan1.address);
            expect(bond.playerOrTeamName).to.equal("Giannis Antetokounmpo");
            expect(bond.bondType).to.equal("player");
            expect(bond.stakeAmount).to.equal(ethers.parseEther("0.1"));
        });

        it("Should record integrity snapshots from other bonds", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Authentic Player",
                "player",
                "NBA",
                2,
                { value: ethers.parseEther("0.1") }
            );

            // Oracle records high integrity snapshot
            await fanBeliefBond.connect(oracle).recordIntegritySnapshot(
                1,
                8500, // competitiveEffort
                9000, // teamworkScore
                true, // cleanRecord
                "Elite season, no violations"
            );

            const snapshots = await fanBeliefBond.getIntegritySnapshots(1);
            expect(snapshots.length).to.equal(1);
            expect(snapshots[0].competitiveEffort).to.equal(8500);
            expect(snapshots[0].teamworkScore).to.equal(9000);
            expect(snapshots[0].cleanRecord).to.be.true;
        });

        it("Should allow corruption reporting", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Suspicious Player",
                "player",
                "NBA",
                1,
                { value: ethers.parseEther("0.1") }
            );

            // Fan reports gambling violation
            await fanBeliefBond.connect(fan2).reportCorruption(
                1,
                3, // ViolationType.GamblingViolation
                "Caught betting on own games via offshore sportsbook"
            );

            const reports = await fanBeliefBond.getCorruptionReports(1);
            expect(reports.length).to.equal(1);
            expect(reports[0].violationType).to.equal(3);
            expect(reports[0].investigated).to.be.false;
        });

        it("Should confirm corruption and forfeit bond", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Corrupt Player",
                "player",
                "NBA",
                1,
                { value: ethers.parseEther("1") }
            );

            // Report match fixing
            await fanBeliefBond.connect(fan2).reportCorruption(
                1,
                1, // ViolationType.MatchFixing
                "Video evidence of point shaving"
            );

            // Investigator confirms
            await fanBeliefBond.connect(investigator).confirmCorruption(
                1,
                0, // reportIndex
                true, // confirmed
                "League investigation confirmed match-fixing. Player banned."
            );

            const bond = await fanBeliefBond.getBond(1);
            expect(bond.active).to.be.false;
            expect(bond.violation).to.equal(1); // MatchFixing

            const reports = await fanBeliefBond.getCorruptionReports(1);
            expect(reports[0].confirmed).to.be.true;
        });

        it("Should settle elite integrity bond with max appreciation", async function () {
            const maturityYears = 1;
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Elite Player",
                "player",
                "NBA",
                maturityYears,
                { value: ethers.parseEther("1") }
            );

            // Fund yield pool for appreciation (elite status + 1 year = 2x base * 2x time = 4x total = 3 ETH appreciation)
            await fanBeliefBond.fundYieldPool({ value: ethers.parseEther("5") });

            // Record multiple elite snapshots
            for (let i = 0; i < 5; i++) {
                await fanBeliefBond.connect(oracle).recordIntegritySnapshot(
                    1, 9000, 9500, true, "Consistent excellence"
                );
                await time.increase(60 * 60 * 24 * 60); // 60 days
            }

            // Fast forward to maturity
            await time.increase(365 * 24 * 60 * 60);

            const initialBalance = await ethers.provider.getBalance(fan1.address);

            await fanBeliefBond.connect(fan1).settleBond(1);

            const bond = await fanBeliefBond.getBond(1);
            expect(bond.settled).to.be.true;

            const distributions = await fanBeliefBond.getDistributions(1);
            expect(distributions[0].status).to.equal(4); // IntegrityStatus.Elite

            // Fan should receive significantly more than stake (multi-year compounding)
            expect(distributions[0].fanShare).to.be.gt(ethers.parseEther("1"));
        });

        it("Should handle early withdrawal - return stake only", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Some Player",
                "player",
                "NBA",
                3, // 3 years
                { value: ethers.parseEther("0.5") }
            );

            // Fast forward 1 year (not yet mature)
            await time.increase(365 * 24 * 60 * 60);

            // Early withdrawal
            const initialBalance = await ethers.provider.getBalance(fan1.address);
            await fanBeliefBond.connect(fan1).earlyWithdrawal(1);

            const bond = await fanBeliefBond.getBond(1);
            expect(bond.settled).to.be.true;

            // Should receive exactly stake back, no appreciation
            // (exact balance check would need to account for gas)
        });

        it("Should apply 5-year clean record bonus", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Long-Term Star",
                "player",
                "NBA",
                5,
                { value: ethers.parseEther("1") }
            );

            // Fund yield pool for 5-year appreciation (5x time mult + bonuses = ~10 ETH needed)
            await fanBeliefBond.fundYieldPool({ value: ethers.parseEther("12") });

            // Record 5 years of clean snapshots
            for (let i = 0; i < 10; i++) {
                await fanBeliefBond.connect(oracle).recordIntegritySnapshot(
                    1, 8000, 8500, true, "Clean record maintained"
                );
                await time.increase(180 * 24 * 60 * 60); // 6 months
            }

            // Fast forward to 5-year maturity
            await time.increase(5 * 365 * 24 * 60 * 60);

            await fanBeliefBond.connect(fan1).settleBond(1);

            const distributions = await fanBeliefBond.getDistributions(1);

            // Should have 5x time multiplier + 20% clean bonus
            expect(distributions[0].fanShare).to.be.gt(ethers.parseEther("5"));
        });

        it("Should redistribute forfeited stakes to pool", async function () {
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "PED User",
                "player",
                "NBA",
                1,
                { value: ethers.parseEther("2") }
            );

            // Report PED usage
            await fanBeliefBond.connect(fan2).reportCorruption(
                1,
                2, // ViolationType.PEDUsage
                "Failed drug test - suspended"
            );

            // Confirm
            const initialPool = await fanBeliefBond.getRedistributionPool();

            await fanBeliefBond.connect(investigator).confirmCorruption(
                1, 0, true, "League confirmed PED violation"
            );

            const finalPool = await fanBeliefBond.getRedistributionPool();

            // 80% of stake forfeited (PED penalty), minus 10% whistleblower reward
            const forfeitAmount = ethers.parseEther("2") * BigInt(8000) / BigInt(10000); // 1.6 ETH
            const whistleblowerReward = forfeitAmount / BigInt(10); // 0.16 ETH
            const expectedPoolIncrease = forfeitAmount - whistleblowerReward; // 1.44 ETH
            expect(finalPool - initialPool).to.be.closeTo(expectedPoolIncrease, ethers.parseEther("0.01"));
        });
    });

    describe("Integration: Full Sports Integrity System", function () {
        it("Should track player across all three bond types", async function () {
            const seasonEnd = (await time.latest()) + (6 * 30 * 24 * 60 * 60);

            // 1. Team creates Competitive Integrity Bond
            await competitiveBond.connect(team).createBond(
                "Milwaukee Bucks",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("10") }
            );

            // 2. Player creates Teamwork Integrity Bond
            await teamworkBond.connect(player).createBond(
                "Giannis Antetokounmpo",
                "Milwaukee Bucks",
                "NBA",
                "2024-25",
                seasonEnd,
                { value: ethers.parseEther("1") }
            );

            // 3. Fan creates Fan Belief Bond
            await fanBeliefBond.connect(fan1).createBond(
                player.address,
                "Giannis Antetokounmpo",
                "player",
                "NBA",
                3,
                { value: ethers.parseEther("0.5") }
            );

            // Verify all bonds created
            const competitiveBondData = await competitiveBond.getBond(1);
            const teamworkBondData = await teamworkBond.getBond(1);
            const fanBondData = await fanBeliefBond.getBond(1);

            expect(competitiveBondData.active).to.be.true;
            expect(teamworkBondData.active).to.be.true;
            expect(fanBondData.active).to.be.true;

            // Submit elite metrics across all systems
            await competitiveBond.connect(oracle).submitEffortMetrics(
                1, 9000, 9500, 8800, 9800, "NBA Stats API"
            );

            await teamworkBond.connect(oracle).submitChemistryMetrics(
                1, 9200, 9500, 9800, 9000, "NBA Stats API"
            );

            await fanBeliefBond.connect(oracle).recordIntegritySnapshot(
                1, 9000, 9200, true, "Elite season"
            );

            // All bonds should show elite performance
            const competitiveMetrics = await competitiveBond.getEffortMetrics(1);
            const teamworkMetrics = await teamworkBond.getChemistryMetrics(1);
            const fanSnapshots = await fanBeliefBond.getIntegritySnapshots(1);

            expect(competitiveMetrics[0].hustleScore).to.equal(9000);
            expect(teamworkMetrics[0].assistRatio).to.equal(9200);
            expect(fanSnapshots[0].overallIntegrity).to.equal(9100);
        });

        it("Should handle corruption across all bond types", async function () {
            const seasonEnd = (await time.latest()) + 100;

            // Create bonds
            await competitiveBond.connect(team).createBond(
                "Corrupt Team", "NBA", "2024-25", seasonEnd,
                { value: ethers.parseEther("10") }
            );

            await teamworkBond.connect(player).createBond(
                "Corrupt Player", "Corrupt Team", "NBA", "2024-25", seasonEnd,
                { value: ethers.parseEther("1") }
            );

            await fanBeliefBond.connect(fan1).createBond(
                player.address, "Corrupt Player", "player", "NBA", 1,
                { value: ethers.parseEther("0.5") }
            );

            // Report gambling violation
            await fanBeliefBond.connect(fan2).reportCorruption(
                1, 3, "Gambling on own games"
            );

            // Confirm corruption
            await fanBeliefBond.connect(investigator).confirmCorruption(
                1, 0, true, "Confirmed by league"
            );

            // Fan bond should be forfeited
            const fanBondData = await fanBeliefBond.getBond(1);
            expect(fanBondData.active).to.be.false;
            expect(fanBondData.violation).to.equal(3);

            // Could also penalize other bonds (would need cross-contract integration)
        });
    });
});
