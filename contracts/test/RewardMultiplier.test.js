const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('RewardMultiplier', () => {
  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();
    const RewardStream = await ethers.getContractFactory('RewardStream');
    const stream = await RewardStream.deploy(deployer.address);
    await stream.waitForDeployment();

    const RewardMultiplier = await ethers.getContractFactory('RewardMultiplier');
    const multiplier = await RewardMultiplier.deploy(await stream.getAddress(), 10_000);
    await multiplier.waitForDeployment();

    return { deployer, user, stream, multiplier };
  }

  it('streams multiplier updates to the reward stream contract', async () => {
    const { deployer, user, stream, multiplier } = await deployFixture();
    await (await stream.connect(deployer).transferAdmin(await multiplier.getAddress())).wait();

    const expected = await multiplier.calculateMultiplier.staticCall(12_000, 8_000, 250);
    const tx = await multiplier.streamMultiplier(user.address, 12_000, 8_000, 250);
    await tx.wait();
    const stored = await stream.getMultiplier(user.address);
    expect(stored).to.equal(expected);
  });

  it('falls back to the fixed multiplier when streaming fails', async () => {
    const { multiplier, user, stream } = await deployFixture();
    const fallbackBps = await multiplier.fallbackMultiplier();
    const dryRun = await multiplier.streamMultiplier.staticCall(user.address, 9_000, 9_000, 500);
    expect(dryRun).to.equal(fallbackBps);
    const receipt = await (await multiplier.streamMultiplier(user.address, 9_000, 9_000, 500)).wait();
    const event = receipt.logs.find((log) => log.fragment?.name === 'MultiplierStreamed');
    expect(event?.args?.multiplierBps).to.equal(fallbackBps);
    expect(await stream.getMultiplier(user.address)).to.equal(0);
  });
});
