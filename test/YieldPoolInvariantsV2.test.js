const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function setBalance(address, amountWei) {
  // hardhat_setBalance expects a 0x-prefixed hex string.
  const hex = ethers.toBeHex(amountWei);
  await ethers.provider.send("hardhat_setBalance", [address, hex]);
}

/**
 * Solvency / yield-pool invariants (V2)
 *
 * Invariant A: If appreciation > 0 and yieldPool < appreciation, distribution MUST revert.
 * Invariant B: Even if yieldPool accounting is sufficient, if contract balance < payout, distribution MUST revert.
 */
describe("V2 YieldPool/solvency invariants", function () {
  const cases = [
    {
      name: "AIAccountabilityBondsV2",
      deploy: async (signers) => {
        const [, humanTreasury] = signers;
        const C = await ethers.getContractFactory("AIAccountabilityBondsV2");
        return C.deploy(humanTreasury.address);
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, , ai1, ai2, ai3] = signers;
        await c.connect(ai1).createBond(
          "AI Corp",
          ethers.parseEther("100"),
          { value: ethers.parseEther("30") }
        );
        await c.connect(ai1).submitMetrics(1, 9000, 9000, 9000, 9000, 9000, 9000);
        await c.connect(ai2).submitAIVerification(1, true, "ok", { value: ethers.parseEther("1") });
        await c.connect(ai3).submitAIVerification(1, true, "ok", { value: ethers.parseEther("1") });
        await c.connect(ai1).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: ai1, appreciation: appr };
      },
    },
    {
      name: "AIPartnershipBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("AIPartnershipBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, human, aiAgent] = signers;
        await c.connect(human).createBond(aiAgent.address, "Coding assistant", { value: ethers.parseEther("1") });
        await c.connect(human).submitPartnershipMetrics(1, 9000, 9000, 9000, 10, 9000, "Great progress");
        await c.connect(human).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: human, appreciation: appr };
      },
    },
    {
      name: "BuilderBeliefBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("BuilderBeliefBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, staker, builder] = signers;
        await c.connect(staker).createBond(builder.address, "Alice", "Building", { value: ethers.parseEther("1") });
        await time.increase(45 * 24 * 60 * 60);
        await c.connect(builder).submitBuildingMetrics(1, 150, 10, 2000, 9000, 9000, 0, "build");
        await c.connect(staker).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: staker, appreciation: appr };
      },
    },
    {
      name: "CommonGroundBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("CommonGroundBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, p1, p2] = signers;
        await c.connect(p1).createBond(p2.address, "progressive", "conservative", { value: ethers.parseEther("1") });
        // Submit some bridge-building progress to produce positive appreciation.
        await c.connect(p1).submitBridgeProgress(1, 9000, 9000, 9000, 9000, "progress");
        await c.connect(p1).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: p1, appreciation: appr };
      },
    },
    {
      name: "EscapeVelocityBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("EscapeVelocityBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, escaper] = signers;
        await c.connect(escaper).createBond("John", 30000, { value: ethers.parseEther("0.0001") });
        await c.connect(escaper).submitProgress(1, 75000, 9000, 9000, 3, "Escaped!");
        await c.connect(escaper).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        // This bond can be either positive/negative depending on the formula; assert we got positive.
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: escaper, appreciation: appr };
      },
    },
    {
      name: "HealthCommonsBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("HealthCommonsBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, company] = signers;
        await c.connect(company).createBond("Test Company", "Test Region", { value: ethers.parseEther("1") });
        // Need at least 2 data points for improvement scoring.
        await c.connect(company).submitPollutionData(1, 5000, 5000, 5000, "loc0");
        await c.connect(company).submitHealthData(1, 5000, 5000, 5000, 5000, 5000, 10000, "loc0");

        // Later: large improvement.
        await time.increase(30 * 24 * 60 * 60);
        await c.connect(company).submitPollutionData(1, 9000, 9000, 9000, "loc1");
        await c.connect(company).submitHealthData(1, 9000, 9000, 9000, 9000, 9000, 10000, "loc1");

        // Community attestation boosts the multiplier.
        await c.connect(signers[2]).addCommunityAttestation(1, true, true, "I see improvements");

        // Give time-based multiplier room to grow.
        await time.increase(365 * 24 * 60 * 60);

        await c.connect(company).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: company, appreciation: appr };
      },
    },
    {
      name: "LaborDignityBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("LaborDignityBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, company] = signers;
        await c.connect(company).createBond("Test Co", 100, { value: ethers.parseEther("1") });
        await c.connect(company).submitMetrics(1, 9000, 9000, 9000, 9000, 9000, 9000);

        // Let the bond mature for positive appreciation.
        await time.increase(365 * 24 * 60 * 60);

        await c.connect(company).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: company, appreciation: appr };
      },
    },
    {
      name: "PurchasingPowerBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("PurchasingPowerBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, company, worker1, worker2] = signers;
        await c.connect(company).createBond(100, { value: ethers.parseEther("1") });
        // Provide attestations so purchasing power improves.
        await c.connect(worker1).addWorkerAttestation(1, true, true, true, true, true);
        await c.connect(worker2).addWorkerAttestation(1, true, true, true, true, true);
        await c.connect(company).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: company, appreciation: appr };
      },
    },
    {
      name: "VerdantAnchorBondsV2",
      deploy: async () => {
        const C = await ethers.getContractFactory("VerdantAnchorBondsV2");
        return C.deploy();
      },
      setupPositiveAppreciationBond: async (c, signers) => {
        const [, regenerator, landowner] = signers;
        await c
          .connect(regenerator)
          .createBond(landowner.address, "Farmer Joe", "Oregon", "Reforestation", { value: ethers.parseEther("1") });
        await c.connect(regenerator).submitRegenerationMetrics(1, 9000, 9000, 9000, 9000, 9000, true, "work");
        await c.connect(regenerator).requestDistribution(1);
        await time.increase(7 * 24 * 60 * 60);
        const appr = await c.calculateAppreciation(1);
        expect(appr).to.be.gt(0);
        return { bondId: 1, caller: regenerator, appreciation: appr };
      },
    },
  ];

  for (const tc of cases) {
    describe(tc.name, function () {
      it("reverts positive-appreciation distribution when yield pool is insufficient", async function () {
        const signers = await ethers.getSigners();
        const c = await tc.deploy(signers);
        const { bondId, caller } = await tc.setupPositiveAppreciationBond(c, signers);

        await expect(c.connect(caller).distributeBond(bondId)).to.be.revertedWith(
          "Insufficient yield pool for distribution"
        );
      });

      it("reverts distribution when contract ETH balance cannot cover payout (even if yieldPool accounting can)", async function () {
        const signers = await ethers.getSigners();
        const c = await tc.deploy(signers);
        const { bondId, caller } = await tc.setupPositiveAppreciationBond(c, signers);

        // Overfund yield pool so the internal accounting check passes.
        await c.fundYieldPool({ value: ethers.parseEther("100") });

        // Force the contract's actual ETH balance below the required payout.
        await setBalance(await c.getAddress(), 0n);

        await expect(c.connect(caller).distributeBond(bondId)).to.be.revertedWith(
          "Insufficient contract balance for distribution"
        );
      });
    });
  }
});
