const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('BeliefAttestationVerifierProduction (RISC0 journalDigest binding)', function () {
  it('returns true when mock verifier sees the expected journalDigest', async function () {
    const [prover] = await ethers.getSigners();

    const beliefMessage = 'Vaultfire protects human agency';
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes(beliefMessage));

    const epoch = 1;
    const moduleID = 2;

    const abi = ethers.AbiCoder.defaultAbiCoder();
    const expectedJournalDigest = ethers.keccak256(
      abi.encode(['bytes32', 'address', 'uint256', 'uint256'], [beliefHash, prover.address, epoch, moduleID])
    );

    const imageId = ethers.keccak256(ethers.toUtf8Bytes('belief-attestation-image-id-fixture'));

    const Mock = await ethers.getContractFactory('MockRiscZeroVerifier');
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    await (await mock.setExpected(imageId, expectedJournalDigest)).wait();

    const Verifier = await ethers.getContractFactory('BeliefAttestationVerifierProduction');
    const verifier = await Verifier.deploy(await mock.getAddress(), imageId);
    await verifier.waitForDeployment();

    const proofBytes = '0xdeadbeef';

    // uint256[] publicInputs = [beliefHash, proverAddress, epoch, moduleID]
    const publicInputs = [
      BigInt(beliefHash),
      BigInt(prover.address),
      BigInt(epoch),
      BigInt(moduleID),
    ];

    const ok = await verifier.verifyProof.staticCall(proofBytes, publicInputs);
    expect(ok).to.equal(true);
  });

  it('returns false when publicInputs do not match journalDigest expectation', async function () {
    const [prover] = await ethers.getSigners();

    const beliefMessage = 'Vaultfire protects human agency';
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes(beliefMessage));

    const epoch = 1;
    const moduleID = 2;

    const abi = ethers.AbiCoder.defaultAbiCoder();
    const expectedJournalDigest = ethers.keccak256(
      abi.encode(['bytes32', 'address', 'uint256', 'uint256'], [beliefHash, prover.address, epoch, moduleID])
    );

    const imageId = ethers.keccak256(ethers.toUtf8Bytes('belief-attestation-image-id-fixture'));

    const Mock = await ethers.getContractFactory('MockRiscZeroVerifier');
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    await (await mock.setExpected(imageId, expectedJournalDigest)).wait();

    const Verifier = await ethers.getContractFactory('BeliefAttestationVerifierProduction');
    const verifier = await Verifier.deploy(await mock.getAddress(), imageId);
    await verifier.waitForDeployment();

    const proofBytes = '0xdeadbeef';

    // Wrong moduleID => digest mismatch => mock reverts => production wrapper returns false
    const wrongModuleID = 3;
    const publicInputs = [
      BigInt(beliefHash),
      BigInt(prover.address),
      BigInt(epoch),
      BigInt(wrongModuleID),
    ];

    const ok = await verifier.verifyProof.staticCall(proofBytes, publicInputs);
    expect(ok).to.equal(false);
  });
});
