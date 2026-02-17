const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Audit Remediation Tests
 *
 * Tests for every fix introduced by the 2026 security audit remediation:
 *   C-01  BeliefAttestationVerifier defense-in-depth
 *   H-01  VaultfireERC8004Adapter discoverVaultfireAgents hash fix
 *   M-01  BeliefOracle queryBelief `applied` initialization
 *   M-02  ERC8004ValidationRegistry paginated queries
 *   M-03  ProductionBeliefAttestationVerifier timelock (pre-existing — verified)
 *   M-04  AIPartnershipBondsV2 paginated getBondsByParticipant
 *   LOW   Zero-address checks, immutable state, events, unused returns
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

async function deployBeliefStack() {
  const [deployer, guardian, prover] = await ethers.getSigners();

  const RewardStream = await ethers.getContractFactory("RewardStream");
  const stream = await RewardStream.deploy(deployer.address, deployer.address);
  await stream.waitForDeployment();

  const DilithiumAttestor = await ethers.getContractFactory("DilithiumAttestor");
  const attestor = await DilithiumAttestor.deploy(
    deployer.address,
    false,
    ethers.ZeroAddress
  );
  await attestor.waitForDeployment();

  const BeliefOracle = await ethers.getContractFactory("BeliefOracle");
  const oracle = await BeliefOracle.deploy(
    await attestor.getAddress(),
    await stream.getAddress(),
    guardian.address,
    deployer.address
  );
  await oracle.waitForDeployment();

  // Transfer governor role to oracle
  await (await stream.transferGovernor(await oracle.getAddress())).wait();
  await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine");

  const oracleAddress = await oracle.getAddress();
  await ethers.provider.send("hardhat_impersonateAccount", [oracleAddress]);
  await ethers.provider.send("hardhat_setBalance", [oracleAddress, "0x56BC75E2D63100000"]);
  const oracleSigner = await ethers.getSigner(oracleAddress);
  await stream.connect(oracleSigner).acceptGovernor();
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [oracleAddress]);

  return { deployer, guardian, prover, stream, attestor, oracle };
}

function computeResonance(vow, seeker, ghostEcho) {
  const vowHash = ethers.keccak256(ethers.toUtf8Bytes(vow));
  const digest = ethers.solidityPackedKeccak256(
    ["bytes32", "address", "address"],
    [vowHash, seeker, ghostEcho]
  );
  return Number(BigInt(digest) % 101n);
}

async function buildProof(originSigner, vow) {
  const vowHash = ethers.keccak256(ethers.toUtf8Bytes(vow));
  const signature = await originSigner.signMessage(ethers.getBytes(vowHash));
  const proofData = ethers.randomBytes(32);
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes"],
    [proofData, signature]
  );
}

async function findVow(minScore, seeker, ghostEcho) {
  let counter = 0;
  while (counter < 20_000) {
    const candidate = `audit-test-vow-${counter}`;
    const score = computeResonance(candidate, seeker, ghostEcho);
    if (score > minScore) {
      return { vow: candidate, score };
    }
    counter++;
  }
  throw new Error("Failed to find vow with sufficient resonance");
}

async function findLowVow(maxScore, seeker, ghostEcho) {
  let counter = 0;
  while (counter < 20_000) {
    const candidate = `audit-low-vow-${counter}`;
    const score = computeResonance(candidate, seeker, ghostEcho);
    if (score <= maxScore) {
      return { vow: candidate, score };
    }
    counter++;
  }
  throw new Error("Failed to find vow with low resonance");
}

async function deployERC8004Stack() {
  const [owner, human1, aiAgent1, human2, aiAgent2, validator1, validator2, validator3] =
    await ethers.getSigners();

  const ZKVerifier = await ethers.getContractFactory("BeliefAttestationVerifier");
  const zkVerifier = await ZKVerifier.deploy();

  const IdentityRegistry = await ethers.getContractFactory("ERC8004IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();

  const ReputationRegistry = await ethers.getContractFactory("ERC8004ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(
    await identityRegistry.getAddress()
  );

  const ValidationRegistry = await ethers.getContractFactory("ERC8004ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy(
    await identityRegistry.getAddress(),
    await zkVerifier.getAddress()
  );

  const AIPartnership = await ethers.getContractFactory("AIPartnershipBondsV2");
  const partnershipBonds = await AIPartnership.deploy();

  const Adapter = await ethers.getContractFactory("VaultfireERC8004Adapter");
  const adapter = await Adapter.deploy(
    await partnershipBonds.getAddress(),
    await identityRegistry.getAddress(),
    await reputationRegistry.getAddress(),
    await validationRegistry.getAddress()
  );

  return {
    owner, human1, aiAgent1, human2, aiAgent2,
    validator1, validator2, validator3,
    zkVerifier, identityRegistry, reputationRegistry,
    validationRegistry, partnershipBonds, adapter,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  C-01: BeliefAttestationVerifier defense-in-depth
// ═══════════════════════════════════════════════════════════════════════════

describe("C-01: BeliefAttestationVerifier defense-in-depth", function () {
  let verifier, prover;

  beforeEach(async function () {
    [, prover] = await ethers.getSigners();
    const BeliefVerifier = await ethers.getContractFactory("BeliefAttestationVerifier");
    verifier = await BeliefVerifier.deploy();
    await verifier.waitForDeployment();
  });

  it("should emit DevVerifierUsed event on successful verification", async function () {
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("test belief"));
    const publicInputs = [
      beliefHash,
      BigInt(prover.address),
      0n,
      0n,
    ];
    const mockProof = ethers.randomBytes(128);

    const tx = await verifier.verifyProof(mockProof, publicInputs);
    const receipt = await tx.wait();

    // Find DevVerifierUsed event
    const devEvent = receipt.logs.find((log) => {
      try {
        return verifier.interface.parseLog(log)?.name === "DevVerifierUsed";
      } catch {
        return false;
      }
    });

    expect(devEvent).to.not.be.undefined;
    const parsed = verifier.interface.parseLog(devEvent);
    expect(parsed.args.beliefHash).to.equal(beliefHash);
    expect(parsed.args.chainId).to.equal(31337n);
  });

  it("should still emit ProofVerified event alongside DevVerifierUsed", async function () {
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("another belief"));
    const publicInputs = [
      beliefHash,
      BigInt(prover.address),
      0n,
      0n,
    ];
    const mockProof = ethers.randomBytes(64);

    const tx = await verifier.verifyProof(mockProof, publicInputs);
    const receipt = await tx.wait();

    const eventNames = receipt.logs.map((log) => {
      try {
        return verifier.interface.parseLog(log)?.name;
      } catch {
        return null;
      }
    });

    expect(eventNames).to.include("DevVerifierUsed");
    expect(eventNames).to.include("ProofVerified");
  });

  it("should reject empty proof", async function () {
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("belief"));
    const publicInputs = [beliefHash, BigInt(prover.address), 0n, 0n];

    await expect(
      verifier.verifyProof("0x", publicInputs)
    ).to.be.revertedWith("Empty proof");
  });

  it("should reject proof shorter than 32 bytes", async function () {
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("belief"));
    const publicInputs = [beliefHash, BigInt(prover.address), 0n, 0n];

    await expect(
      verifier.verifyProof(ethers.randomBytes(16), publicInputs)
    ).to.be.revertedWith("Proof too short");
  });

  it("should reject zero belief hash", async function () {
    const publicInputs = [ethers.ZeroHash, BigInt(prover.address), 0n, 0n];
    await expect(
      verifier.verifyProof(ethers.randomBytes(64), publicInputs)
    ).to.be.revertedWith("Invalid belief hash");
  });

  it("should reject zero prover address", async function () {
    const beliefHash = ethers.keccak256(ethers.toUtf8Bytes("belief"));
    const publicInputs = [beliefHash, 0n, 0n, 0n];
    await expect(
      verifier.verifyProof(ethers.randomBytes(64), publicInputs)
    ).to.be.revertedWith("Invalid prover address");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  H-01: VaultfireERC8004Adapter discoverVaultfireAgents hash fix
// ═══════════════════════════════════════════════════════════════════════════

describe("H-01: VaultfireERC8004Adapter discoverVaultfireAgents hash fix", function () {
  let identityRegistry, adapter, aiAgent1, aiAgent2;

  beforeEach(async function () {
    const stack = await deployERC8004Stack();
    identityRegistry = stack.identityRegistry;
    adapter = stack.adapter;
    aiAgent1 = stack.aiAgent1;
    aiAgent2 = stack.aiAgent2;
  });

  it("should discover agents using type-specific capability hash", async function () {
    const agentType = "AI Research Assistant";
    // Register with the CORRECT hash: keccak256("vaultfire-ai-partnership" + agentType)
    const correctHash = ethers.solidityPackedKeccak256(
      ["string", "string"],
      ["vaultfire-ai-partnership", agentType]
    );

    await identityRegistry.connect(aiAgent1).registerAgent(
      "https://agent1.example.com/card.json",
      agentType,
      correctHash
    );
    await adapter.connect(aiAgent1).registerAgentForPartnership(
      "https://agent1.example.com/card.json",
      agentType
    );

    // The new overload with agentType should find the agent
    const agents = await adapter["discoverVaultfireAgents(string)"](agentType);
    expect(agents.length).to.equal(1);
    expect(agents[0]).to.equal(aiAgent1.address);
  });

  it("should return empty array for mismatched agent type", async function () {
    const agentType = "AI Research Assistant";
    const correctHash = ethers.solidityPackedKeccak256(
      ["string", "string"],
      ["vaultfire-ai-partnership", agentType]
    );

    await identityRegistry.connect(aiAgent1).registerAgent(
      "https://agent1.example.com/card.json",
      agentType,
      correctHash
    );
    await adapter.connect(aiAgent1).registerAgentForPartnership(
      "https://agent1.example.com/card.json",
      agentType
    );

    // Searching with a different type should return empty
    const agents = await adapter["discoverVaultfireAgents(string)"]("AI Coding Assistant");
    expect(agents.length).to.equal(0);
  });

  it("should still support the no-arg overload for backward compatibility", async function () {
    // Register with the base hash (no agentType suffix)
    const baseHash = ethers.solidityPackedKeccak256(
      ["string"],
      ["vaultfire-ai-partnership"]
    );

    await identityRegistry.connect(aiAgent1).registerAgent(
      "https://agent1.example.com/card.json",
      "AI Partner",
      baseHash
    );
    await adapter.connect(aiAgent1).registerAgentForPartnership(
      "https://agent1.example.com/card.json",
      "AI Partner"
    );

    const agents = await adapter["discoverVaultfireAgents()"]();
    expect(agents.length).to.equal(1);
    expect(agents[0]).to.equal(aiAgent1.address);
  });

  it("should discover multiple agents of the same type", async function () {
    const agentType = "AI Writing Partner";
    const correctHash = ethers.solidityPackedKeccak256(
      ["string", "string"],
      ["vaultfire-ai-partnership", agentType]
    );

    await identityRegistry.connect(aiAgent1).registerAgent(
      "https://agent1.example.com/card.json",
      agentType,
      correctHash
    );
    await adapter.connect(aiAgent1).registerAgentForPartnership(
      "https://agent1.example.com/card.json",
      agentType
    );

    await identityRegistry.connect(aiAgent2).registerAgent(
      "https://agent2.example.com/card.json",
      agentType,
      correctHash
    );
    await adapter.connect(aiAgent2).registerAgentForPartnership(
      "https://agent2.example.com/card.json",
      agentType
    );

    const agents = await adapter["discoverVaultfireAgents(string)"](agentType);
    expect(agents.length).to.equal(2);
    expect(agents).to.include(aiAgent1.address);
    expect(agents).to.include(aiAgent2.address);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  M-01: BeliefOracle queryBelief `applied` variable initialization
// ═══════════════════════════════════════════════════════════════════════════

describe("M-01: BeliefOracle queryBelief applied initialization", function () {
  it("should emit multiplierApplied=true when resonance > 80 and bonus not yet applied", async function () {
    const { deployer, guardian, oracle } = await deployBeliefStack();
    const { vow, score } = await findVow(80, guardian.address, deployer.address);
    const proof = await buildProof(deployer, vow);

    const receipt = await (await oracle.connect(guardian).queryBelief(vow, proof)).wait();
    const event = receipt.logs.find((log) => log.fragment?.name === "ResonanceQueried");

    expect(event).to.not.be.undefined;
    expect(event.args.multiplierApplied).to.equal(true);
    expect(event.args.resonance).to.equal(BigInt(score));
  });

  it("should emit multiplierApplied=false when resonance <= 80", async function () {
    const { deployer, guardian, oracle } = await deployBeliefStack();
    const { vow, score } = await findLowVow(80, guardian.address, deployer.address);
    const proof = await buildProof(deployer, vow);

    const receipt = await (await oracle.connect(guardian).queryBelief(vow, proof)).wait();
    const event = receipt.logs.find((log) => log.fragment?.name === "ResonanceQueried");

    expect(event).to.not.be.undefined;
    expect(event.args.multiplierApplied).to.equal(false);
    expect(Number(event.args.resonance)).to.be.lte(80);
  });

  it("should emit multiplierApplied=false when bonus already applied for same vow", async function () {
    const { deployer, guardian, oracle } = await deployBeliefStack();
    const { vow } = await findVow(80, guardian.address, deployer.address);
    const proof1 = await buildProof(deployer, vow);

    // First call — should apply
    await oracle.connect(guardian).queryBelief(vow, proof1);

    // Second call with same vow — bonus already applied
    const proof2 = await buildProof(deployer, vow);
    const receipt = await (await oracle.connect(guardian).queryBelief(vow, proof2)).wait();
    const event = receipt.logs.find((log) => log.fragment?.name === "ResonanceQueried");

    expect(event).to.not.be.undefined;
    // bonusApplied[vowHash] is already true, so multiplierApplied should be false
    expect(event.args.multiplierApplied).to.equal(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  M-02: ERC8004ValidationRegistry paginated queries
// ═══════════════════════════════════════════════════════════════════════════

describe("M-02: ERC8004ValidationRegistry paginated queries", function () {
  let validationRegistry, identityRegistry, aiAgent1, human1;
  let validator1, validator2, validator3;

  beforeEach(async function () {
    const stack = await deployERC8004Stack();
    validationRegistry = stack.validationRegistry;
    identityRegistry = stack.identityRegistry;
    aiAgent1 = stack.aiAgent1;
    human1 = stack.human1;
    validator1 = stack.validator1;
    validator2 = stack.validator2;
    validator3 = stack.validator3;

    // Register agent
    await identityRegistry.connect(aiAgent1).registerAgent(
      "https://agent.example.com/card.json",
      "AI Assistant",
      ethers.keccak256(ethers.toUtf8Bytes("research"))
    );

    // Stake validators
    await validationRegistry.connect(validator1).stakeAsValidator({
      value: ethers.parseEther("2.0"),
    });
  });

  it("should return correct count of validation responses", async function () {
    // Create a validation request
    await validationRegistry.connect(human1).requestValidation(
      aiAgent1.address,
      "https://claims.example.com/claim1.json",
      ethers.keccak256(ethers.toUtf8Bytes("claim1")),
      0, // STAKER_RERUN
      1,
      { value: ethers.parseEther("1.0") }
    );

    // Submit a response
    await validationRegistry.connect(validator1).submitValidation(
      1,
      true,
      "https://evidence.example.com/proof.json",
      "0x",
      { value: ethers.parseEther("0.1") }
    );

    const count = await validationRegistry.getValidationResponsesCount(1);
    expect(count).to.equal(1);
  });

  it("should return paginated validation responses", async function () {
    // Create a multi-validator request
    await validationRegistry.connect(validator2).stakeAsValidator({
      value: ethers.parseEther("2.0"),
    });
    await validationRegistry.connect(validator3).stakeAsValidator({
      value: ethers.parseEther("2.0"),
    });

    await validationRegistry.connect(human1).requestValidation(
      aiAgent1.address,
      "https://claims.example.com/claim.json",
      ethers.keccak256(ethers.toUtf8Bytes("claim")),
      4, // MULTI_VALIDATOR
      3,
      { value: ethers.parseEther("1.0") }
    );

    // Submit 3 responses
    await validationRegistry.connect(validator1).submitValidation(
      1, true, "evidence1", "0x", { value: ethers.parseEther("0.1") }
    );
    await validationRegistry.connect(validator2).submitValidation(
      1, true, "evidence2", "0x", { value: ethers.parseEther("0.1") }
    );
    await validationRegistry.connect(validator3).submitValidation(
      1, true, "evidence3", "0x", { value: ethers.parseEther("0.1") }
    );

    // Paginate: offset=0, limit=2
    const page1 = await validationRegistry.getValidationResponsesPaginated(1, 0, 2);
    expect(page1.length).to.equal(2);

    // Paginate: offset=2, limit=2 (only 1 remaining)
    const page2 = await validationRegistry.getValidationResponsesPaginated(1, 2, 2);
    expect(page2.length).to.equal(1);

    // Paginate: offset beyond range
    const page3 = await validationRegistry.getValidationResponsesPaginated(1, 10, 2);
    expect(page3.length).to.equal(0);
  });

  it("should return correct agent validation requests count", async function () {
    // Create 2 validation requests for the same agent
    await validationRegistry.connect(human1).requestValidation(
      aiAgent1.address,
      "https://claims.example.com/claim1.json",
      ethers.keccak256(ethers.toUtf8Bytes("claim1")),
      0, 1,
      { value: ethers.parseEther("1.0") }
    );
    await validationRegistry.connect(human1).requestValidation(
      aiAgent1.address,
      "https://claims.example.com/claim2.json",
      ethers.keccak256(ethers.toUtf8Bytes("claim2")),
      0, 1,
      { value: ethers.parseEther("1.0") }
    );

    const count = await validationRegistry.getAgentValidationRequestsCount(aiAgent1.address);
    expect(count).to.equal(2);
  });

  it("should return paginated agent validation requests", async function () {
    // Create 3 requests
    for (let i = 0; i < 3; i++) {
      await validationRegistry.connect(human1).requestValidation(
        aiAgent1.address,
        `https://claims.example.com/claim${i}.json`,
        ethers.keccak256(ethers.toUtf8Bytes(`claim${i}`)),
        0, 1,
        { value: ethers.parseEther("1.0") }
      );
    }

    const page = await validationRegistry.getAgentValidationRequestsPaginated(
      aiAgent1.address, 0, 2
    );
    expect(page.length).to.equal(2);
    expect(page[0]).to.equal(1n);
    expect(page[1]).to.equal(2n);

    const page2 = await validationRegistry.getAgentValidationRequestsPaginated(
      aiAgent1.address, 2, 10
    );
    expect(page2.length).to.equal(1);
    expect(page2[0]).to.equal(3n);
  });

  it("should reject zero-address in getAgentValidationRequestsPaginated", async function () {
    await expect(
      validationRegistry.getAgentValidationRequestsPaginated(ethers.ZeroAddress, 0, 10)
    ).to.be.revertedWith("Invalid agent address");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  M-03: ProductionBeliefAttestationVerifier timelock (pre-existing)
// ═══════════════════════════════════════════════════════════════════════════

describe("M-03: ProductionBeliefAttestationVerifier timelock verification", function () {
  let prodVerifier, owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy a mock RISC Zero verifier (just needs to be a contract)
    const MockVerifier = await ethers.getContractFactory("BeliefAttestationVerifier");
    const mockVerifier = await MockVerifier.deploy();

    const ProdVerifier = await ethers.getContractFactory("ProductionBeliefAttestationVerifier");
    const imageId = ethers.keccak256(ethers.toUtf8Bytes("test-image-id"));
    prodVerifier = await ProdVerifier.deploy(
      await mockVerifier.getAddress(),
      imageId
    );
    await prodVerifier.waitForDeployment();
  });

  it("should have 48-hour timelock delay", async function () {
    const delay = await prodVerifier.getTimelockDelay();
    expect(delay).to.equal(48 * 60 * 60); // 48 hours in seconds
  });

  it("should propose image ID change with timelock", async function () {
    const newImageId = ethers.keccak256(ethers.toUtf8Bytes("new-image-id"));
    const tx = await prodVerifier.proposeImageIdChange(newImageId);

    await expect(tx).to.emit(prodVerifier, "ImageIdChangeProposed");

    const pending = await prodVerifier.getPendingImageIdChange();
    expect(pending.pendingId).to.equal(newImageId);
    expect(pending.isReady).to.be.false;
  });

  it("should reject execution before timelock expires", async function () {
    const newImageId = ethers.keccak256(ethers.toUtf8Bytes("new-image-id"));
    await prodVerifier.proposeImageIdChange(newImageId);

    await expect(
      prodVerifier.executeImageIdChange()
    ).to.be.revertedWithCustomError(prodVerifier, "TimelockNotExpired");
  });

  it("should allow execution after timelock expires", async function () {
    const newImageId = ethers.keccak256(ethers.toUtf8Bytes("new-image-id"));
    await prodVerifier.proposeImageIdChange(newImageId);

    // Fast-forward 48 hours
    await time.increase(48 * 60 * 60 + 1);

    const tx = await prodVerifier.executeImageIdChange();
    await expect(tx).to.emit(prodVerifier, "ImageIdUpdated");

    const currentImageId = await prodVerifier.getImageId();
    expect(currentImageId).to.equal(newImageId);
  });

  it("should allow cancellation of pending image ID change", async function () {
    const newImageId = ethers.keccak256(ethers.toUtf8Bytes("new-image-id"));
    await prodVerifier.proposeImageIdChange(newImageId);

    const tx = await prodVerifier.cancelImageIdChange();
    await expect(tx).to.emit(prodVerifier, "ImageIdChangeCancelled");

    const pending = await prodVerifier.getPendingImageIdChange();
    expect(pending.pendingId).to.equal(ethers.ZeroHash);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  M-04: AIPartnershipBondsV2 paginated getBondsByParticipant
// ═══════════════════════════════════════════════════════════════════════════

describe("M-04: AIPartnershipBondsV2 getBondsByParticipant", function () {
  let partnershipBonds, human1, aiAgent1, human2, aiAgent2;

  beforeEach(async function () {
    [, human1, aiAgent1, human2, aiAgent2] = await ethers.getSigners();

    const AIPartnership = await ethers.getContractFactory("AIPartnershipBondsV2");
    partnershipBonds = await AIPartnership.deploy();
    await partnershipBonds.waitForDeployment();
  });

  it("should track bonds for both human and AI participants", async function () {
    const stakeAmount = ethers.parseEther("1.0");
    await partnershipBonds.connect(human1).createBond(
      aiAgent1.address,
      "Coding partnership",
      { value: stakeAmount }
    );

    const humanBonds = await partnershipBonds.getBondsByParticipant(human1.address);
    expect(humanBonds.length).to.equal(1);
    expect(humanBonds[0]).to.equal(1n);

    const aiBonds = await partnershipBonds.getBondsByParticipant(aiAgent1.address);
    expect(aiBonds.length).to.equal(1);
    expect(aiBonds[0]).to.equal(1n);
  });

  it("should track multiple bonds per participant", async function () {
    const stakeAmount = ethers.parseEther("1.0");

    // Human1 creates 2 bonds with different AI agents
    await partnershipBonds.connect(human1).createBond(
      aiAgent1.address,
      "Partnership 1",
      { value: stakeAmount }
    );
    await partnershipBonds.connect(human1).createBond(
      aiAgent2.address,
      "Partnership 2",
      { value: stakeAmount }
    );

    const humanBonds = await partnershipBonds.getBondsByParticipant(human1.address);
    expect(humanBonds.length).to.equal(2);
    expect(humanBonds[0]).to.equal(1n);
    expect(humanBonds[1]).to.equal(2n);
  });

  it("should return correct count", async function () {
    const stakeAmount = ethers.parseEther("1.0");
    await partnershipBonds.connect(human1).createBond(
      aiAgent1.address,
      "Partnership 1",
      { value: stakeAmount }
    );
    await partnershipBonds.connect(human1).createBond(
      aiAgent2.address,
      "Partnership 2",
      { value: stakeAmount }
    );

    const count = await partnershipBonds.getBondsByParticipantCount(human1.address);
    expect(count).to.equal(2);
  });

  it("should paginate correctly", async function () {
    const stakeAmount = ethers.parseEther("1.0");

    // Create 5 bonds
    for (let i = 0; i < 5; i++) {
      const [, , , , , , , , extra1, extra2, extra3, extra4, extra5] =
        await ethers.getSigners();
      const agents = [aiAgent1, aiAgent2, extra1, extra2, extra3];
      await partnershipBonds.connect(human1).createBond(
        agents[i].address,
        `Partnership ${i}`,
        { value: stakeAmount }
      );
    }

    // Page 1: offset=0, limit=2
    const page1 = await partnershipBonds.getBondsByParticipantPaginated(
      human1.address, 0, 2
    );
    expect(page1.length).to.equal(2);
    expect(page1[0]).to.equal(1n);
    expect(page1[1]).to.equal(2n);

    // Page 2: offset=2, limit=2
    const page2 = await partnershipBonds.getBondsByParticipantPaginated(
      human1.address, 2, 2
    );
    expect(page2.length).to.equal(2);
    expect(page2[0]).to.equal(3n);
    expect(page2[1]).to.equal(4n);

    // Page 3: offset=4, limit=2 (only 1 remaining)
    const page3 = await partnershipBonds.getBondsByParticipantPaginated(
      human1.address, 4, 2
    );
    expect(page3.length).to.equal(1);
    expect(page3[0]).to.equal(5n);
  });

  it("should return empty array for offset beyond range", async function () {
    const stakeAmount = ethers.parseEther("1.0");
    await partnershipBonds.connect(human1).createBond(
      aiAgent1.address,
      "Partnership",
      { value: stakeAmount }
    );

    const page = await partnershipBonds.getBondsByParticipantPaginated(
      human1.address, 100, 10
    );
    expect(page.length).to.equal(0);
  });

  it("should return empty array for limit=0", async function () {
    const stakeAmount = ethers.parseEther("1.0");
    await partnershipBonds.connect(human1).createBond(
      aiAgent1.address,
      "Partnership",
      { value: stakeAmount }
    );

    const page = await partnershipBonds.getBondsByParticipantPaginated(
      human1.address, 0, 0
    );
    expect(page.length).to.equal(0);
  });

  it("should reject zero-address in getBondsByParticipant", async function () {
    await expect(
      partnershipBonds.getBondsByParticipant(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid participant address");
  });

  it("should reject zero-address in getBondsByParticipantPaginated", async function () {
    await expect(
      partnershipBonds.getBondsByParticipantPaginated(ethers.ZeroAddress, 0, 10)
    ).to.be.revertedWith("Invalid participant address");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  LOW: Zero-address checks, immutable, events
// ═══════════════════════════════════════════════════════════════════════════

describe("LOW: Zero-address checks and input validation", function () {
  it("VaultfireERC8004Adapter constructor should reject zero addresses", async function () {
    const [owner] = await ethers.getSigners();

    const AIPartnership = await ethers.getContractFactory("AIPartnershipBondsV2");
    const partnershipBonds = await AIPartnership.deploy();

    const IdentityRegistry = await ethers.getContractFactory("ERC8004IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy();

    const ReputationRegistry = await ethers.getContractFactory("ERC8004ReputationRegistry");
    const reputationRegistry = await ReputationRegistry.deploy(
      await identityRegistry.getAddress()
    );

    const ZKVerifier = await ethers.getContractFactory("BeliefAttestationVerifier");
    const zkVerifier = await ZKVerifier.deploy();

    const ValidationRegistry = await ethers.getContractFactory("ERC8004ValidationRegistry");
    const validationRegistry = await ValidationRegistry.deploy(
      await identityRegistry.getAddress(),
      await zkVerifier.getAddress()
    );

    const Adapter = await ethers.getContractFactory("VaultfireERC8004Adapter");

    await expect(
      Adapter.deploy(
        ethers.ZeroAddress,
        await identityRegistry.getAddress(),
        await reputationRegistry.getAddress(),
        await validationRegistry.getAddress()
      )
    ).to.be.revertedWith("Invalid partnership bonds");

    await expect(
      Adapter.deploy(
        await partnershipBonds.getAddress(),
        ethers.ZeroAddress,
        await reputationRegistry.getAddress(),
        await validationRegistry.getAddress()
      )
    ).to.be.revertedWith("Invalid identity registry");

    await expect(
      Adapter.deploy(
        await partnershipBonds.getAddress(),
        await identityRegistry.getAddress(),
        ethers.ZeroAddress,
        await validationRegistry.getAddress()
      )
    ).to.be.revertedWith("Invalid reputation registry");

    await expect(
      Adapter.deploy(
        await partnershipBonds.getAddress(),
        await identityRegistry.getAddress(),
        await reputationRegistry.getAddress(),
        ethers.ZeroAddress
      )
    ).to.be.revertedWith("Invalid validation registry");
  });

  it("Adapter registerAgentForPartnership should reject empty URI and type", async function () {
    const stack = await deployERC8004Stack();

    // Register agent in identity registry first
    await stack.identityRegistry.connect(stack.aiAgent1).registerAgent(
      "https://agent.example.com/card.json",
      "AI Assistant",
      ethers.keccak256(ethers.toUtf8Bytes("test"))
    );

    await expect(
      stack.adapter.connect(stack.aiAgent1).registerAgentForPartnership("", "AI Assistant")
    ).to.be.revertedWith("Agent URI required");

    await expect(
      stack.adapter.connect(stack.aiAgent1).registerAgentForPartnership(
        "https://agent.example.com/card.json", ""
      )
    ).to.be.revertedWith("Agent type required");
  });

  it("Adapter getAgentCrossPlatformReputation should reject zero address", async function () {
    const stack = await deployERC8004Stack();
    await expect(
      stack.adapter.getAgentCrossPlatformReputation(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid agent address");
  });

  it("Adapter isAgentFullyRegistered should reject zero address", async function () {
    const stack = await deployERC8004Stack();
    await expect(
      stack.adapter.isAgentFullyRegistered(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid agent address");
  });

  it("ERC8004ReputationRegistry identityRegistry should be immutable", async function () {
    const stack = await deployERC8004Stack();
    // If identityRegistry is immutable, it's stored in bytecode and cannot be changed.
    // We just verify it returns the correct address.
    const addr = await stack.reputationRegistry.identityRegistry();
    expect(addr).to.equal(await stack.identityRegistry.getAddress());
  });

  it("VaultfireERC8004Adapter state variables should be immutable", async function () {
    const stack = await deployERC8004Stack();
    // Verify all immutable references return correct addresses
    expect(await stack.adapter.partnershipBonds()).to.equal(
      await stack.partnershipBonds.getAddress()
    );
    expect(await stack.adapter.identityRegistry()).to.equal(
      await stack.identityRegistry.getAddress()
    );
    expect(await stack.adapter.reputationRegistry()).to.equal(
      await stack.reputationRegistry.getAddress()
    );
    expect(await stack.adapter.validationRegistry()).to.equal(
      await stack.validationRegistry.getAddress()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  LOW: BeliefOracle batchQueryBounded
// ═══════════════════════════════════════════════════════════════════════════

describe("LOW: BeliefOracle batchQueryBounded", function () {
  it("should reject batches larger than MAX_BATCH_QUERY", async function () {
    const { deployer, guardian, oracle } = await deployBeliefStack();

    // Create 51 vows (MAX_BATCH_QUERY = 50)
    const vows = [];
    const proofs = [];
    for (let i = 0; i < 51; i++) {
      const vow = `batch-test-vow-${i}`;
      vows.push(vow);
      proofs.push(await buildProof(deployer, vow));
    }

    await expect(
      oracle.connect(guardian).batchQueryBounded(vows, proofs)
    ).to.be.revertedWith("Batch too large");
  });
});
