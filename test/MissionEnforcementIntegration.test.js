const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// MissionEnforcement.CorePrinciple enum indices
const HUMAN_VERIFICATION_FINAL_SAY = 0;
const AI_PROFIT_CAPS = 1;
const PRIVACY_DEFAULT = 2;
const COMMUNITY_CHALLENGES = 3;

describe("MissionEnforcement integration (optional gating)", function () {
  let owner, human, aiAgent, aiCompany, treasury;
  let mission, partnership, accountability;

  beforeEach(async function () {
    [owner, human, aiAgent, aiCompany, treasury] = await ethers.getSigners();

    const MissionEnforcement = await ethers.getContractFactory("MissionEnforcement");
    mission = await MissionEnforcement.connect(owner).deploy();

    const AIPartnership = await ethers.getContractFactory("AIPartnershipBondsV2");
    partnership = await AIPartnership.connect(owner).deploy();

    const AIAccountability = await ethers.getContractFactory("AIAccountabilityBondsV2");
    accountability = await AIAccountability.connect(owner).deploy(treasury.address);

    // Wire mission enforcement addresses but leave disabled by default
    await partnership.connect(owner).setMissionEnforcement(await mission.getAddress());
    await accountability.connect(owner).setMissionEnforcement(await mission.getAddress());
  });

  it("Default: mission enforcement disabled does not block distributions", async function () {
    // Partnership bond
    await partnership.connect(human).createBond(aiAgent.address, "test", { value: ethers.parseEther("1") });

    // Add metrics so value appreciates
    await partnership.connect(human).submitPartnershipMetrics(1, 9000, 9000, 9000, 1, 9000, "thriving");

    // Fund yield pool and request distribution
    await partnership.connect(owner).fundYieldPool({ value: ethers.parseEther("10") });
    await partnership.connect(human).requestDistribution(1);
    await time.increase(7 * 24 * 60 * 60);

    await expect(partnership.connect(human).distributeBond(1)).to.not.be.reverted;

    // Accountability bond
    await accountability.connect(aiCompany).createBond("AI Co", ethers.parseEther("100"), { value: ethers.parseEther("30") });
    await accountability.connect(aiCompany).submitMetrics(1, 8000, 8000, 8000, 8000, 8000, 8000);

    await accountability.connect(owner).fundYieldPool({ value: ethers.parseEther("200") });
    await accountability.connect(aiCompany).requestDistribution(1);
    await time.increase(7 * 24 * 60 * 60);

    await expect(accountability.connect(aiCompany).distributeBond(1)).to.not.be.reverted;
  });

  it("Enabled: distributions revert if module not certified mission-compliant", async function () {
    await partnership.connect(human).createBond(aiAgent.address, "test", { value: ethers.parseEther("1") });
    await partnership.connect(human).submitPartnershipMetrics(1, 9000, 9000, 9000, 1, 9000, "thriving");
    await partnership.connect(owner).fundYieldPool({ value: ethers.parseEther("10") });
    await partnership.connect(human).requestDistribution(1);
    await time.increase(7 * 24 * 60 * 60);

    await partnership.connect(owner).setMissionEnforcementEnabled(true);

    await expect(partnership.connect(human).distributeBond(1)).to.be.revertedWith("Mission: human final say");
  });

  it("Enabled: distributions succeed once module is certified compliant", async function () {
    // Partnership
    await partnership.connect(human).createBond(aiAgent.address, "test", { value: ethers.parseEther("1") });
    await partnership.connect(human).submitPartnershipMetrics(1, 9000, 9000, 9000, 1, 9000, "thriving");
    await partnership.connect(owner).fundYieldPool({ value: ethers.parseEther("10") });
    await partnership.connect(human).requestDistribution(1);
    await time.increase(7 * 24 * 60 * 60);

    await partnership.connect(owner).setMissionEnforcementEnabled(true);

    const partnershipAddr = await partnership.getAddress();
    await mission.connect(owner).certifyModuleMissionCompliant(partnershipAddr, [HUMAN_VERIFICATION_FINAL_SAY, AI_PROFIT_CAPS, PRIVACY_DEFAULT]);

    await expect(partnership.connect(human).distributeBond(1)).to.not.be.reverted;

    // Accountability
    await accountability.connect(aiCompany).createBond("AI Co", ethers.parseEther("100"), { value: ethers.parseEther("30") });
    await accountability.connect(aiCompany).submitMetrics(1, 8000, 8000, 8000, 8000, 8000, 8000);
    await accountability.connect(owner).fundYieldPool({ value: ethers.parseEther("200") });
    await accountability.connect(aiCompany).requestDistribution(1);
    await time.increase(7 * 24 * 60 * 60);

    await accountability.connect(owner).setMissionEnforcementEnabled(true);

    const accountabilityAddr = await accountability.getAddress();
    await mission.connect(owner).certifyModuleMissionCompliant(accountabilityAddr, [AI_PROFIT_CAPS, COMMUNITY_CHALLENGES, PRIVACY_DEFAULT]);

    await expect(accountability.connect(aiCompany).distributeBond(1)).to.not.be.reverted;
  });
});
