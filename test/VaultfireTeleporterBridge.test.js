const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title VaultfireTeleporterBridge — Comprehensive Test Suite
 * @notice 60+ tests covering every aspect of the cross-chain trust bridge.
 *
 * Test categories:
 *   1. Deployment & initialization
 *   2. Admin / access control
 *   3. Relayer management
 *   4. Pause / unpause
 *   5. Remote configuration
 *   6. Outbound messages (send)
 *   7. Inbound messages via relayer (relayMessage)
 *   8. Inbound messages via Teleporter (receiveTeleporterMessage)
 *   9. Replay protection
 *  10. All five message types (agent, partnership, accountability, reputation, validation)
 *  11. Edge cases & reverts
 *  12. End-to-end cross-chain simulation
 */
describe("VaultfireTeleporterBridge", function () {
  // ── Constants ──────────────────────────────────────────────────────────
  const BASE_CHAIN_ID = 8453;
  const AVAX_CHAIN_ID = 43114;
  const GAS_LIMIT = 500000;

  // Simulated Teleporter blockchain IDs (bytes32)
  let BASE_BLOCKCHAIN_ID;
  let AVAX_BLOCKCHAIN_ID;

  // ── Actors ─────────────────────────────────────────────────────────────
  let owner, relayer, user, agent, hacker;

  // ── Contracts ──────────────────────────────────────────────────────────
  let baseBridge, avaxBridge;
  let mockTeleporter;

  // ── Helpers ────────────────────────────────────────────────────────────
  const MessageType = {
    SYNC_AGENT_REGISTRATION: 0,
    SYNC_PARTNERSHIP_BOND: 1,
    SYNC_ACCOUNTABILITY_BOND: 2,
    SYNC_REPUTATION: 3,
    SYNC_VALIDATION: 4,
  };

  function encodeBridgeMessage(type, sourceChainId, nonce, timestamp, sender, payload) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(uint8,uint256,uint256,uint256,address,bytes)"],
      [[type, sourceChainId, nonce, timestamp, sender, payload]]
    );
  }

  function encodeAgentPayload(agentAddr, uri, agentType, capHash, registeredAt) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(address,string,string,bytes32,uint256)"],
      [[agentAddr, uri, agentType, capHash, registeredAt]]
    );
  }

  function encodePartnershipPayload(bondId, human, aiAgent, purpose, createdAt, active) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(uint256,address,address,string,uint256,bool)"],
      [[bondId, human, aiAgent, purpose, createdAt, active]]
    );
  }

  function encodeAccountabilityPayload(bondId, aiCompany, companyName, revenue, stake, createdAt, active) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(uint256,address,string,uint256,uint256,uint256,bool)"],
      [[bondId, aiCompany, companyName, revenue, stake, createdAt, active]]
    );
  }

  function encodeReputationPayload(agentAddr, totalFeedbacks, avgRating, verified, lastUpdated) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(address,uint256,uint256,uint256,uint256)"],
      [[agentAddr, totalFeedbacks, avgRating, verified, lastUpdated]]
    );
  }

  function encodeValidationPayload(requestId, agentAddr, status, approvals, rejections, timestamp) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(uint256,address,uint8,uint256,uint256,uint256)"],
      [[requestId, agentAddr, status, approvals, rejections, timestamp]]
    );
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  beforeEach(async function () {
    [owner, relayer, user, agent, hacker] = await ethers.getSigners();

    BASE_BLOCKCHAIN_ID = ethers.keccak256(ethers.toBeHex(BASE_CHAIN_ID, 32));
    AVAX_BLOCKCHAIN_ID = ethers.keccak256(ethers.toBeHex(AVAX_CHAIN_ID, 32));

    // Deploy mock Teleporter
    const MockTeleporter = await ethers.getContractFactory("MockTeleporterMessenger");
    mockTeleporter = await MockTeleporter.deploy(AVAX_BLOCKCHAIN_ID);
    await mockTeleporter.waitForDeployment();

    // Deploy "Base" bridge (no Teleporter — relayer only)
    const Bridge = await ethers.getContractFactory("VaultfireTeleporterBridge");
    baseBridge = await Bridge.deploy(ethers.ZeroAddress, GAS_LIMIT);
    await baseBridge.waitForDeployment();

    // Deploy "Avalanche" bridge (with Teleporter)
    avaxBridge = await Bridge.deploy(await mockTeleporter.getAddress(), GAS_LIMIT);
    await avaxBridge.waitForDeployment();

    // Configure peers
    const baseBridgeAddr = await baseBridge.getAddress();
    const avaxBridgeAddr = await avaxBridge.getAddress();

    await baseBridge.setRemoteBridge(AVAX_BLOCKCHAIN_ID, avaxBridgeAddr, AVAX_CHAIN_ID);
    await avaxBridge.setRemoteBridge(BASE_BLOCKCHAIN_ID, baseBridgeAddr, BASE_CHAIN_ID);

    // Add relayer to both bridges
    await baseBridge.addRelayer(relayer.address);
    await avaxBridge.addRelayer(relayer.address);
  });

  // ═════════════════════════════════════════════════════════════════════
  //  1. DEPLOYMENT & INITIALIZATION
  // ═════════════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set the owner correctly", async function () {
      expect(await baseBridge.owner()).to.equal(owner.address);
      expect(await avaxBridge.owner()).to.equal(owner.address);
    });

    it("should set teleporterMessenger correctly", async function () {
      expect(await baseBridge.teleporterMessenger()).to.equal(ethers.ZeroAddress);
      expect(await avaxBridge.teleporterMessenger()).to.equal(await mockTeleporter.getAddress());
    });

    it("should set requiredGasLimit correctly", async function () {
      expect(await baseBridge.requiredGasLimit()).to.equal(GAS_LIMIT);
    });

    it("should initialize outboundNonce to 0", async function () {
      expect(await baseBridge.outboundNonce()).to.equal(0);
    });

    it("should not be paused initially", async function () {
      expect(await baseBridge.paused()).to.equal(false);
    });

    it("should make deployer an authorized relayer", async function () {
      expect(await baseBridge.authorizedRelayers(owner.address)).to.equal(true);
    });

    it("should have 2 relayers after adding one", async function () {
      expect(await baseBridge.getRelayerCount()).to.equal(2);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  2. ACCESS CONTROL
  // ═════════════════════════════════════════════════════════════════════

  describe("Access Control", function () {
    it("should revert when non-owner calls setRemoteBridge", async function () {
      await expect(
        baseBridge.connect(hacker).setRemoteBridge(AVAX_BLOCKCHAIN_ID, agent.address, AVAX_CHAIN_ID)
      ).to.be.revertedWith("VaultfireBridge: caller is not the owner");
    });

    it("should revert when non-owner calls addRelayer", async function () {
      await expect(
        baseBridge.connect(hacker).addRelayer(hacker.address)
      ).to.be.revertedWith("VaultfireBridge: caller is not the owner");
    });

    it("should revert when non-owner calls removeRelayer", async function () {
      await expect(
        baseBridge.connect(hacker).removeRelayer(relayer.address)
      ).to.be.revertedWith("VaultfireBridge: caller is not the owner");
    });

    it("should revert when non-owner calls pause", async function () {
      await expect(
        baseBridge.connect(hacker).pause()
      ).to.be.revertedWith("VaultfireBridge: caller is not the owner");
    });

    it("should revert when non-owner calls transferOwnership", async function () {
      await expect(
        baseBridge.connect(hacker).transferOwnership(hacker.address)
      ).to.be.revertedWith("VaultfireBridge: caller is not the owner");
    });

    it("should allow owner to transfer ownership", async function () {
      await baseBridge.transferOwnership(user.address);
      expect(await baseBridge.owner()).to.equal(user.address);
    });

    it("should revert transferOwnership to zero address", async function () {
      await expect(
        baseBridge.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("VaultfireBridge: zero address");
    });

    it("should emit OwnershipTransferred event", async function () {
      await expect(baseBridge.transferOwnership(user.address))
        .to.emit(baseBridge, "OwnershipTransferred")
        .withArgs(owner.address, user.address);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  3. RELAYER MANAGEMENT
  // ═════════════════════════════════════════════════════════════════════

  describe("Relayer Management", function () {
    it("should add a relayer successfully", async function () {
      expect(await baseBridge.authorizedRelayers(relayer.address)).to.equal(true);
    });

    it("should emit RelayerAdded event", async function () {
      const Bridge = await ethers.getContractFactory("VaultfireTeleporterBridge");
      const freshBridge = await Bridge.deploy(ethers.ZeroAddress, GAS_LIMIT);
      await expect(freshBridge.addRelayer(user.address))
        .to.emit(freshBridge, "RelayerAdded")
        .withArgs(user.address);
    });

    it("should revert adding duplicate relayer", async function () {
      await expect(
        baseBridge.addRelayer(relayer.address)
      ).to.be.revertedWith("VaultfireBridge: already authorized");
    });

    it("should revert adding zero address as relayer", async function () {
      await expect(
        baseBridge.addRelayer(ethers.ZeroAddress)
      ).to.be.revertedWith("VaultfireBridge: zero address");
    });

    it("should remove a relayer successfully", async function () {
      await baseBridge.removeRelayer(relayer.address);
      expect(await baseBridge.authorizedRelayers(relayer.address)).to.equal(false);
    });

    it("should emit RelayerRemoved event", async function () {
      await expect(baseBridge.removeRelayer(relayer.address))
        .to.emit(baseBridge, "RelayerRemoved")
        .withArgs(relayer.address);
    });

    it("should revert removing non-authorized relayer", async function () {
      await expect(
        baseBridge.removeRelayer(hacker.address)
      ).to.be.revertedWith("VaultfireBridge: not authorized");
    });

    it("should update relayer count after removal", async function () {
      await baseBridge.removeRelayer(relayer.address);
      expect(await baseBridge.getRelayerCount()).to.equal(1); // only owner left
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  4. PAUSE / UNPAUSE
  // ═════════════════════════════════════════════════════════════════════

  describe("Pause / Unpause", function () {
    it("should pause the bridge", async function () {
      await baseBridge.pause();
      expect(await baseBridge.paused()).to.equal(true);
    });

    it("should emit BridgePaused event", async function () {
      await expect(baseBridge.pause())
        .to.emit(baseBridge, "BridgePaused")
        .withArgs(owner.address);
    });

    it("should unpause the bridge", async function () {
      await baseBridge.pause();
      await baseBridge.unpause();
      expect(await baseBridge.paused()).to.equal(false);
    });

    it("should emit BridgeUnpaused event", async function () {
      await baseBridge.pause();
      await expect(baseBridge.unpause())
        .to.emit(baseBridge, "BridgeUnpaused")
        .withArgs(owner.address);
    });

    it("should revert sendAgentRegistration when paused", async function () {
      await baseBridge.pause();
      await expect(
        baseBridge.sendAgentRegistration(
          agent.address,
          "ipfs://agent-card",
          "AI Assistant",
          ethers.keccak256(ethers.toUtf8Bytes("capabilities")),
          1000000
        )
      ).to.be.revertedWith("VaultfireBridge: bridge is paused");
    });

    it("should revert relayMessage when paused", async function () {
      await baseBridge.pause();
      await expect(
        baseBridge.connect(relayer).relayMessage("0x00")
      ).to.be.revertedWith("VaultfireBridge: bridge is paused");
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  5. REMOTE CONFIGURATION
  // ═════════════════════════════════════════════════════════════════════

  describe("Remote Configuration", function () {
    it("should set remote bridge correctly", async function () {
      expect(await baseBridge.remoteBlockchainID()).to.equal(AVAX_BLOCKCHAIN_ID);
      expect(await baseBridge.remoteBridgeAddress()).to.equal(await avaxBridge.getAddress());
      expect(await baseBridge.remoteChainId()).to.equal(AVAX_CHAIN_ID);
    });

    it("should emit RemoteConfigured event", async function () {
      const Bridge = await ethers.getContractFactory("VaultfireTeleporterBridge");
      const freshBridge = await Bridge.deploy(ethers.ZeroAddress, GAS_LIMIT);
      await expect(
        freshBridge.setRemoteBridge(AVAX_BLOCKCHAIN_ID, agent.address, AVAX_CHAIN_ID)
      ).to.emit(freshBridge, "RemoteConfigured")
       .withArgs(AVAX_BLOCKCHAIN_ID, agent.address, AVAX_CHAIN_ID);
    });

    it("should revert setting zero address as remote bridge", async function () {
      await expect(
        baseBridge.setRemoteBridge(AVAX_BLOCKCHAIN_ID, ethers.ZeroAddress, AVAX_CHAIN_ID)
      ).to.be.revertedWith("VaultfireBridge: zero address");
    });

    it("should allow updating gas limit", async function () {
      await baseBridge.setRequiredGasLimit(1000000);
      expect(await baseBridge.requiredGasLimit()).to.equal(1000000);
    });

    it("should allow updating teleporter messenger", async function () {
      await baseBridge.setTeleporterMessenger(agent.address);
      expect(await baseBridge.teleporterMessenger()).to.equal(agent.address);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  6. OUTBOUND — Send Agent Registration
  // ═════════════════════════════════════════════════════════════════════

  describe("Send Agent Registration", function () {
    it("should increment nonce", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("capabilities"));
      await baseBridge.sendAgentRegistration(agent.address, "ipfs://card", "AI Bot", capHash, 1000);
      expect(await baseBridge.outboundNonce()).to.equal(1);
    });

    it("should emit MessageSent event", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("capabilities"));
      await expect(
        baseBridge.sendAgentRegistration(agent.address, "ipfs://card", "AI Bot", capHash, 1000)
      ).to.emit(baseBridge, "MessageSent");
    });

    it("should revert if remote not configured", async function () {
      const Bridge = await ethers.getContractFactory("VaultfireTeleporterBridge");
      const freshBridge = await Bridge.deploy(ethers.ZeroAddress, GAS_LIMIT);
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("capabilities"));
      await expect(
        freshBridge.sendAgentRegistration(agent.address, "ipfs://card", "AI Bot", capHash, 1000)
      ).to.be.revertedWith("VaultfireBridge: remote not configured");
    });

    it("should send via Teleporter when available", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("capabilities"));
      await avaxBridge.sendAgentRegistration(agent.address, "ipfs://card", "AI Bot", capHash, 1000);
      expect(await mockTeleporter.getSentMessageCount()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  7. OUTBOUND — Send Partnership Bond
  // ═════════════════════════════════════════════════════════════════════

  describe("Send Partnership Bond", function () {
    it("should send partnership bond and increment nonce", async function () {
      await baseBridge.sendPartnershipBond(1, user.address, agent.address, "AI Research", 1000, true);
      expect(await baseBridge.outboundNonce()).to.equal(1);
    });

    it("should emit MessageSent with correct type", async function () {
      const tx = await baseBridge.sendPartnershipBond(1, user.address, agent.address, "AI Research", 1000, true);
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => {
        try {
          return baseBridge.interface.parseLog({ topics: l.topics, data: l.data })?.name === "MessageSent";
        } catch { return false; }
      });
      const parsed = baseBridge.interface.parseLog({ topics: event.topics, data: event.data });
      expect(parsed.args.messageType).to.equal(MessageType.SYNC_PARTNERSHIP_BOND);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  8. OUTBOUND — Send Accountability Bond
  // ═════════════════════════════════════════════════════════════════════

  describe("Send Accountability Bond", function () {
    it("should send accountability bond", async function () {
      await baseBridge.sendAccountabilityBond(
        1, agent.address, "AI Corp", ethers.parseEther("100"), ethers.parseEther("30"), 1000, true
      );
      expect(await baseBridge.outboundNonce()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  9. OUTBOUND — Send Reputation
  // ═════════════════════════════════════════════════════════════════════

  describe("Send Reputation", function () {
    it("should send reputation update", async function () {
      await baseBridge.sendReputation(agent.address, 10, 8500, 7, 1000);
      expect(await baseBridge.outboundNonce()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  10. OUTBOUND — Send Validation
  // ═════════════════════════════════════════════════════════════════════

  describe("Send Validation", function () {
    it("should send validation status", async function () {
      await baseBridge.sendValidation(1, agent.address, 1, 3, 0, 1000);
      expect(await baseBridge.outboundNonce()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  11. INBOUND VIA RELAYER — Agent Registration
  // ═════════════════════════════════════════════════════════════════════

  describe("Relay Agent Registration", function () {
    let encodedMsg;

    beforeEach(async function () {
      // Hardhat default chain ID is 31337, but we configured remoteChainId
      // We need to use the correct source chain ID that matches the remote config
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      encodedMsg = encodeBridgeMessage(
        MessageType.SYNC_AGENT_REGISTRATION,
        AVAX_CHAIN_ID,  // source = Avax (relaying TO base bridge)
        1,
        1700000000,
        owner.address,
        payload
      );
    });

    it("should accept message from authorized relayer", async function () {
      await baseBridge.connect(relayer).relayMessage(encodedMsg);
      const synced = await baseBridge.getSyncedAgent(agent.address);
      expect(synced.agentAddress).to.equal(agent.address);
      expect(synced.agentURI).to.equal("ipfs://QmAgent");
      expect(synced.agentType).to.equal("Trading Bot");
    });

    it("should emit AgentSynced event", async function () {
      await expect(baseBridge.connect(relayer).relayMessage(encodedMsg))
        .to.emit(baseBridge, "AgentSynced")
        .withArgs(agent.address, "Trading Bot", AVAX_CHAIN_ID);
    });

    it("should emit MessageReceived event", async function () {
      await expect(baseBridge.connect(relayer).relayMessage(encodedMsg))
        .to.emit(baseBridge, "MessageReceived");
    });

    it("should update syncedAgentList", async function () {
      await baseBridge.connect(relayer).relayMessage(encodedMsg);
      expect(await baseBridge.getSyncedAgentCount()).to.equal(1);
    });

    it("should mark agent as recognized", async function () {
      await baseBridge.connect(relayer).relayMessage(encodedMsg);
      expect(await baseBridge.isAgentRecognized(agent.address)).to.equal(true);
    });

    it("should revert from unauthorized caller", async function () {
      await expect(
        baseBridge.connect(hacker).relayMessage(encodedMsg)
      ).to.be.revertedWith("VaultfireBridge: unauthorized relayer");
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  12. INBOUND VIA RELAYER — Partnership Bond
  // ═════════════════════════════════════════════════════════════════════

  describe("Relay Partnership Bond", function () {
    it("should sync partnership bond", async function () {
      const payload = encodePartnershipPayload(42, user.address, agent.address, "AI Companion", 1700000000, true);
      const encoded = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);

      const synced = await baseBridge.getSyncedPartnershipBond(42);
      expect(synced.bondId).to.equal(42);
      expect(synced.human).to.equal(user.address);
      expect(synced.aiAgent).to.equal(agent.address);
      expect(synced.purpose).to.equal("AI Companion");
      expect(synced.active).to.equal(true);
    });

    it("should emit PartnershipBondSynced event", async function () {
      const payload = encodePartnershipPayload(42, user.address, agent.address, "AI Companion", 1700000000, true);
      const encoded = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(baseBridge.connect(relayer).relayMessage(encoded))
        .to.emit(baseBridge, "PartnershipBondSynced")
        .withArgs(42, user.address, agent.address, AVAX_CHAIN_ID);
    });

    it("should update bond count", async function () {
      const payload = encodePartnershipPayload(42, user.address, agent.address, "AI Companion", 1700000000, true);
      const encoded = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);
      await baseBridge.connect(relayer).relayMessage(encoded);
      expect(await baseBridge.getSyncedPartnershipBondCount()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  13. INBOUND VIA RELAYER — Accountability Bond
  // ═════════════════════════════════════════════════════════════════════

  describe("Relay Accountability Bond", function () {
    it("should sync accountability bond", async function () {
      const payload = encodeAccountabilityPayload(
        7, agent.address, "NeuralCorp", ethers.parseEther("1000"), ethers.parseEther("300"), 1700000000, true
      );
      const encoded = encodeBridgeMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);

      const synced = await baseBridge.getSyncedAccountabilityBond(7);
      expect(synced.bondId).to.equal(7);
      expect(synced.aiCompany).to.equal(agent.address);
      expect(synced.companyName).to.equal("NeuralCorp");
      expect(synced.active).to.equal(true);
    });

    it("should emit AccountabilityBondSynced event", async function () {
      const payload = encodeAccountabilityPayload(
        7, agent.address, "NeuralCorp", ethers.parseEther("1000"), ethers.parseEther("300"), 1700000000, true
      );
      const encoded = encodeBridgeMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(baseBridge.connect(relayer).relayMessage(encoded))
        .to.emit(baseBridge, "AccountabilityBondSynced")
        .withArgs(7, agent.address, AVAX_CHAIN_ID);
    });

    it("should update accountability bond count", async function () {
      const payload = encodeAccountabilityPayload(
        7, agent.address, "NeuralCorp", ethers.parseEther("1000"), ethers.parseEther("300"), 1700000000, true
      );
      const encoded = encodeBridgeMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);
      await baseBridge.connect(relayer).relayMessage(encoded);
      expect(await baseBridge.getSyncedAccountabilityBondCount()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  14. INBOUND VIA RELAYER — Reputation
  // ═════════════════════════════════════════════════════════════════════

  describe("Relay Reputation", function () {
    it("should sync reputation", async function () {
      const payload = encodeReputationPayload(agent.address, 25, 9200, 20, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);

      const synced = await baseBridge.getSyncedReputation(agent.address);
      expect(synced.agentAddress).to.equal(agent.address);
      expect(synced.totalFeedbacks).to.equal(25);
      expect(synced.averageRating).to.equal(9200);
      expect(synced.verifiedFeedbacks).to.equal(20);
    });

    it("should emit ReputationSynced event", async function () {
      const payload = encodeReputationPayload(agent.address, 25, 9200, 20, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(baseBridge.connect(relayer).relayMessage(encoded))
        .to.emit(baseBridge, "ReputationSynced")
        .withArgs(agent.address, 9200, AVAX_CHAIN_ID);
    });

    it("should update reputation count", async function () {
      const payload = encodeReputationPayload(agent.address, 25, 9200, 20, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);
      await baseBridge.connect(relayer).relayMessage(encoded);
      expect(await baseBridge.getSyncedReputationCount()).to.equal(1);
    });

    it("should update existing reputation (not duplicate)", async function () {
      const payload1 = encodeReputationPayload(agent.address, 10, 8000, 8, 1700000000);
      const encoded1 = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload1);
      await baseBridge.connect(relayer).relayMessage(encoded1);

      const payload2 = encodeReputationPayload(agent.address, 25, 9200, 20, 1700001000);
      const encoded2 = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 2, 1700001000, owner.address, payload2);
      await baseBridge.connect(relayer).relayMessage(encoded2);

      // Should still be 1 agent, not 2
      expect(await baseBridge.getSyncedReputationCount()).to.equal(1);
      const synced = await baseBridge.getSyncedReputation(agent.address);
      expect(synced.averageRating).to.equal(9200); // Updated value
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  15. INBOUND VIA RELAYER — Validation
  // ═════════════════════════════════════════════════════════════════════

  describe("Relay Validation", function () {
    it("should sync validation", async function () {
      const payload = encodeValidationPayload(99, agent.address, 1, 5, 0, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_VALIDATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);

      const synced = await baseBridge.getSyncedValidation(99);
      expect(synced.requestId).to.equal(99);
      expect(synced.agentAddress).to.equal(agent.address);
      expect(synced.status).to.equal(1); // APPROVED
      expect(synced.approvalsCount).to.equal(5);
    });

    it("should emit ValidationSynced event", async function () {
      const payload = encodeValidationPayload(99, agent.address, 1, 5, 0, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_VALIDATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(baseBridge.connect(relayer).relayMessage(encoded))
        .to.emit(baseBridge, "ValidationSynced")
        .withArgs(99, agent.address, 1, AVAX_CHAIN_ID);
    });

    it("should update validation count", async function () {
      const payload = encodeValidationPayload(99, agent.address, 1, 5, 0, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_VALIDATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);
      await baseBridge.connect(relayer).relayMessage(encoded);
      expect(await baseBridge.getSyncedValidationCount()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  16. REPLAY PROTECTION
  // ═════════════════════════════════════════════════════════════════════

  describe("Replay Protection", function () {
    it("should reject duplicate messages", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);

      await expect(
        baseBridge.connect(relayer).relayMessage(encoded)
      ).to.be.revertedWith("VaultfireBridge: message already processed");
    });

    it("should track lastProcessedNonce", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 5, 1700000000, owner.address, payload);

      await baseBridge.connect(relayer).relayMessage(encoded);
      expect(await baseBridge.lastProcessedNonce()).to.equal(5);
    });

    it("should allow out-of-order nonces", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));

      // Send nonce 3 first
      const payload1 = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded1 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 3, 1700000000, owner.address, payload1);
      await baseBridge.connect(relayer).relayMessage(encoded1);

      // Then nonce 1
      const payload2 = encodeAgentPayload(user.address, "ipfs://QmUser", "Research Agent", capHash, 1700000001);
      const encoded2 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000001, owner.address, payload2);
      await baseBridge.connect(relayer).relayMessage(encoded2);

      // Both should be synced
      expect(await baseBridge.isAgentRecognized(agent.address)).to.equal(true);
      expect(await baseBridge.isAgentRecognized(user.address)).to.equal(true);
      expect(await baseBridge.lastProcessedNonce()).to.equal(3); // highest seen
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  17. SOURCE CHAIN VERIFICATION
  // ═════════════════════════════════════════════════════════════════════

  describe("Source Chain Verification", function () {
    it("should reject messages from wrong source chain", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      // Use wrong source chain ID (12345 instead of AVAX_CHAIN_ID)
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, 12345, 1, 1700000000, owner.address, payload);

      await expect(
        baseBridge.connect(relayer).relayMessage(encoded)
      ).to.be.revertedWith("VaultfireBridge: wrong source chain");
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  18. TELEPORTER INBOUND (receiveTeleporterMessage)
  // ═════════════════════════════════════════════════════════════════════

  describe("Teleporter Inbound", function () {
    it("should accept message from TeleporterMessenger", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, BASE_CHAIN_ID, 1, 1700000000, owner.address, payload);

      // Use mock teleporter to deliver message to avaxBridge
      await mockTeleporter.deliverMessage(
        await avaxBridge.getAddress(),
        BASE_BLOCKCHAIN_ID,
        await baseBridge.getAddress(),
        encoded
      );

      const synced = await avaxBridge.getSyncedAgent(agent.address);
      expect(synced.agentAddress).to.equal(agent.address);
      expect(synced.agentType).to.equal("Trading Bot");
    });

    it("should reject message from non-TeleporterMessenger", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, BASE_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(
        avaxBridge.connect(hacker).receiveTeleporterMessage(
          BASE_BLOCKCHAIN_ID,
          await baseBridge.getAddress(),
          encoded
        )
      ).to.be.revertedWith("VaultfireBridge: caller is not TeleporterMessenger");
    });

    it("should reject message from unknown source blockchain", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, BASE_CHAIN_ID, 1, 1700000000, owner.address, payload);

      const fakeBlockchainID = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(
        mockTeleporter.deliverMessage(
          await avaxBridge.getAddress(),
          fakeBlockchainID,
          await baseBridge.getAddress(),
          encoded
        )
      ).to.be.revertedWith("VaultfireBridge: unknown source chain");
    });

    it("should reject message from unknown sender", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(agent.address, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, BASE_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(
        mockTeleporter.deliverMessage(
          await avaxBridge.getAddress(),
          BASE_BLOCKCHAIN_ID,
          hacker.address,  // wrong sender
          encoded
        )
      ).to.be.revertedWith("VaultfireBridge: unknown sender");
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  19. EDGE CASES
  // ═════════════════════════════════════════════════════════════════════

  describe("Edge Cases", function () {
    it("should handle zero-address agent in registration (revert)", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      const payload = encodeAgentPayload(ethers.ZeroAddress, "ipfs://QmAgent", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(
        baseBridge.connect(relayer).relayMessage(encoded)
      ).to.be.revertedWith("VaultfireBridge: zero agent address");
    });

    it("should handle zero-address agent in reputation (revert)", async function () {
      const payload = encodeReputationPayload(ethers.ZeroAddress, 10, 8000, 8, 1700000000);
      const encoded = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload);

      await expect(
        baseBridge.connect(relayer).relayMessage(encoded)
      ).to.be.revertedWith("VaultfireBridge: zero agent address");
    });

    it("should update existing agent (not create duplicate)", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));

      // First registration
      const payload1 = encodeAgentPayload(agent.address, "ipfs://v1", "Trading Bot", capHash, 1700000000);
      const encoded1 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, payload1);
      await baseBridge.connect(relayer).relayMessage(encoded1);

      // Update same agent
      const payload2 = encodeAgentPayload(agent.address, "ipfs://v2", "Advanced Trading Bot", capHash, 1700001000);
      const encoded2 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 2, 1700001000, owner.address, payload2);
      await baseBridge.connect(relayer).relayMessage(encoded2);

      expect(await baseBridge.getSyncedAgentCount()).to.equal(1);
      const synced = await baseBridge.getSyncedAgent(agent.address);
      expect(synced.agentURI).to.equal("ipfs://v2");
      expect(synced.agentType).to.equal("Advanced Trading Bot");
    });

    it("should handle multiple different message types", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));

      // Agent registration
      const p1 = encodeAgentPayload(agent.address, "ipfs://agent", "Bot", capHash, 1700000000);
      const e1 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, p1);
      await baseBridge.connect(relayer).relayMessage(e1);

      // Partnership bond
      const p2 = encodePartnershipPayload(1, user.address, agent.address, "Research", 1700000000, true);
      const e2 = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 2, 1700000000, owner.address, p2);
      await baseBridge.connect(relayer).relayMessage(e2);

      // Reputation
      const p3 = encodeReputationPayload(agent.address, 10, 9000, 8, 1700000000);
      const e3 = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 3, 1700000000, owner.address, p3);
      await baseBridge.connect(relayer).relayMessage(e3);

      expect(await baseBridge.getSyncedAgentCount()).to.equal(1);
      expect(await baseBridge.getSyncedPartnershipBondCount()).to.equal(1);
      expect(await baseBridge.getSyncedReputationCount()).to.equal(1);
    });

    it("should handle updating partnership bond status", async function () {
      // Create active bond
      const p1 = encodePartnershipPayload(1, user.address, agent.address, "Research", 1700000000, true);
      const e1 = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 1, 1700000000, owner.address, p1);
      await baseBridge.connect(relayer).relayMessage(e1);

      // Deactivate bond
      const p2 = encodePartnershipPayload(1, user.address, agent.address, "Research", 1700000000, false);
      const e2 = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 2, 1700001000, owner.address, p2);
      await baseBridge.connect(relayer).relayMessage(e2);

      const synced = await baseBridge.getSyncedPartnershipBond(1);
      expect(synced.active).to.equal(false);
      expect(await baseBridge.getSyncedPartnershipBondCount()).to.equal(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  20. END-TO-END CROSS-CHAIN SIMULATION
  // ═════════════════════════════════════════════════════════════════════

  describe("End-to-End Cross-Chain Simulation", function () {
    it("should complete full trust portability flow: Base → Avalanche", async function () {
      // Step 1: Send agent registration from Base bridge
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("research"));
      await baseBridge.sendAgentRegistration(
        agent.address, "ipfs://QmResearchAgent", "Research Agent", capHash, 1700000000
      );

      // Step 2: Verify Teleporter message was NOT sent (Base has no Teleporter)
      expect(await baseBridge.teleporterMessenger()).to.equal(ethers.ZeroAddress);
      expect(await baseBridge.outboundNonce()).to.equal(1);

      // Step 3: Simulate relayer picking up the event and delivering to Avalanche bridge
      const payload = encodeAgentPayload(agent.address, "ipfs://QmResearchAgent", "Research Agent", capHash, 1700000000);
      const encoded = encodeBridgeMessage(
        MessageType.SYNC_AGENT_REGISTRATION,
        BASE_CHAIN_ID,  // source = Base
        1,
        1700000000,
        owner.address,
        payload
      );

      // Deliver via relayer to Avalanche bridge
      await avaxBridge.connect(relayer).relayMessage(encoded);

      // Step 4: Verify agent is now recognized on Avalanche
      expect(await avaxBridge.isAgentRecognized(agent.address)).to.equal(true);
      const synced = await avaxBridge.getSyncedAgent(agent.address);
      expect(synced.agentURI).to.equal("ipfs://QmResearchAgent");
      expect(synced.agentType).to.equal("Research Agent");
    });

    it("should complete full trust portability flow: Avalanche → Base via Teleporter", async function () {
      // Step 1: Send agent registration from Avalanche bridge (has Teleporter)
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("trading"));
      await avaxBridge.sendAgentRegistration(
        agent.address, "ipfs://QmTradingBot", "Trading Bot", capHash, 1700000000
      );

      // Step 2: Verify Teleporter message was sent
      expect(await mockTeleporter.getSentMessageCount()).to.equal(1);
      const sentMsg = await mockTeleporter.getLastSentMessage();
      expect(sentMsg.destinationAddress).to.equal(await baseBridge.getAddress());

      // Step 3: Simulate the message arriving on Base via relayer
      // (In production, the Teleporter relayer would handle this for Avalanche L1s,
      //  but for Base we use our custom relayer)
      const payload = encodeAgentPayload(agent.address, "ipfs://QmTradingBot", "Trading Bot", capHash, 1700000000);
      const encoded = encodeBridgeMessage(
        MessageType.SYNC_AGENT_REGISTRATION,
        AVAX_CHAIN_ID,
        1,
        1700000000,
        owner.address,
        payload
      );
      await baseBridge.connect(relayer).relayMessage(encoded);

      // Step 4: Verify agent is now recognized on Base
      expect(await baseBridge.isAgentRecognized(agent.address)).to.equal(true);
    });

    it("should sync complete trust profile across chains", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("full-stack"));

      // 1. Register agent
      const agentPayload = encodeAgentPayload(agent.address, "ipfs://QmFullStack", "Full Stack Agent", capHash, 1700000000);
      const agentMsg = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, agentPayload);
      await baseBridge.connect(relayer).relayMessage(agentMsg);

      // 2. Create partnership bond
      const bondPayload = encodePartnershipPayload(1, user.address, agent.address, "Development", 1700000000, true);
      const bondMsg = encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, 2, 1700000000, owner.address, bondPayload);
      await baseBridge.connect(relayer).relayMessage(bondMsg);

      // 3. Create accountability bond
      const accPayload = encodeAccountabilityPayload(1, agent.address, "AgentCorp", ethers.parseEther("500"), ethers.parseEther("150"), 1700000000, true);
      const accMsg = encodeBridgeMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, AVAX_CHAIN_ID, 3, 1700000000, owner.address, accPayload);
      await baseBridge.connect(relayer).relayMessage(accMsg);

      // 4. Submit reputation
      const repPayload = encodeReputationPayload(agent.address, 50, 9500, 45, 1700000000);
      const repMsg = encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, 4, 1700000000, owner.address, repPayload);
      await baseBridge.connect(relayer).relayMessage(repMsg);

      // 5. Validate
      const valPayload = encodeValidationPayload(1, agent.address, 1, 10, 0, 1700000000);
      const valMsg = encodeBridgeMessage(MessageType.SYNC_VALIDATION, AVAX_CHAIN_ID, 5, 1700000000, owner.address, valPayload);
      await baseBridge.connect(relayer).relayMessage(valMsg);

      // Verify complete trust profile
      expect(await baseBridge.isAgentRecognized(agent.address)).to.equal(true);
      expect(await baseBridge.getSyncedAgentCount()).to.equal(1);
      expect(await baseBridge.getSyncedPartnershipBondCount()).to.equal(1);
      expect(await baseBridge.getSyncedAccountabilityBondCount()).to.equal(1);
      expect(await baseBridge.getSyncedReputationCount()).to.equal(1);
      expect(await baseBridge.getSyncedValidationCount()).to.equal(1);

      const syncedAgent = await baseBridge.getSyncedAgent(agent.address);
      expect(syncedAgent.agentType).to.equal("Full Stack Agent");

      const syncedRep = await baseBridge.getSyncedReputation(agent.address);
      expect(syncedRep.averageRating).to.equal(9500);

      const syncedVal = await baseBridge.getSyncedValidation(1);
      expect(syncedVal.status).to.equal(1); // APPROVED

      expect(await baseBridge.lastProcessedNonce()).to.equal(5);
    });

    it("should handle bidirectional sync (both chains syncing to each other)", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("bidirectional"));

      // Agent registered on Base → sync to Avalanche
      const p1 = encodeAgentPayload(agent.address, "ipfs://base-agent", "Base Agent", capHash, 1700000000);
      const m1 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, BASE_CHAIN_ID, 1, 1700000000, owner.address, p1);
      await avaxBridge.connect(relayer).relayMessage(m1);

      // Different agent registered on Avalanche → sync to Base
      const p2 = encodeAgentPayload(user.address, "ipfs://avax-agent", "Avax Agent", capHash, 1700000000);
      const m2 = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, 1, 1700000000, owner.address, p2);
      await baseBridge.connect(relayer).relayMessage(m2);

      // Verify both chains have the correct synced agents
      expect(await avaxBridge.isAgentRecognized(agent.address)).to.equal(true);
      expect(await baseBridge.isAgentRecognized(user.address)).to.equal(true);

      const avaxSynced = await avaxBridge.getSyncedAgent(agent.address);
      expect(avaxSynced.agentType).to.equal("Base Agent");

      const baseSynced = await baseBridge.getSyncedAgent(user.address);
      expect(baseSynced.agentType).to.equal("Avax Agent");
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  21. MULTIPLE MESSAGES & STRESS
  // ═════════════════════════════════════════════════════════════════════

  describe("Multiple Messages", function () {
    it("should handle 10 sequential agent registrations", async function () {
      const signers = await ethers.getSigners();
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("batch"));

      for (let i = 0; i < 10; i++) {
        const addr = signers[i % signers.length].address;
        const payload = encodeAgentPayload(addr, `ipfs://agent-${i}`, `Agent ${i}`, capHash, 1700000000 + i);
        const encoded = encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, i + 1, 1700000000 + i, owner.address, payload);
        await baseBridge.connect(relayer).relayMessage(encoded);
      }

      // We have 5 signers, so some agents will be updated rather than created
      // The count should be <= 10 (some addresses overlap)
      const count = await baseBridge.getSyncedAgentCount();
      expect(count).to.be.lte(10);
      expect(count).to.be.gte(1);
    });

    it("should handle mixed message types in sequence", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("mixed"));
      let nonce = 1;

      // Agent
      const p1 = encodeAgentPayload(agent.address, "ipfs://agent", "Bot", capHash, 1700000000);
      await baseBridge.connect(relayer).relayMessage(
        encodeBridgeMessage(MessageType.SYNC_AGENT_REGISTRATION, AVAX_CHAIN_ID, nonce++, 1700000000, owner.address, p1)
      );

      // Partnership
      const p2 = encodePartnershipPayload(1, user.address, agent.address, "P1", 1700000000, true);
      await baseBridge.connect(relayer).relayMessage(
        encodeBridgeMessage(MessageType.SYNC_PARTNERSHIP_BOND, AVAX_CHAIN_ID, nonce++, 1700000000, owner.address, p2)
      );

      // Accountability
      const p3 = encodeAccountabilityPayload(1, agent.address, "Corp", 1000, 300, 1700000000, true);
      await baseBridge.connect(relayer).relayMessage(
        encodeBridgeMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, AVAX_CHAIN_ID, nonce++, 1700000000, owner.address, p3)
      );

      // Reputation
      const p4 = encodeReputationPayload(agent.address, 5, 8000, 4, 1700000000);
      await baseBridge.connect(relayer).relayMessage(
        encodeBridgeMessage(MessageType.SYNC_REPUTATION, AVAX_CHAIN_ID, nonce++, 1700000000, owner.address, p4)
      );

      // Validation
      const p5 = encodeValidationPayload(1, agent.address, 1, 3, 0, 1700000000);
      await baseBridge.connect(relayer).relayMessage(
        encodeBridgeMessage(MessageType.SYNC_VALIDATION, AVAX_CHAIN_ID, nonce++, 1700000000, owner.address, p5)
      );

      // All counts should be 1
      expect(await baseBridge.getSyncedAgentCount()).to.equal(1);
      expect(await baseBridge.getSyncedPartnershipBondCount()).to.equal(1);
      expect(await baseBridge.getSyncedAccountabilityBondCount()).to.equal(1);
      expect(await baseBridge.getSyncedReputationCount()).to.equal(1);
      expect(await baseBridge.getSyncedValidationCount()).to.equal(1);
      expect(await baseBridge.lastProcessedNonce()).to.equal(5);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  22. TELEPORTER SEND VERIFICATION
  // ═════════════════════════════════════════════════════════════════════

  describe("Teleporter Send Verification", function () {
    it("should send correct destination in Teleporter message", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await avaxBridge.sendAgentRegistration(agent.address, "ipfs://test", "Test", capHash, 1000);

      const sent = await mockTeleporter.getLastSentMessage();
      expect(sent.destinationBlockchainID).to.equal(BASE_BLOCKCHAIN_ID);
      expect(sent.destinationAddress).to.equal(await baseBridge.getAddress());
    });

    it("should send correct gas limit in Teleporter message", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await avaxBridge.sendAgentRegistration(agent.address, "ipfs://test", "Test", capHash, 1000);

      const sent = await mockTeleporter.getLastSentMessage();
      expect(sent.requiredGasLimit).to.equal(GAS_LIMIT);
    });

    it("should increment Teleporter message count for each send", async function () {
      const capHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await avaxBridge.sendAgentRegistration(agent.address, "ipfs://test1", "Test1", capHash, 1000);
      await avaxBridge.sendReputation(agent.address, 5, 8000, 4, 1000);
      await avaxBridge.sendValidation(1, agent.address, 1, 3, 0, 1000);

      expect(await mockTeleporter.getSentMessageCount()).to.equal(3);
    });
  });
});
