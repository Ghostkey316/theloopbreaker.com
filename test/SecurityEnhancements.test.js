const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

// =============================================================================
//  Security Enhancements Test Suite
//  =================================
//  Tests for the three critical security recommendations from the Vaultfire
//  protocol security audit:
//    1. Timelock for Image ID updates
//    2. Multi-Oracle Consensus (FlourishingMetricsOracle)
//    3. Multisig Governance
// =============================================================================

describe('Security Enhancements', function () {

  // ===========================================================================
  //  1. TIMELOCK FOR IMAGE ID UPDATES
  // ===========================================================================

  describe('ProductionBeliefAttestationVerifier — Timelock', function () {
    let verifier, mock, owner, other;
    let imageId;

    const TIMELOCK_DELAY = 48 * 60 * 60; // 48 hours in seconds

    beforeEach(async function () {
      [owner, other] = await ethers.getSigners();

      imageId = ethers.keccak256(ethers.toUtf8Bytes('belief-attestation-image-id-fixture'));

      const Mock = await ethers.getContractFactory('MockRiscZeroVerifier');
      mock = await Mock.deploy();
      await mock.waitForDeployment();

      const Verifier = await ethers.getContractFactory(
        'ProductionBeliefAttestationVerifier'
      );
      verifier = await Verifier.deploy(await mock.getAddress(), imageId);
      await verifier.waitForDeployment();
    });

    it('should deploy with correct initial state', async function () {
      expect(await verifier.imageId()).to.equal(imageId);
      expect(await verifier.owner()).to.equal(owner.address);
      expect(await verifier.pendingImageId()).to.equal(ethers.ZeroHash);
      expect(await verifier.pendingImageIdEffectiveAt()).to.equal(0);
    });

    it('should allow owner to propose an image ID change', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));

      const tx = await verifier.proposeImageIdChange(newImageId);
      const receipt = await tx.wait();

      expect(await verifier.pendingImageId()).to.equal(newImageId);

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(await verifier.pendingImageIdEffectiveAt()).to.equal(
        block.timestamp + TIMELOCK_DELAY
      );
    });

    it('should emit ImageIdChangeProposed event', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));

      await expect(verifier.proposeImageIdChange(newImageId))
        .to.emit(verifier, 'ImageIdChangeProposed')
        .withArgs(imageId, newImageId, (v) => v > 0);
    });

    it('should reject proposal of zero image ID', async function () {
      await expect(verifier.proposeImageIdChange(ethers.ZeroHash))
        .to.be.revertedWithCustomError(verifier, 'ZeroImageId');
    });

    it('should reject proposal when one is already pending', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);

      const anotherImageId = ethers.keccak256(ethers.toUtf8Bytes('another-image-id'));
      await expect(verifier.proposeImageIdChange(anotherImageId))
        .to.be.revertedWithCustomError(verifier, 'ImageIdAlreadyPending');
    });

    it('should reject execution before timelock expires', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);

      await expect(verifier.executeImageIdChange())
        .to.be.revertedWithCustomError(verifier, 'TimelockNotExpired');
    });

    it('should allow execution after timelock expires', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);

      // Advance time by 48 hours
      await time.increase(TIMELOCK_DELAY);

      await expect(verifier.executeImageIdChange())
        .to.emit(verifier, 'ImageIdUpdated')
        .withArgs(imageId, newImageId);

      expect(await verifier.imageId()).to.equal(newImageId);
      expect(await verifier.pendingImageId()).to.equal(ethers.ZeroHash);
      expect(await verifier.pendingImageIdEffectiveAt()).to.equal(0);
    });

    it('should allow owner to cancel a pending change', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);

      await expect(verifier.cancelImageIdChange())
        .to.emit(verifier, 'ImageIdChangeCancelled')
        .withArgs(newImageId);

      expect(await verifier.pendingImageId()).to.equal(ethers.ZeroHash);
      expect(await verifier.imageId()).to.equal(imageId); // unchanged
    });

    it('should reject cancel when no pending change', async function () {
      await expect(verifier.cancelImageIdChange())
        .to.be.revertedWithCustomError(verifier, 'NoPendingImageId');
    });

    it('should reject execution when no pending change', async function () {
      await expect(verifier.executeImageIdChange())
        .to.be.revertedWithCustomError(verifier, 'NoPendingImageId');
    });

    it('should reject non-owner from proposing', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await expect(verifier.connect(other).proposeImageIdChange(newImageId))
        .to.be.revertedWithCustomError(verifier, 'OnlyOwner');
    });

    it('should reject non-owner from executing', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);
      await time.increase(TIMELOCK_DELAY);

      await expect(verifier.connect(other).executeImageIdChange())
        .to.be.revertedWithCustomError(verifier, 'OnlyOwner');
    });

    it('should report pending change status correctly', async function () {
      // No pending change
      let [pendingId, effectiveAt, isReady] = await verifier.getPendingImageIdChange();
      expect(pendingId).to.equal(ethers.ZeroHash);
      expect(isReady).to.equal(false);

      // Propose change
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);

      [pendingId, effectiveAt, isReady] = await verifier.getPendingImageIdChange();
      expect(pendingId).to.equal(newImageId);
      expect(isReady).to.equal(false);

      // After timelock
      await time.increase(TIMELOCK_DELAY);
      [pendingId, effectiveAt, isReady] = await verifier.getPendingImageIdChange();
      expect(pendingId).to.equal(newImageId);
      expect(isReady).to.equal(true);
    });

    it('should allow new proposal after cancellation', async function () {
      const newImageId = ethers.keccak256(ethers.toUtf8Bytes('new-image-id'));
      await verifier.proposeImageIdChange(newImageId);
      await verifier.cancelImageIdChange();

      const anotherImageId = ethers.keccak256(ethers.toUtf8Bytes('another-image-id'));
      await verifier.proposeImageIdChange(anotherImageId);
      expect(await verifier.pendingImageId()).to.equal(anotherImageId);
    });

    it('should preserve existing proof verification functionality', async function () {
      const [prover] = await ethers.getSigners();
      const beliefMessage = 'Vaultfire protects human agency';
      const beliefHash = ethers.keccak256(ethers.toUtf8Bytes(beliefMessage));
      const epoch = 1;
      const moduleID = 2;

      const abi = ethers.AbiCoder.defaultAbiCoder();
      const journal = abi.encode(
        ['bytes32', 'address', 'uint32', 'uint32'],
        [beliefHash, prover.address, epoch, moduleID]
      );
      const expectedJournalDigest = ethers.sha256(journal);

      await mock.setExpected(imageId, expectedJournalDigest);

      const proofBytes = '0xdeadbeef';
      const publicInputs = [
        BigInt(beliefHash),
        BigInt(prover.address),
        BigInt(epoch),
        BigInt(moduleID),
      ];

      const ok = await verifier.verifyProof.staticCall(proofBytes, publicInputs);
      expect(ok).to.equal(true);
    });
  });

  // ===========================================================================
  //  2. MULTI-ORACLE CONSENSUS (FlourishingMetricsOracle)
  // ===========================================================================

  describe('FlourishingMetricsOracle — Multi-Oracle Consensus', function () {
    let oracle, owner, oracle1, oracle2, oracle3, oracle4, nonOracle;
    const metricId = ethers.keccak256(ethers.toUtf8Bytes('flourishing-score'));

    beforeEach(async function () {
      [owner, oracle1, oracle2, oracle3, oracle4, nonOracle] = await ethers.getSigners();

      const Oracle = await ethers.getContractFactory('FlourishingMetricsOracle');
      oracle = await Oracle.deploy();
      await oracle.waitForDeployment();

      // Register 3 oracles (minimum quorum)
      await oracle.addOracle(oracle1.address);
      await oracle.addOracle(oracle2.address);
      await oracle.addOracle(oracle3.address);
    });

    it('should deploy with correct initial state', async function () {
      expect(await oracle.owner()).to.equal(owner.address);
      expect(await oracle.oracleCount()).to.equal(3);
      expect(await oracle.nextRoundId()).to.equal(1);
    });

    it('should register oracles correctly', async function () {
      expect(await oracle.isOracle(oracle1.address)).to.equal(true);
      expect(await oracle.isOracle(oracle2.address)).to.equal(true);
      expect(await oracle.isOracle(oracle3.address)).to.equal(true);
      expect(await oracle.isOracle(nonOracle.address)).to.equal(false);

      const oracles = await oracle.getOracles();
      expect(oracles.length).to.equal(3);
    });

    it('should reject duplicate oracle registration', async function () {
      await expect(oracle.addOracle(oracle1.address))
        .to.be.revertedWithCustomError(oracle, 'OracleAlreadyRegistered');
    });

    it('should allow owner to remove an oracle', async function () {
      await oracle.addOracle(oracle4.address);
      expect(await oracle.oracleCount()).to.equal(4);

      await oracle.removeOracle(oracle4.address);
      expect(await oracle.oracleCount()).to.equal(3);
      expect(await oracle.isOracle(oracle4.address)).to.equal(false);
    });

    it('should reject non-owner from adding oracles', async function () {
      await expect(oracle.connect(nonOracle).addOracle(nonOracle.address))
        .to.be.revertedWithCustomError(oracle, 'OnlyOwner');
    });

    it('should start a consensus round', async function () {
      const tx = await oracle.startRound(metricId);
      await tx.wait();

      const round = await oracle.getRound(1);
      expect(round.metricId).to.equal(metricId);
      expect(round.finalized).to.equal(false);
    });

    it('should reject round start with insufficient oracles', async function () {
      await oracle.removeOracle(oracle3.address);
      await oracle.removeOracle(oracle2.address);

      await expect(oracle.startRound(metricId))
        .to.be.revertedWithCustomError(oracle, 'InsufficientOracles');
    });

    it('should allow oracles to submit metrics', async function () {
      await oracle.startRound(metricId);

      await expect(oracle.connect(oracle1).submitMetric(1, 8500))
        .to.emit(oracle, 'MetricSubmitted')
        .withArgs(1, oracle1.address, 8500);

      await oracle.connect(oracle2).submitMetric(1, 8600);
      await oracle.connect(oracle3).submitMetric(1, 8400);

      const round = await oracle.getRound(1);
      expect(round.submissionCount).to.equal(3);
    });

    it('should reject duplicate submissions from same oracle', async function () {
      await oracle.startRound(metricId);
      await oracle.connect(oracle1).submitMetric(1, 8500);

      await expect(oracle.connect(oracle1).submitMetric(1, 8600))
        .to.be.revertedWithCustomError(oracle, 'AlreadySubmitted');
    });

    it('should reject submissions from non-oracles', async function () {
      await oracle.startRound(metricId);

      await expect(oracle.connect(nonOracle).submitMetric(1, 8500))
        .to.be.revertedWithCustomError(oracle, 'OnlyOracle');
    });

    it('should compute median consensus with odd number of submissions', async function () {
      await oracle.startRound(metricId);

      await oracle.connect(oracle1).submitMetric(1, 8000);
      await oracle.connect(oracle2).submitMetric(1, 9000);
      await oracle.connect(oracle3).submitMetric(1, 8500);

      // Advance past deadline
      await time.increase(24 * 60 * 60 + 1);

      await oracle.finalizeRound(1);

      const round = await oracle.getRound(1);
      expect(round.finalized).to.equal(true);
      // Sorted: [8000, 8500, 9000] → median = 8500
      expect(round.consensusValue).to.equal(8500);
    });

    it('should compute median consensus with even number of submissions', async function () {
      await oracle.addOracle(oracle4.address);
      await oracle.startRound(metricId);

      await oracle.connect(oracle1).submitMetric(1, 8000);
      await oracle.connect(oracle2).submitMetric(1, 9000);
      await oracle.connect(oracle3).submitMetric(1, 8500);
      await oracle.connect(oracle4).submitMetric(1, 8700);

      await time.increase(24 * 60 * 60 + 1);

      await oracle.finalizeRound(1);

      const round = await oracle.getRound(1);
      // Sorted: [8000, 8500, 8700, 9000] → median = (8500 + 8700) / 2 = 8600
      expect(round.consensusValue).to.equal(8600);
    });

    it('should resist outlier manipulation', async function () {
      await oracle.startRound(metricId);

      // One oracle submits an extreme outlier
      await oracle.connect(oracle1).submitMetric(1, 8500);
      await oracle.connect(oracle2).submitMetric(1, 8600);
      await oracle.connect(oracle3).submitMetric(1, 99999); // outlier

      await time.increase(24 * 60 * 60 + 1);
      await oracle.finalizeRound(1);

      const round = await oracle.getRound(1);
      // Sorted: [8500, 8600, 99999] → median = 8600 (outlier ignored)
      expect(round.consensusValue).to.equal(8600);
    });

    it('should update latest value after consensus', async function () {
      await oracle.startRound(metricId);

      await oracle.connect(oracle1).submitMetric(1, 8500);
      await oracle.connect(oracle2).submitMetric(1, 8600);
      await oracle.connect(oracle3).submitMetric(1, 8400);

      await time.increase(24 * 60 * 60 + 1);
      await oracle.finalizeRound(1);

      const [value, roundId] = await oracle.getLatestValue(metricId);
      expect(value).to.equal(8500);
      expect(roundId).to.equal(1);
    });

    it('should expire round with insufficient submissions', async function () {
      await oracle.startRound(metricId);

      // Only 2 submissions (below quorum of 3)
      await oracle.connect(oracle1).submitMetric(1, 8500);
      await oracle.connect(oracle2).submitMetric(1, 8600);

      await time.increase(24 * 60 * 60 + 1);

      await expect(oracle.finalizeRound(1))
        .to.emit(oracle, 'RoundExpired')
        .withArgs(1);
    });

    it('should reject finalization before deadline', async function () {
      await oracle.startRound(metricId);

      await expect(oracle.finalizeRound(1))
        .to.be.revertedWithCustomError(oracle, 'RoundStillOpen');
    });

    it('should reject submissions after deadline', async function () {
      await oracle.startRound(metricId);

      await time.increase(24 * 60 * 60 + 1);

      await expect(oracle.connect(oracle1).submitMetric(1, 8500))
        .to.be.revertedWithCustomError(oracle, 'RoundNotOpen');
    });
  });

  // ===========================================================================
  //  3. MULTISIG GOVERNANCE
  // ===========================================================================

  describe('MultisigGovernance — Multi-Signature Approval', function () {
    let multisig, target, signer1, signer2, signer3, nonSigner;

    beforeEach(async function () {
      [signer1, signer2, signer3, nonSigner] = await ethers.getSigners();

      const Multisig = await ethers.getContractFactory('MultisigGovernance');
      multisig = await Multisig.deploy(
        [signer1.address, signer2.address, signer3.address],
        2 // 2-of-3 threshold
      );
      await multisig.waitForDeployment();

      // Deploy a simple target contract (use FlourishingMetricsOracle as target)
      const Target = await ethers.getContractFactory('FlourishingMetricsOracle');
      target = await Target.deploy();
      await target.waitForDeployment();

      // Transfer target ownership to multisig
      await target.transferOwnership(await multisig.getAddress());
    });

    it('should deploy with correct initial state', async function () {
      expect(await multisig.threshold()).to.equal(2);
      const signers = await multisig.getSigners();
      expect(signers.length).to.equal(3);
      expect(await multisig.isSigner(signer1.address)).to.equal(true);
      expect(await multisig.isSigner(signer2.address)).to.equal(true);
      expect(await multisig.isSigner(signer3.address)).to.equal(true);
      expect(await multisig.isSigner(nonSigner.address)).to.equal(false);
    });

    it('should reject deployment with invalid threshold', async function () {
      const Multisig = await ethers.getContractFactory('MultisigGovernance');

      await expect(Multisig.deploy([signer1.address], 0))
        .to.be.revertedWithCustomError(multisig, 'InvalidThreshold');

      await expect(Multisig.deploy([signer1.address], 2))
        .to.be.revertedWithCustomError(multisig, 'InvalidThreshold');
    });

    it('should reject deployment with duplicate signers', async function () {
      const Multisig = await ethers.getContractFactory('MultisigGovernance');

      await expect(Multisig.deploy([signer1.address, signer1.address], 1))
        .to.be.revertedWithCustomError(multisig, 'DuplicateSigner');
    });

    it('should allow signer to propose a transaction', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await expect(multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      )).to.emit(multisig, 'TransactionProposed');

      expect(await multisig.transactionCount()).to.equal(1);
    });

    it('should auto-confirm for proposer', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      const [, , , , numConfirmations] = await multisig.getTransaction(0);
      expect(numConfirmations).to.equal(1);
      expect(await multisig.confirmations(0, signer1.address)).to.equal(true);
    });

    it('should reject proposal from non-signer', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await expect(multisig.connect(nonSigner).proposeTransaction(
        await target.getAddress(), 0, calldata
      )).to.be.revertedWithCustomError(multisig, 'NotSigner');
    });

    it('should allow second signer to confirm', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      await expect(multisig.connect(signer2).confirmTransaction(0))
        .to.emit(multisig, 'TransactionConfirmed')
        .withArgs(0, signer2.address);

      const [, , , , numConfirmations] = await multisig.getTransaction(0);
      expect(numConfirmations).to.equal(2);
    });

    it('should reject duplicate confirmation', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      await expect(multisig.connect(signer1).confirmTransaction(0))
        .to.be.revertedWithCustomError(multisig, 'AlreadyConfirmed');
    });

    it('should execute transaction when threshold is met (2-of-3)', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      await multisig.connect(signer2).confirmTransaction(0);

      await expect(multisig.connect(signer1).executeTransaction(0))
        .to.emit(multisig, 'TransactionExecuted')
        .withArgs(0, signer1.address);

      // Verify the oracle was actually added
      expect(await target.isOracle(signer1.address)).to.equal(true);
    });

    it('should reject execution below threshold', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      // Only 1 confirmation (threshold is 2)
      await expect(multisig.connect(signer1).executeTransaction(0))
        .to.be.revertedWithCustomError(multisig, 'ThresholdNotMet');
    });

    it('should reject execution of already executed transaction', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );
      await multisig.connect(signer2).confirmTransaction(0);
      await multisig.connect(signer1).executeTransaction(0);

      await expect(multisig.connect(signer1).executeTransaction(0))
        .to.be.revertedWithCustomError(multisig, 'TransactionAlreadyExecuted');
    });

    it('should allow revoking confirmation', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      await expect(multisig.connect(signer1).revokeConfirmation(0))
        .to.emit(multisig, 'ConfirmationRevoked')
        .withArgs(0, signer1.address);

      const [, , , , numConfirmations] = await multisig.getTransaction(0);
      expect(numConfirmations).to.equal(0);
    });

    it('should reject revocation when not confirmed', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      await expect(multisig.connect(signer2).revokeConfirmation(0))
        .to.be.revertedWithCustomError(multisig, 'NotConfirmed');
    });

    it('should reject expired transactions', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );
      await multisig.connect(signer2).confirmTransaction(0);

      // Advance past expiry (7 days)
      await time.increase(7 * 24 * 60 * 60 + 1);

      await expect(multisig.connect(signer1).executeTransaction(0))
        .to.be.revertedWithCustomError(multisig, 'TransactionExpired');
    });

    it('should report transaction readiness correctly', async function () {
      const calldata = target.interface.encodeFunctionData('addOracle', [signer1.address]);

      await multisig.connect(signer1).proposeTransaction(
        await target.getAddress(), 0, calldata
      );

      // 1 confirmation — not ready
      expect(await multisig.isTransactionReady(0)).to.equal(false);

      // 2 confirmations — ready
      await multisig.connect(signer2).confirmTransaction(0);
      expect(await multisig.isTransactionReady(0)).to.equal(true);

      // After expiry — not ready
      await time.increase(7 * 24 * 60 * 60 + 1);
      expect(await multisig.isTransactionReady(0)).to.equal(false);
    });

    it('should manage signers via multisig (add signer)', async function () {
      // Propose adding a new signer via multisig
      const calldata = multisig.interface.encodeFunctionData('addSigner', [nonSigner.address]);

      await multisig.connect(signer1).proposeTransaction(
        await multisig.getAddress(), 0, calldata
      );
      await multisig.connect(signer2).confirmTransaction(0);
      await multisig.connect(signer1).executeTransaction(0);

      expect(await multisig.isSigner(nonSigner.address)).to.equal(true);
      expect(await multisig.getSignerCount()).to.equal(4);
    });

    it('should manage signers via multisig (remove signer)', async function () {
      const calldata = multisig.interface.encodeFunctionData('removeSigner', [signer3.address]);

      await multisig.connect(signer1).proposeTransaction(
        await multisig.getAddress(), 0, calldata
      );
      await multisig.connect(signer2).confirmTransaction(0);
      await multisig.connect(signer1).executeTransaction(0);

      expect(await multisig.isSigner(signer3.address)).to.equal(false);
      expect(await multisig.getSignerCount()).to.equal(2);
    });

    it('should change threshold via multisig', async function () {
      // First add a 4th signer
      let calldata = multisig.interface.encodeFunctionData('addSigner', [nonSigner.address]);
      await multisig.connect(signer1).proposeTransaction(await multisig.getAddress(), 0, calldata);
      await multisig.connect(signer2).confirmTransaction(0);
      await multisig.connect(signer1).executeTransaction(0);

      // Now change threshold to 3-of-4
      calldata = multisig.interface.encodeFunctionData('changeThreshold', [3]);
      await multisig.connect(signer1).proposeTransaction(await multisig.getAddress(), 0, calldata);
      await multisig.connect(signer2).confirmTransaction(1);
      await multisig.connect(signer1).executeTransaction(1);

      expect(await multisig.threshold()).to.equal(3);
    });

    it('should reject direct signer management (not via multisig)', async function () {
      await expect(multisig.connect(signer1).addSigner(nonSigner.address))
        .to.be.revertedWith('Only via multisig');
    });

    it('should handle 3-of-5 configuration', async function () {
      const [s1, s2, s3, s4, s5, outsider] = await ethers.getSigners();

      const Multisig = await ethers.getContractFactory('MultisigGovernance');
      const ms = await Multisig.deploy(
        [s1.address, s2.address, s3.address, s4.address, s5.address],
        3 // 3-of-5
      );
      await ms.waitForDeployment();

      const Target = await ethers.getContractFactory('FlourishingMetricsOracle');
      const t = await Target.deploy();
      await t.waitForDeployment();
      await t.transferOwnership(await ms.getAddress());

      const calldata = t.interface.encodeFunctionData('addOracle', [s1.address]);

      await ms.connect(s1).proposeTransaction(await t.getAddress(), 0, calldata);

      // 1 confirmation (auto) — not enough
      await expect(ms.connect(s1).executeTransaction(0))
        .to.be.revertedWithCustomError(ms, 'ThresholdNotMet');

      // 2 confirmations — not enough
      await ms.connect(s2).confirmTransaction(0);
      await expect(ms.connect(s1).executeTransaction(0))
        .to.be.revertedWithCustomError(ms, 'ThresholdNotMet');

      // 3 confirmations — execute
      await ms.connect(s3).confirmTransaction(0);
      await ms.connect(s1).executeTransaction(0);

      expect(await t.isOracle(s1.address)).to.equal(true);
    });
  });
});
