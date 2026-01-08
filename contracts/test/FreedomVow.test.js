const { expect } = require('chai');
const { ethers } = require('hardhat');

async function deploySuite() {
  const [deployer, guardian] = await ethers.getSigners();

  const RewardStream = await ethers.getContractFactory('RewardStream');
  const stream = await RewardStream.deploy(deployer.address, deployer.address);
  await stream.waitForDeployment();

  const DilithiumAttestor = await ethers.getContractFactory('DilithiumAttestor');
  // Deploy with zkEnabled=false for V2 launch (signature-only verification)
  const attestor = await DilithiumAttestor.deploy(
    deployer.address,  // origin
    false,             // zkEnabled (V2 launch mode)
    ethers.ZeroAddress // verifierAddress (not needed when zkEnabled=false)
  );
  await attestor.waitForDeployment();

  const BeliefOracle = await ethers.getContractFactory('BeliefOracle');
  const oracle = await BeliefOracle.deploy(
    await attestor.getAddress(),
    await stream.getAddress(),
    guardian.address,
    deployer.address
  );
  await oracle.waitForDeployment();
  await (await stream.updateGovernorTimelock(await oracle.getAddress())).wait();

  const FreedomVow = await ethers.getContractFactory('FreedomVow');
  const freedom = await FreedomVow.deploy(
    await attestor.getAddress(),
    await stream.getAddress(),
    guardian.address,
    deployer.address
  );
  await freedom.waitForDeployment();
  await (await stream.transferAdmin(await freedom.getAddress())).wait();

  return { deployer, guardian, stream, oracle, freedom, attestor };
}

function computeResonance(vow, seeker, ghostEcho) {
  const vowHash = ethers.keccak256(ethers.toUtf8Bytes(vow));
  const digest = ethers.solidityPackedKeccak256(
    ['bytes32', 'address', 'address'],
    [vowHash, seeker, ghostEcho]
  );
  return Number(BigInt(digest) % 101n);
}

async function buildProof(originSigner, vow) {
  const vowHash = ethers.keccak256(ethers.toUtf8Bytes(vow));
  const signature = await originSigner.signMessage(ethers.getBytes(vowHash));
  const proofData = ethers.randomBytes(32);
  return ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes'], [proofData, signature]);
}

async function findVow(minScore, seeker, ghostEcho) {
  let counter = 0;
  while (counter < 10_000) {
    const candidate = `Vaultfire freedom vow ${counter}`;
    const score = computeResonance(candidate, seeker, ghostEcho);
    if (score > minScore) {
      return { vow: candidate, score };
    }
    counter += 1;
  }
  throw new Error('Failed to find vow with sufficient resonance');
}

describe('BeliefOracle', () => {
  it('applies reward multiplier when resonance threshold is exceeded', async () => {
    const { deployer, guardian, oracle, stream } = await deploySuite();
    const { vow, score } = await findVow(80, guardian.address, deployer.address);
    const proof = await buildProof(deployer, vow);

    const receipt = await (await oracle.connect(guardian).queryBelief(vow, proof)).wait();
    const event = receipt.logs.find((log) => log.fragment?.name === 'ResonanceQueried');
    expect(event?.args?.multiplierApplied).to.equal(true);
    expect(event?.args?.resonance).to.equal(BigInt(score));

    const stored = await stream.getMultiplier(guardian.address);
    expect(stored).to.equal(120);
  });

  it('reverts when attestation signature is invalid', async () => {
    const { deployer, guardian, oracle } = await deploySuite();
    const vow = 'invalid-signature';
    const vowHash = ethers.keccak256(ethers.toUtf8Bytes(vow));
    const signature = await guardian.signMessage(ethers.getBytes(vowHash));
    const bogus = ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes'], [ethers.randomBytes(32), signature]);
    await expect(oracle.connect(guardian).queryBelief(vow, bogus)).to.be.revertedWith('Origin sig mismatch');
  });

  it('supports batch query calls', async () => {
    const { deployer, guardian, oracle } = await deploySuite();
    const requests = await Promise.all(
      [60, 70].map(async (threshold) => {
        const { vow } = await findVow(threshold, guardian.address, deployer.address);
        const proof = await buildProof(deployer, vow);
        return { vow, proof };
      })
    );

    const result = await oracle.connect(guardian).batchQuery.staticCall(
      requests.map((entry) => entry.vow),
      requests.map((entry) => entry.proof)
    );
    expect(result.length).to.equal(2);
    expect(Number(result[0])).to.be.at.least(0);
    expect(Number(result[1])).to.be.at.least(0);
  });
});

describe('FreedomVow', () => {
  it('mints starter yield once per guardian', async () => {
    const { deployer, guardian, freedom, stream } = await deploySuite();
    const { vow, score } = await findVow(60, guardian.address, deployer.address);
    const proof = await buildProof(deployer, vow);

    await expect(freedom.connect(guardian).igniteFreedom(vow, proof))
      .to.emit(freedom, 'FreedomIgnited')
      .withArgs(
        guardian.address,
        ethers.keccak256(ethers.toUtf8Bytes(vow)),
        BigInt(score),
        ethers.parseEther('1')
      );

    const pending = await stream.pendingRewards(guardian.address);
    expect(pending).to.equal(ethers.parseEther('1'));
    expect(await freedom.freeGuardiansCount()).to.equal(1n);
    await expect(freedom.connect(guardian).igniteFreedom(vow, proof)).to.be.revertedWithCustomError(
      freedom,
      'AlreadyVowed'
    );
  });

  it('halts ignition when resonance drift is active', async () => {
    const { deployer, guardian, freedom } = await deploySuite();
    const { vow } = await findVow(60, guardian.address, deployer.address);
    const proof = await buildProof(deployer, vow);

    await (await freedom.connect(guardian).setResonanceDrift(true)).wait();
    await expect(freedom.connect(guardian).igniteFreedom(vow, proof)).to.be.revertedWithCustomError(
      freedom,
      'ResonanceDrifted'
    );
  });
});
