const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

async function deployDaoFixture() {
  const [admin, guardianA, guardianB] = await ethers.getSigners();

  const GuardianToken = await ethers.getContractFactory("VaultfireGuardianToken");
  const guardianToken = await GuardianToken.deploy(await admin.getAddress());
  await guardianToken.waitForDeployment();

  const Timelock = await ethers.getContractFactory("TimelockController");
  const minDelay = 1;
  const timelock = await Timelock.deploy(minDelay, [await admin.getAddress()], [await admin.getAddress()], await admin.getAddress());
  await timelock.waitForDeployment();

  const BaseOracle = await ethers.getContractFactory("BaseOracle");
  const baseOracle = await BaseOracle.deploy(await timelock.getAddress());
  await baseOracle.waitForDeployment();

  const Dao = await ethers.getContractFactory("VaultfireDAO");
  const dao = await Dao.deploy(await guardianToken.getAddress(), await timelock.getAddress(), await baseOracle.getAddress());
  await dao.waitForDeployment();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

  await (await timelock.grantRole(proposerRole, await dao.getAddress())).wait();
  await (await timelock.grantRole(executorRole, ethers.ZeroAddress)).wait();
  await (await timelock.revokeRole(adminRole, await admin.getAddress())).wait();
  await (await guardianToken.grantRole(await guardianToken.ATTESTOR_ROLE(), await admin.getAddress())).wait();

  return { admin, guardianA, guardianB, guardianToken, timelock, baseOracle, dao };
}

describe("VaultfireDAO", function () {
  it("executes mission evolutions when support exceeds 51%", async function () {
    const { admin, guardianA, guardianB, guardianToken, dao, baseOracle } = await deployDaoFixture();

    await (await guardianToken.connect(admin).attest(await guardianA.getAddress(), 6_000, "empathy" )).wait();
    await (await guardianToken.connect(admin).attest(await guardianB.getAddress(), 4_000, "courage" )).wait();

    await (await guardianToken.connect(guardianA).delegate(await guardianA.getAddress())).wait();
    await (await guardianToken.connect(guardianB).delegate(await guardianB.getAddress())).wait();

    const virtues = ["empathy", "courage"];
    const weights = [6_000, 4_000];
    const description = "Boost empathy weighting";

    const targets = [await baseOracle.getAddress()];
    const values = [0];
    const encodedCall = baseOracle.interface.encodeFunctionData("publishMissionEvo", [virtues, weights]);
    const descriptionHash = ethers.id(description);

    const tx = await dao.connect(guardianA).proposeMissionEvo(virtues, weights, description);
    await tx.wait();
    const proposalId = await dao.hashProposal(targets, values, [encodedCall], descriptionHash);

    const votingDelay = Number(await dao.votingDelay());
    await mine(votingDelay + 1);

    await (await dao.connect(guardianA).castVote(proposalId, 1)).wait();
    await (await dao.connect(guardianB).castVote(proposalId, 0)).wait();

    const votingPeriod = Number(await dao.votingPeriod());
    await mine(votingPeriod + 1);

    await (await dao.queue(targets, values, [encodedCall], descriptionHash)).wait();
    await time.increase(2);
    await mine(1);

    await (await dao.execute(targets, values, [encodedCall], descriptionHash)).wait();

    const state = await dao.state(proposalId);
    expect(state).to.equal(7); // Executed

    const events = await baseOracle.queryFilter(baseOracle.filters.MissionEvoBroadcast());
    expect(events).to.have.length(1);
    const mission = events[0];
    expect(mission.args.weights.map((value) => Number(value))).to.deep.equal(weights);
    expect(Number(mission.args.thresholdBps)).to.equal(5_100);
  });

  it("defeats proposals with less than 51% support", async function () {
    const { admin, guardianA, guardianB, guardianToken, dao, baseOracle } = await deployDaoFixture();

    await (await guardianToken.connect(admin).attest(await guardianA.getAddress(), 5_000, "balance" )).wait();
    await (await guardianToken.connect(admin).attest(await guardianB.getAddress(), 5_000, "balance" )).wait();

    await (await guardianToken.connect(guardianA).delegate(await guardianA.getAddress())).wait();
    await (await guardianToken.connect(guardianB).delegate(await guardianB.getAddress())).wait();

    const virtues = ["resilience"];
    const weights = [10_000];
    const description = "Balance resonance";

    const targets = [await baseOracle.getAddress()];
    const values = [0];
    const encodedCall = baseOracle.interface.encodeFunctionData("publishMissionEvo", [virtues, weights]);
    const descriptionHash = ethers.id(description);

    const tx = await dao.connect(guardianA).proposeMissionEvo(virtues, weights, description);
    await tx.wait();
    const proposalId = await dao.hashProposal(targets, values, [encodedCall], descriptionHash);

    await mine(Number(await dao.votingDelay()) + 1);

    await (await dao.connect(guardianA).castVote(proposalId, 1)).wait();
    await (await dao.connect(guardianB).castVote(proposalId, 0)).wait();

    await mine(Number(await dao.votingPeriod()) + 1);

    const state = await dao.state(proposalId);
    expect(state).to.equal(3); // Defeated

    await expect(dao.queue(targets, values, [encodedCall], descriptionHash)).to.be.revertedWithCustomError(
      dao,
      "GovernorUnexpectedProposalState"
    );
  });
});
