#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
//  Vaultfire Sentinel Agent — 24/7 Autonomous Cross-Chain Monitor & Bridge Relay
//  Avalanche Build Games 2026
//
//  "Morals over metrics. Privacy over surveillance. Freedom over control."
//
//  This agent monitors all 14 Vaultfire Protocol contracts on Base mainnet and
//  Avalanche C-Chain, automatically relays Teleporter bridge messages between
//  chains, and self-registers as an AI agent bonded with its human partner.
//
//  CRITICAL: This agent NEVER touches Assemble AI tokens — only native ETH/AVAX.
// ═══════════════════════════════════════════════════════════════════════════════

"use strict";

const { ethers } = require("ethers");

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // ── Chain RPCs with fallbacks ─────────────────────────────────────────────
  base: {
    chainId: 8453,
    name: "Base",
    rpcs: [
      process.env.BASE_RPC || "https://mainnet.base.org",
      "https://base.publicnode.com",
      "https://base-rpc.publicnode.com",
    ],
    explorer: "https://basescan.org",
  },
  avalanche: {
    chainId: 43114,
    name: "Avalanche",
    rpcs: [
      process.env.AVAX_RPC || "https://api.avax.network/ext/bc/C/rpc",
      "https://avalanche-c-chain-rpc.publicnode.com",
    ],
    explorer: "https://snowscan.xyz",
  },

  // ── Deployer / Operator ───────────────────────────────────────────────────
  deployerAddress: "0x2fAd5B3E4E2883c6b42a22a1943Dc6e3Ccc72A0b",
  deployerKey: process.env.DEPLOYER_KEY || "e189d7fa3c02b2716d78d97002654f953604bb28f14b662b4e410a395da8d410",

  // ── Timing ────────────────────────────────────────────────────────────────
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "12000", 10),  // 12s (Base block time ~2s, Avax ~2s)
  healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_MS || "300000", 10),  // 5 min
  reconnectDelayMs: 5000,
  maxReconnectAttempts: 50,

  // ── Agent identity ────────────────────────────────────────────────────────
  agentURI: "ipfs://vaultfire-sentinel-agent-v1",
  agentType: "sentinel",
  capabilities: ["monitoring", "bridge-relay", "cross-chain-sync", "event-indexing"],
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTRACT ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CONTRACTS = {
  PrivacyGuarantees:                    "0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e",
  MissionEnforcement:                   "0x6EC0440e1601558024f285903F0F4577B109B609",
  AntiSurveillance:                     "0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac",
  ERC8004IdentityRegistry:              "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD",
  BeliefAttestationVerifier:            "0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a",
  ERC8004ReputationRegistry:            "0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C",
  ERC8004ValidationRegistry:            "0x50E4609991691D5104016c4a2F6D2875234d4B06",
  AIPartnershipBondsV2:                 "0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855",
  AIAccountabilityBondsV2:              "0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140",
  VaultfireERC8004Adapter:              "0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361",
  MultisigGovernance:                   "0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D",
  FlourishingMetricsOracle:             "0xb751abb1158908114662b254567b8135C460932C",
  ProductionBeliefAttestationVerifier:  "0xBDB5d85B3a84C773113779be89A166Ed515A7fE2",
  VaultfireTeleporterBridge:            "0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528",
};

const AVAX_CONTRACTS = {
  VaultfireTeleporterBridge:            "0x75de435Acc5dec0f612408f02Ae169528ce3a91b",
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ABIs — Events + Functions needed by the sentinel
// ═══════════════════════════════════════════════════════════════════════════════

const ABIS = {
  PrivacyGuarantees: [
    "event DataDeletionRequested(address indexed user, uint256 effectiveAt)",
    "event DataPermanentlyDeleted(address indexed user, uint256 timestamp)",
    "event ConsentGranted(address indexed user, bytes32 indexed purposeHash)",
    "event ConsentRevoked(address indexed user, bytes32 indexed purposeHash)",
    "function getPrivacyPolicy() view returns (string)",
  ],

  MissionEnforcement: [
    "event ModuleMissionCompliant(address indexed module, uint256 timestamp)",
    "event MissionViolationReported(address indexed module, address indexed reporter, uint8 principle, string evidence, uint256 timestamp)",
    "event MissionViolationDetected(address indexed module, uint8 principle, string evidence, uint256 timestamp)",
    "event MissionBypassAttemptBlocked(address indexed module, uint8 principle, uint256 timestamp)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "function owner() view returns (address)",
    "function getMissionStatement() view returns (string)",
  ],

  AntiSurveillance: [
    "event ModuleVerifiedSurveillanceFree(address indexed module, uint256 timestamp)",
    "event ModuleBannedForSurveillance(address indexed module, uint8 violationType, bytes32 indexed reasonHash, bytes32 indexed evidenceHash, uint256 timestamp)",
    "event SurveillanceAttemptBlocked(address indexed attacker, uint8 attemptedType, uint256 timestamp)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "function owner() view returns (address)",
    "function getAntiSurveillancePolicy() view returns (string)",
  ],

  ERC8004IdentityRegistry: [
    "event AgentRegistered(address indexed agentAddress, string agentURI, string agentType, bytes32 capabilitiesHash, uint256 timestamp)",
    "event AgentUpdated(address indexed agentAddress, string newAgentURI, uint256 timestamp)",
    "event AgentDeactivated(address indexed agentAddress, uint256 timestamp)",
    "function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash)",
    "function getAgent(address) view returns (address agentAddress, string agentURI, uint256 registeredAt, bool active, string agentType, bytes32 capabilitiesHash)",
    "function getTotalAgents() view returns (uint256)",
    "function isAgentActive(address) view returns (bool)",
  ],

  BeliefAttestationVerifier: [
    "event ProofVerified(bytes32 indexed beliefHash, address indexed proverAddress, uint256 epoch, uint256 moduleID)",
    "event DevVerifierUsed(address indexed caller, bytes32 indexed beliefHash, uint256 chainId, uint256 timestamp)",
    "function getPublicInputsCount() view returns (uint256)",
    "function getProofSystemId() view returns (string)",
    "function getMinBeliefThreshold() view returns (uint256)",
  ],

  ERC8004ReputationRegistry: [
    "event FeedbackSubmitted(uint256 indexed feedbackId, address indexed reviewer, address indexed agentAddress, uint256 rating, string category, bool verified, uint256 bondId, uint256 timestamp)",
    "event FeedbackSubmittedHashed(uint256 indexed feedbackId, address indexed reviewer, address indexed agentAddress, uint256 rating, bytes32 categoryHash, bytes32 feedbackURIHash, bool verified, uint256 bondId, uint256 timestamp)",
    "event ReputationUpdated(address indexed agentAddress, uint256 averageRating, uint256 totalFeedbacks, uint256 timestamp)",
    "function getReputation(address) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 verifiedFeedbacks, uint256 lastUpdated)",
    "function nextFeedbackId() view returns (uint256)",
  ],

  ERC8004ValidationRegistry: [
    "event ValidationRequested(uint256 indexed requestId, address indexed agentAddress, address indexed requester, uint8 validationType, uint256 stakeAmount, uint256 timestamp)",
    "event ValidationResponseSubmitted(uint256 indexed responseId, uint256 indexed requestId, address indexed validator, bool approved, uint256 timestamp)",
    "event ValidationCompleted(uint256 indexed requestId, uint8 finalStatus, uint256 timestamp)",
    "event ValidatorStaked(address indexed validator, uint256 amount, uint256 totalStake, uint256 timestamp)",
    "event ValidatorSlashed(address indexed validator, uint256 amount, string reason, uint256 timestamp)",
    "event ValidatorStakeWithdrawn(address indexed validator, uint256 amount, uint256 remainingStake, uint256 timestamp)",
    "function nextRequestId() view returns (uint256)",
    "function nextResponseId() view returns (uint256)",
  ],

  AIPartnershipBondsV2: [
    "event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp)",
    "event PartnershipMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp)",
    "event PartnershipMetricsSubmittedHashed(uint256 indexed bondId, address submitter, uint256 timestamp, bytes32 progressNotesHash)",
    "event HumanVerificationSubmitted(uint256 indexed bondId, address indexed verifier, bool confirmsPartnership, bool confirmsGrowth, bool confirmsAutonomy, uint256 timestamp)",
    "event HumanVerificationSubmittedHashed(uint256 indexed bondId, address indexed verifier, bool confirmsPartnership, bool confirmsGrowth, bool confirmsAutonomy, uint256 timestamp, bytes32 relationshipHash, bytes32 notesHash)",
    "event DistributionRequested(uint256 indexed bondId, address indexed requester, uint256 requestedAt, uint256 availableAt)",
    "event BondDistributed(uint256 indexed bondId, uint256 humanShare, uint256 aiShare, uint256 fundShare, string reason, uint256 timestamp)",
    "event AIDominationPenalty(uint256 indexed bondId, string reason, uint256 timestamp)",
    "event PartnershipFundAccrued(uint256 indexed bondId, uint256 amount, uint256 newTotal, uint256 timestamp)",
    "function createBond(address aiAgent, string partnershipType) payable returns (uint256)",
    "function nextBondId() view returns (uint256)",
    "function getBond(uint256) view returns (tuple(uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))",
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function yieldPool() view returns (uint256)",
    "function totalActiveBondValue() view returns (uint256)",
  ],

  AIAccountabilityBondsV2: [
    "event BondCreated(uint256 indexed bondId, address indexed aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 timestamp)",
    "event MetricsSubmitted(uint256 indexed bondId, uint256 timestamp, uint256 globalFlourishingScore)",
    "event DistributionRequested(uint256 indexed bondId, address indexed aiCompany, uint256 requestedAt, uint256 availableAt)",
    "event BondDistributed(uint256 indexed bondId, address indexed aiCompany, uint256 humanShare, uint256 aiCompanyShare, int256 appreciation, string reason, uint256 timestamp)",
    "event ProfitsLocked(uint256 indexed bondId, string reason, uint256 timestamp)",
    "event OracleRegistered(address indexed oracleAddress, string sourceName, uint256 trustScore, uint256 timestamp)",
    "event AIVerificationSubmitted(uint256 indexed bondId, address indexed verifyingAI, bool confirmsMetrics, uint256 stakeAmount, uint256 timestamp)",
    "event MetricsChallenged(uint256 indexed bondId, address indexed challenger, string reason, uint256 challengeStake, uint256 timestamp)",
    "event ChallengeResolved(uint256 indexed bondId, uint256 indexed challengeIndex, bool challengeUpheld, uint256 timestamp)",
    "function nextBondId() view returns (uint256)",
    "function getBond(uint256) view returns (tuple(uint256 bondId, address aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))",
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function yieldPool() view returns (uint256)",
    "function totalActiveBondValue() view returns (uint256)",
  ],

  VaultfireERC8004Adapter: [
    "event AgentAutoRegistered(address indexed agentAddress, string agentType, uint256 timestamp)",
    "event PartnershipReputationSynced(uint256 indexed bondId, address indexed agentAddress, uint256 rating, uint256 timestamp)",
    "event ValidationRequestCreated(uint256 indexed requestId, uint256 indexed bondId, address indexed agentAddress, uint256 timestamp)",
    "function discoverVaultfireAgents() view returns (address[])",
    "function isAgentFullyRegistered(address) view returns (bool registeredERC8004, bool registeredVaultFire)",
  ],

  MultisigGovernance: [
    "event TransactionProposed(uint256 indexed txId, address indexed proposer, address indexed target, bytes data, uint256 value, uint256 expiresAt)",
    "event TransactionConfirmed(uint256 indexed txId, address indexed signer)",
    "event ConfirmationRevoked(uint256 indexed txId, address indexed signer)",
    "event TransactionExecuted(uint256 indexed txId, address indexed executor)",
    "event SignerAdded(address indexed signer)",
    "event SignerRemoved(address indexed signer)",
    "event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold)",
    "function getSigners() view returns (address[])",
    "function getSignerCount() view returns (uint256)",
    "function threshold() view returns (uint256)",
    "function transactionCount() view returns (uint256)",
  ],

  FlourishingMetricsOracle: [
    "event OracleAdded(address indexed oracle)",
    "event OracleRemoved(address indexed oracle)",
    "event RoundStarted(uint256 indexed roundId, bytes32 indexed metricId, uint256 deadline)",
    "event MetricSubmitted(uint256 indexed roundId, address indexed oracle, uint256 value)",
    "event ConsensusReached(uint256 indexed roundId, bytes32 indexed metricId, uint256 consensusValue, uint256 submissionCount)",
    "event RoundExpired(uint256 indexed roundId)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "function oracleCount() view returns (uint256)",
    "function nextRoundId() view returns (uint256)",
    "function getOracles() view returns (address[])",
    "function owner() view returns (address)",
  ],

  ProductionBeliefAttestationVerifier: [
    "event AttestationVerified(bytes32 indexed beliefHash, address indexed attester, uint256 epoch, uint256 moduleId, uint256 beliefScore, uint256 timestamp)",
    "event VerificationFailed(bytes32 indexed beliefHash, address indexed attester, string reason)",
    "event ImageIdUpdated(bytes32 indexed oldImageId, bytes32 indexed newImageId)",
    "event ImageIdChangeProposed(bytes32 indexed currentImageId, bytes32 indexed proposedImageId, uint256 effectiveAt)",
    "event ImageIdChangeCancelled(bytes32 indexed cancelledImageId)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "function attestationCount() view returns (uint256)",
    "function getImageId() view returns (bytes32)",
    "function owner() view returns (address)",
  ],

  VaultfireTeleporterBridge: [
    "event MessageSent(uint256 indexed nonce, uint8 indexed messageType, bytes32 messageHash, uint256 destinationChainId)",
    "event MessageReceived(uint256 indexed nonce, uint8 indexed messageType, bytes32 messageHash, uint256 sourceChainId)",
    "event AgentSynced(address indexed agentAddress, string agentType, uint256 sourceChainId)",
    "event PartnershipBondSynced(uint256 indexed bondId, address human, address aiAgent, uint256 sourceChainId)",
    "event AccountabilityBondSynced(uint256 indexed bondId, address aiCompany, uint256 sourceChainId)",
    "event ReputationSynced(address indexed agentAddress, uint256 averageRating, uint256 sourceChainId)",
    "event ValidationSynced(uint256 indexed requestId, address agentAddress, uint8 status, uint256 sourceChainId)",
    "event RelayerAdded(address indexed relayer)",
    "event RelayerRemoved(address indexed relayer)",
    "event BridgePaused(address indexed by)",
    "event BridgeUnpaused(address indexed by)",
    "event RemoteConfigured(bytes32 remoteBlockchainID, address remoteBridgeAddress, uint256 remoteChainId)",
    "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
    "function relayMessage(bytes encodedMessage)",
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function outboundNonce() view returns (uint256)",
    "function lastProcessedNonce() view returns (uint256)",
    "function remoteBridgeAddress() view returns (address)",
    "function remoteChainId() view returns (uint256)",
    "function authorizedRelayers(address) view returns (bool)",
    "function getRelayerCount() view returns (uint256)",
    "function processedMessages(bytes32) view returns (bool)",
    "function getSyncedAgentCount() view returns (uint256)",
    "function getSyncedPartnershipBondCount() view returns (uint256)",
    "function getSyncedAccountabilityBondCount() view returns (uint256)",
    "function getSyncedReputationCount() view returns (uint256)",
    "function getSyncedValidationCount() view returns (uint256)",
    "function isAgentRecognized(address) view returns (bool)",
    "function sendAgentRegistration(address, string, string, bytes32, uint256) returns (uint256)",
    "function sendPartnershipBond(uint256, address, address, string, uint256, bool) returns (uint256)",
    "function sendReputation(address, uint256, uint256, uint256, uint256) returns (uint256)",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || "INFO"];

function log(level, category, message, data = null) {
  if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) return;
  const ts = new Date().toISOString();
  const prefix = {
    DEBUG: "\x1b[90m[DEBUG]\x1b[0m",
    INFO: "\x1b[36m[INFO]\x1b[0m",
    WARN: "\x1b[33m[WARN]\x1b[0m",
    ERROR: "\x1b[31m[ERROR]\x1b[0m",
    CRITICAL: "\x1b[41m\x1b[37m[CRITICAL]\x1b[0m",
  }[level];
  const cat = `\x1b[35m[${category}]\x1b[0m`;
  const line = `${ts} ${prefix} ${cat} ${message}`;
  if (data) {
    console.log(line, typeof data === "object" ? JSON.stringify(data, null, 0) : data);
  } else {
    console.log(line);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATISTICS TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

const stats = {
  startedAt: null,
  eventsProcessed: 0,
  bridgeMessagesRelayed: 0,
  bridgeRelayErrors: 0,
  reconnections: 0,
  lastEventAt: null,
  eventsByType: {},
  eventsByChain: { base: 0, avalanche: 0 },

  record(chain, eventName) {
    this.eventsProcessed++;
    this.lastEventAt = new Date().toISOString();
    this.eventsByChain[chain]++;
    this.eventsByType[eventName] = (this.eventsByType[eventName] || 0) + 1;
  },

  summary() {
    const uptime = this.startedAt
      ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
      : 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    return {
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      eventsProcessed: this.eventsProcessed,
      bridgeMessagesRelayed: this.bridgeMessagesRelayed,
      bridgeRelayErrors: this.bridgeRelayErrors,
      reconnections: this.reconnections,
      lastEventAt: this.lastEventAt,
      eventsByChain: { ...this.eventsByChain },
      topEvents: Object.entries(this.eventsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => `${name}: ${count}`),
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PROVIDER MANAGEMENT — Fallback RPC with auto-reconnect
// ═══════════════════════════════════════════════════════════════════════════════

class ResilientProvider {
  constructor(chainConfig) {
    this.chainConfig = chainConfig;
    this.currentRpcIndex = 0;
    this.provider = null;
    this.reconnectAttempts = 0;
  }

  async connect() {
    for (let i = 0; i < this.chainConfig.rpcs.length; i++) {
      const rpcUrl = this.chainConfig.rpcs[(this.currentRpcIndex + i) % this.chainConfig.rpcs.length];
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, this.chainConfig.chainId, {
          staticNetwork: true,
          batchMaxCount: 1,
        });
        // Verify connection
        const blockNumber = await provider.getBlockNumber();
        this.provider = provider;
        this.currentRpcIndex = (this.currentRpcIndex + i) % this.chainConfig.rpcs.length;
        this.reconnectAttempts = 0;
        log("INFO", this.chainConfig.name, `Connected to RPC ${rpcUrl} at block ${blockNumber}`);
        return provider;
      } catch (err) {
        log("WARN", this.chainConfig.name, `RPC ${rpcUrl} failed: ${err.message}`);
      }
    }
    throw new Error(`All RPCs failed for ${this.chainConfig.name}`);
  }

  async reconnect() {
    this.reconnectAttempts++;
    stats.reconnections++;
    if (this.reconnectAttempts > CONFIG.maxReconnectAttempts) {
      log("CRITICAL", this.chainConfig.name, `Max reconnect attempts (${CONFIG.maxReconnectAttempts}) exceeded`);
      throw new Error(`Max reconnect attempts exceeded for ${this.chainConfig.name}`);
    }
    log("WARN", this.chainConfig.name, `Reconnecting (attempt ${this.reconnectAttempts})...`);
    // Rotate to next RPC
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.chainConfig.rpcs.length;
    await sleep(CONFIG.reconnectDelayMs * Math.min(this.reconnectAttempts, 10));
    return this.connect();
  }

  getProvider() {
    return this.provider;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortenAddr(addr) {
  if (!addr) return "null";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortenHash(hash) {
  if (!hash) return "null";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatEther(wei) {
  try {
    return ethers.formatEther(wei);
  } catch {
    return String(wei);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENT MONITOR — Polls for events on a single chain
// ═══════════════════════════════════════════════════════════════════════════════

class ChainMonitor {
  constructor(chainName, resilientProvider, contracts, onEvent) {
    this.chainName = chainName;
    this.resilientProvider = resilientProvider;
    this.contracts = contracts;       // { name: { address, abi } }
    this.onEvent = onEvent;           // callback(chainName, contractName, eventName, log, parsedArgs)
    this.lastBlock = null;
    this.running = false;
    this.interfaces = {};             // name -> ethers.Interface
    this.topicToEvent = {};           // topic0 -> { contractName, eventName, iface }
  }

  async init() {
    const provider = this.resilientProvider.getProvider();
    this.lastBlock = await provider.getBlockNumber();
    log("INFO", this.chainName, `Starting monitor from block ${this.lastBlock}`);

    // Build interfaces and topic maps
    for (const [name, { abi }] of Object.entries(this.contracts)) {
      const iface = new ethers.Interface(abi);
      this.interfaces[name] = iface;

      // Map each event topic to its contract
      for (const eventFragment of iface.fragments.filter((f) => f.type === "event")) {
        const topic = iface.getEvent(eventFragment.name).topicHash;
        this.topicToEvent[topic] = {
          contractName: name,
          eventName: eventFragment.name,
          iface,
        };
      }
    }
  }

  async poll() {
    const provider = this.resilientProvider.getProvider();
    let currentBlock;
    try {
      currentBlock = await provider.getBlockNumber();
    } catch (err) {
      log("ERROR", this.chainName, `getBlockNumber failed: ${err.message}`);
      await this.resilientProvider.reconnect();
      return;
    }

    if (currentBlock <= this.lastBlock) return;

    // Cap range to avoid huge queries (max 2000 blocks at a time)
    const fromBlock = this.lastBlock + 1;
    const toBlock = Math.min(currentBlock, fromBlock + 1999);

    const addresses = Object.values(this.contracts).map((c) => c.address);

    try {
      const logs = await provider.getLogs({
        address: addresses,
        fromBlock,
        toBlock,
      });

      for (const logEntry of logs) {
        this.processLog(logEntry);
      }

      this.lastBlock = toBlock;

      if (logs.length > 0) {
        log("DEBUG", this.chainName, `Processed ${logs.length} log(s) in blocks ${fromBlock}-${toBlock}`);
      }
    } catch (err) {
      log("ERROR", this.chainName, `getLogs failed for blocks ${fromBlock}-${toBlock}: ${err.message}`);
      // Don't advance lastBlock on error — will retry
      if (err.message.includes("limit") || err.message.includes("range")) {
        // Try smaller range next time
        const smallerTo = Math.min(currentBlock, fromBlock + 499);
        try {
          const logs = await provider.getLogs({
            address: addresses,
            fromBlock,
            toBlock: smallerTo,
          });
          for (const logEntry of logs) {
            this.processLog(logEntry);
          }
          this.lastBlock = smallerTo;
        } catch (err2) {
          log("ERROR", this.chainName, `Smaller range also failed: ${err2.message}`);
          await this.resilientProvider.reconnect();
        }
      }
    }
  }

  processLog(logEntry) {
    const topic0 = logEntry.topics[0];
    const mapping = this.topicToEvent[topic0];
    if (!mapping) return; // Unknown event, skip

    const { contractName, eventName, iface } = mapping;

    let parsed;
    try {
      parsed = iface.parseLog({ topics: logEntry.topics, data: logEntry.data });
    } catch {
      log("WARN", this.chainName, `Failed to parse log for ${contractName}.${eventName}`);
      return;
    }

    stats.record(this.chainName, `${contractName}.${eventName}`);

    this.onEvent(this.chainName, contractName, eventName, logEntry, parsed);
  }

  async startPolling() {
    this.running = true;
    while (this.running) {
      try {
        await this.poll();
      } catch (err) {
        log("ERROR", this.chainName, `Poll loop error: ${err.message}`);
        try {
          await this.resilientProvider.reconnect();
        } catch (reconnErr) {
          log("CRITICAL", this.chainName, `Reconnect failed: ${reconnErr.message}`);
          await sleep(30000); // Wait 30s before retrying
        }
      }
      await sleep(CONFIG.pollIntervalMs);
    }
  }

  stop() {
    this.running = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BRIDGE RELAY — Picks up MessageSent on one chain, calls relayMessage on other
// ═══════════════════════════════════════════════════════════════════════════════

class BridgeRelay {
  constructor(baseProvider, avaxProvider, wallet) {
    this.baseProvider = baseProvider;
    this.avaxProvider = avaxProvider;
    this.wallet = wallet;
    this.pendingRelays = [];
    this.processing = false;

    // Contracts for relay
    this.baseBridge = null;
    this.avaxBridge = null;
  }

  async init() {
    const baseWallet = this.wallet.connect(this.baseProvider.getProvider());
    const avaxWallet = this.wallet.connect(this.avaxProvider.getProvider());

    this.baseBridge = new ethers.Contract(
      BASE_CONTRACTS.VaultfireTeleporterBridge,
      ABIS.VaultfireTeleporterBridge,
      baseWallet
    );
    this.avaxBridge = new ethers.Contract(
      AVAX_CONTRACTS.VaultfireTeleporterBridge,
      ABIS.VaultfireTeleporterBridge,
      avaxWallet
    );

    // Verify relayer authorization
    const isBaseRelayer = await this.baseBridge.authorizedRelayers(this.wallet.address);
    const isAvaxRelayer = await this.avaxBridge.authorizedRelayers(this.wallet.address);
    log("INFO", "BRIDGE", `Relayer status — Base: ${isBaseRelayer}, Avalanche: ${isAvaxRelayer}`);

    if (!isBaseRelayer || !isAvaxRelayer) {
      log("WARN", "BRIDGE", "Wallet may not be authorized as relayer on both chains. Bridge relay may fail.");
    }
  }

  /**
   * Called when a MessageSent event is detected on either chain.
   * We need to reconstruct the encoded BridgeMessage and relay it to the other chain.
   */
  async onMessageSent(sourceChain, logEntry, parsed) {
    const nonce = parsed.args[0];
    const messageType = parsed.args[1];
    const messageHash = parsed.args[2];
    const destinationChainId = parsed.args[3];

    log("INFO", "BRIDGE", `MessageSent detected on ${sourceChain}: nonce=${nonce}, type=${messageType}, dest=${destinationChainId}`);

    // Determine target bridge
    const targetChain = sourceChain === "base" ? "avalanche" : "base";
    const targetBridge = sourceChain === "base" ? this.avaxBridge : this.baseBridge;
    const targetChainId = sourceChain === "base" ? CONFIG.avalanche.chainId : CONFIG.base.chainId;

    // Check if already processed
    try {
      const alreadyProcessed = await targetBridge.processedMessages(messageHash);
      if (alreadyProcessed) {
        log("INFO", "BRIDGE", `Message ${shortenHash(messageHash)} already processed on ${targetChain}, skipping`);
        return;
      }
    } catch (err) {
      log("WARN", "BRIDGE", `Could not check processedMessages: ${err.message}`);
    }

    // We need the full transaction data to extract the encoded message
    // The MessageSent event is emitted in _sendMessage, and the encoded message
    // is the ABI-encoded BridgeMessage struct. We reconstruct it from the tx input.
    try {
      const provider = sourceChain === "base"
        ? this.baseProvider.getProvider()
        : this.avaxProvider.getProvider();

      const tx = await provider.getTransaction(logEntry.transactionHash);
      if (!tx) {
        log("ERROR", "BRIDGE", `Could not fetch tx ${logEntry.transactionHash}`);
        return;
      }

      // The bridge contract encodes the BridgeMessage internally and emits the event.
      // We need to reconstruct the BridgeMessage from the transaction receipt logs.
      // The encoded message is what gets passed to relayMessage().
      // Since the contract constructs it internally, we need to re-encode it.
      // We can get the data from the transaction receipt's internal state,
      // but the simplest approach is to reconstruct the BridgeMessage struct.

      // Get block timestamp for the source chain
      const block = await provider.getBlock(logEntry.blockNumber);
      const timestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);

      // Decode the original function call to extract the payload
      const bridgeIface = new ethers.Interface(ABIS.VaultfireTeleporterBridge);
      let payload;
      try {
        const decoded = bridgeIface.parseTransaction({ data: tx.data, value: tx.value });
        if (!decoded) throw new Error("Could not decode tx");

        // The send* functions encode the payload internally.
        // We need to re-encode the BridgeMessage struct as the contract does.
        const funcName = decoded.name;
        log("DEBUG", "BRIDGE", `Source tx called: ${funcName}`);

        // Re-encode the payload based on the function that was called
        payload = this._reconstructPayload(funcName, decoded.args, messageType);
      } catch (decodeErr) {
        log("WARN", "BRIDGE", `Could not decode source tx: ${decodeErr.message}. Attempting receipt-based reconstruction.`);
        // Fallback: skip this message
        return;
      }

      if (!payload) {
        log("WARN", "BRIDGE", "Could not reconstruct payload, skipping relay");
        return;
      }

      // Encode the full BridgeMessage struct
      const sourceChainId = sourceChain === "base" ? CONFIG.base.chainId : CONFIG.avalanche.chainId;
      const bridgeMessageEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(uint8 messageType, uint256 sourceChainId, uint256 nonce, uint256 timestamp, address sender, bytes payload)"],
        [{
          messageType: Number(messageType),
          sourceChainId: sourceChainId,
          nonce: Number(nonce),
          timestamp: timestamp,
          sender: tx.from,
          payload: payload,
        }]
      );

      // Queue the relay
      this.pendingRelays.push({
        targetChain,
        targetBridge,
        encodedMessage: bridgeMessageEncoded,
        messageHash,
        nonce: Number(nonce),
        messageType: Number(messageType),
      });

      log("INFO", "BRIDGE", `Queued relay: nonce=${nonce} from ${sourceChain} → ${targetChain}`);

      // Process queue
      this._processQueue();

    } catch (err) {
      log("ERROR", "BRIDGE", `Failed to prepare relay for nonce=${nonce}: ${err.message}`);
      stats.bridgeRelayErrors++;
    }
  }

  _reconstructPayload(funcName, args, messageType) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const mt = Number(messageType);

    switch (funcName) {
      case "sendAgentRegistration":
        // sendAgentRegistration(address, string, string, bytes32, uint256)
        return coder.encode(
          ["tuple(address agentAddress, string agentURI, string agentType, bytes32 capabilitiesHash, uint256 registeredAt)"],
          [{ agentAddress: args[0], agentURI: args[1], agentType: args[2], capabilitiesHash: args[3], registeredAt: args[4] }]
        );

      case "sendPartnershipBond":
        // sendPartnershipBond(uint256, address, address, string, uint256, bool)
        return coder.encode(
          ["tuple(uint256 bondId, address human, address aiAgent, string purpose, uint256 createdAt, bool active)"],
          [{ bondId: args[0], human: args[1], aiAgent: args[2], purpose: args[3], createdAt: args[4], active: args[5] }]
        );

      case "sendAccountabilityBond":
        // sendAccountabilityBond(uint256, address, string, uint256, uint256, uint256, bool)
        return coder.encode(
          ["tuple(uint256 bondId, address aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 createdAt, bool active)"],
          [{ bondId: args[0], aiCompany: args[1], companyName: args[2], quarterlyRevenue: args[3], stakeAmount: args[4], createdAt: args[5], active: args[6] }]
        );

      case "sendReputation":
        // sendReputation(address, uint256, uint256, uint256, uint256)
        return coder.encode(
          ["tuple(address agentAddress, uint256 totalFeedbacks, uint256 averageRating, uint256 verifiedFeedbacks, uint256 lastUpdated)"],
          [{ agentAddress: args[0], totalFeedbacks: args[1], averageRating: args[2], verifiedFeedbacks: args[3], lastUpdated: args[4] }]
        );

      case "sendValidation":
        // sendValidation(uint256, address, uint8, uint256, uint256, uint256)
        return coder.encode(
          ["tuple(uint256 requestId, address agentAddress, uint8 status, uint256 approvalsCount, uint256 rejectionsCount, uint256 timestamp)"],
          [{ requestId: args[0], agentAddress: args[1], status: args[2], approvalsCount: args[3], rejectionsCount: args[4], timestamp: args[5] }]
        );

      default:
        log("WARN", "BRIDGE", `Unknown bridge function: ${funcName}`);
        return null;
    }
  }

  async _processQueue() {
    if (this.processing || this.pendingRelays.length === 0) return;
    this.processing = true;

    while (this.pendingRelays.length > 0) {
      const relay = this.pendingRelays.shift();
      try {
        log("INFO", "BRIDGE", `Relaying nonce=${relay.nonce} to ${relay.targetChain}...`);

        const gasEstimate = await relay.targetBridge.relayMessage.estimateGas(relay.encodedMessage);
        const tx = await relay.targetBridge.relayMessage(relay.encodedMessage, {
          gasLimit: gasEstimate * 130n / 100n, // 30% buffer
        });

        log("INFO", "BRIDGE", `Relay tx sent: ${shortenHash(tx.hash)}`);

        const receipt = await tx.wait(1);
        if (receipt.status === 1) {
          log("INFO", "BRIDGE", `Relay SUCCESS: nonce=${relay.nonce} on ${relay.targetChain}, tx=${shortenHash(tx.hash)}`);
          stats.bridgeMessagesRelayed++;
        } else {
          log("ERROR", "BRIDGE", `Relay REVERTED: nonce=${relay.nonce} on ${relay.targetChain}`);
          stats.bridgeRelayErrors++;
        }
      } catch (err) {
        log("ERROR", "BRIDGE", `Relay FAILED for nonce=${relay.nonce}: ${err.message}`);
        stats.bridgeRelayErrors++;

        // If it's a nonce/gas issue, don't retry immediately
        if (err.message.includes("already processed") || err.message.includes("nonce")) {
          log("INFO", "BRIDGE", "Message likely already processed, moving on");
        } else {
          // Re-queue with a delay for transient errors (but only once)
          if (!relay.retried) {
            relay.retried = true;
            this.pendingRelays.push(relay);
            await sleep(5000);
          }
        }
      }
    }

    this.processing = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SELF-REGISTRATION — Register the sentinel as an AI agent on Vaultfire
// ═══════════════════════════════════════════════════════════════════════════════

class SelfRegistration {
  constructor(baseProvider, wallet) {
    this.baseProvider = baseProvider;
    this.wallet = wallet;
  }

  async register() {
    const provider = this.baseProvider.getProvider();
    const signer = this.wallet.connect(provider);

    // ── Check if already registered ─────────────────────────────────────────
    const identityRegistry = new ethers.Contract(
      BASE_CONTRACTS.ERC8004IdentityRegistry,
      ABIS.ERC8004IdentityRegistry,
      signer
    );

    try {
      const isActive = await identityRegistry.isAgentActive(this.wallet.address);
      if (isActive) {
        log("INFO", "REGISTER", `Agent ${shortenAddr(this.wallet.address)} already registered and active`);
        return true;
      }
    } catch (err) {
      log("DEBUG", "REGISTER", `isAgentActive check: ${err.message}`);
    }

    // ── Register as AI agent ────────────────────────────────────────────────
    log("INFO", "REGISTER", "Registering sentinel as AI agent on ERC8004IdentityRegistry...");

    const capabilitiesHash = ethers.keccak256(
      ethers.toUtf8Bytes(CONFIG.capabilities.join(","))
    );

    try {
      const tx = await identityRegistry.registerAgent(
        CONFIG.agentURI,
        CONFIG.agentType,
        capabilitiesHash,
        { gasLimit: 500000 }
      );
      log("INFO", "REGISTER", `Registration tx sent: ${shortenHash(tx.hash)}`);
      const receipt = await tx.wait(1);
      if (receipt.status === 1) {
        log("INFO", "REGISTER", `Agent registered successfully! tx=${shortenHash(tx.hash)}`);
      } else {
        log("ERROR", "REGISTER", "Registration tx reverted");
        return false;
      }
    } catch (err) {
      if (err.message.includes("already registered") || err.message.includes("Agent already exists")) {
        log("INFO", "REGISTER", "Agent already registered (caught from revert)");
        return true;
      }
      log("ERROR", "REGISTER", `Registration failed: ${err.message}`);
      return false;
    }

    // ── Create partnership bond with deployer ───────────────────────────────
    log("INFO", "REGISTER", "Creating partnership bond with deployer wallet...");

    const partnershipBonds = new ethers.Contract(
      BASE_CONTRACTS.AIPartnershipBondsV2,
      ABIS.AIPartnershipBondsV2,
      signer
    );

    try {
      // Check if bond already exists by looking at existing bonds
      const nextBondId = await partnershipBonds.nextBondId();
      let bondExists = false;

      for (let i = 1; i < Number(nextBondId); i++) {
        try {
          const bond = await partnershipBonds.getBond(i);
          if (
            bond.human.toLowerCase() === CONFIG.deployerAddress.toLowerCase() &&
            bond.aiAgent.toLowerCase() === this.wallet.address.toLowerCase() &&
            bond.active
          ) {
            log("INFO", "REGISTER", `Partnership bond already exists: bondId=${i}`);
            bondExists = true;
            break;
          }
        } catch {
          // Bond may not exist at this index
        }
      }

      if (!bondExists) {
        // createBond is called by the human (deployer) with the AI agent address
        // Since our wallet IS the deployer, we call it directly
        const bondTx = await partnershipBonds.createBond(
          this.wallet.address,  // aiAgent = self (deployer bonds with self as AI)
          "sentinel-guardian",
          { value: 0, gasLimit: 500000 }
        );
        log("INFO", "REGISTER", `Bond creation tx sent: ${shortenHash(bondTx.hash)}`);
        const bondReceipt = await bondTx.wait(1);
        if (bondReceipt.status === 1) {
          log("INFO", "REGISTER", `Partnership bond created! tx=${shortenHash(bondTx.hash)}`);
        } else {
          log("WARN", "REGISTER", "Bond creation tx reverted");
        }
      }
    } catch (err) {
      log("WARN", "REGISTER", `Bond creation skipped: ${err.message}`);
    }

    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENT FORMATTER — Human-readable event descriptions
// ═══════════════════════════════════════════════════════════════════════════════

function formatEvent(chainName, contractName, eventName, parsed) {
  const chain = chainName === "base" ? "\x1b[34mBase\x1b[0m" : "\x1b[31mAvax\x1b[0m";
  const args = parsed.args;

  const formatters = {
    // ── Identity ──────────────────────────────────────────────────────────
    "ERC8004IdentityRegistry.AgentRegistered": () =>
      `Agent registered: ${shortenAddr(args[0])} type="${args[2]}"`,
    "ERC8004IdentityRegistry.AgentUpdated": () =>
      `Agent updated: ${shortenAddr(args[0])}`,
    "ERC8004IdentityRegistry.AgentDeactivated": () =>
      `Agent deactivated: ${shortenAddr(args[0])}`,

    // ── Partnership Bonds ─────────────────────────────────────────────────
    "AIPartnershipBondsV2.BondCreated": () =>
      `Partnership bond #${args[0]}: human=${shortenAddr(args[1])} ai=${shortenAddr(args[2])} type="${args[3]}" stake=${formatEther(args[4])}`,
    "AIPartnershipBondsV2.PartnershipMetricsSubmitted": () =>
      `Metrics submitted for bond #${args[0]}`,
    "AIPartnershipBondsV2.HumanVerificationSubmitted": () =>
      `Human verification for bond #${args[0]}: partnership=${args[2]} growth=${args[3]} autonomy=${args[4]}`,
    "AIPartnershipBondsV2.BondDistributed": () =>
      `Bond #${args[0]} distributed: human=${formatEther(args[1])} ai=${formatEther(args[2])}`,
    "AIPartnershipBondsV2.AIDominationPenalty": () =>
      `AI DOMINATION PENALTY on bond #${args[0]}: ${args[1]}`,

    // ── Accountability Bonds ──────────────────────────────────────────────
    "AIAccountabilityBondsV2.BondCreated": () =>
      `Accountability bond #${args[0]}: company="${args[2]}" stake=${formatEther(args[4])}`,
    "AIAccountabilityBondsV2.MetricsSubmitted": () =>
      `Accountability metrics for bond #${args[0]}: flourishing=${args[2]}`,
    "AIAccountabilityBondsV2.MetricsChallenged": () =>
      `CHALLENGE on bond #${args[0]} by ${shortenAddr(args[1])}: ${args[2]}`,

    // ── Reputation ────────────────────────────────────────────────────────
    "ERC8004ReputationRegistry.FeedbackSubmitted": () =>
      `Feedback #${args[0]}: reviewer=${shortenAddr(args[1])} agent=${shortenAddr(args[2])} rating=${args[3]}`,
    "ERC8004ReputationRegistry.ReputationUpdated": () =>
      `Reputation updated: ${shortenAddr(args[0])} avg=${args[1]} total=${args[2]}`,

    // ── Validation ────────────────────────────────────────────────────────
    "ERC8004ValidationRegistry.ValidationRequested": () =>
      `Validation requested #${args[0]}: agent=${shortenAddr(args[1])} by ${shortenAddr(args[2])}`,
    "ERC8004ValidationRegistry.ValidationCompleted": () =>
      `Validation #${args[0]} completed: status=${args[1]}`,
    "ERC8004ValidationRegistry.ValidatorStaked": () =>
      `Validator ${shortenAddr(args[0])} staked ${formatEther(args[1])}`,

    // ── Governance ────────────────────────────────────────────────────────
    "MultisigGovernance.TransactionProposed": () =>
      `Governance proposal #${args[0]} by ${shortenAddr(args[1])} → ${shortenAddr(args[2])}`,
    "MultisigGovernance.TransactionConfirmed": () =>
      `Governance #${args[0]} confirmed by ${shortenAddr(args[1])}`,
    "MultisigGovernance.TransactionExecuted": () =>
      `Governance #${args[0]} EXECUTED by ${shortenAddr(args[1])}`,

    // ── Oracle ────────────────────────────────────────────────────────────
    "FlourishingMetricsOracle.RoundStarted": () =>
      `Oracle round #${args[0]} started: metric=${shortenHash(args[1])}`,
    "FlourishingMetricsOracle.ConsensusReached": () =>
      `Oracle consensus on round #${args[0]}: value=${args[2]} submissions=${args[3]}`,

    // ── Attestation ───────────────────────────────────────────────────────
    "ProductionBeliefAttestationVerifier.AttestationVerified": () =>
      `Attestation verified: belief=${shortenHash(args[0])} attester=${shortenAddr(args[1])} score=${args[4]}`,
    "BeliefAttestationVerifier.ProofVerified": () =>
      `Proof verified: belief=${shortenHash(args[0])} prover=${shortenAddr(args[1])}`,

    // ── Privacy & Mission ─────────────────────────────────────────────────
    "PrivacyGuarantees.ConsentGranted": () =>
      `Consent granted: ${shortenAddr(args[0])} purpose=${shortenHash(args[1])}`,
    "PrivacyGuarantees.ConsentRevoked": () =>
      `Consent REVOKED: ${shortenAddr(args[0])} purpose=${shortenHash(args[1])}`,
    "PrivacyGuarantees.DataDeletionRequested": () =>
      `DATA DELETION requested: ${shortenAddr(args[0])}`,
    "MissionEnforcement.MissionViolationReported": () =>
      `MISSION VIOLATION reported on ${shortenAddr(args[0])} by ${shortenAddr(args[1])}`,
    "MissionEnforcement.MissionViolationDetected": () =>
      `MISSION VIOLATION DETECTED on ${shortenAddr(args[0])}`,
    "AntiSurveillance.SurveillanceAttemptBlocked": () =>
      `SURVEILLANCE BLOCKED: attacker=${shortenAddr(args[0])}`,
    "AntiSurveillance.ModuleBannedForSurveillance": () =>
      `Module BANNED for surveillance: ${shortenAddr(args[0])}`,

    // ── Bridge ────────────────────────────────────────────────────────────
    "VaultfireTeleporterBridge.MessageSent": () =>
      `Bridge message sent: nonce=${args[0]} type=${args[1]} → chain ${args[3]}`,
    "VaultfireTeleporterBridge.MessageReceived": () =>
      `Bridge message received: nonce=${args[0]} type=${args[1]} from chain ${args[3]}`,
    "VaultfireTeleporterBridge.AgentSynced": () =>
      `Agent synced cross-chain: ${shortenAddr(args[0])} type="${args[1]}"`,
    "VaultfireTeleporterBridge.RelayerAdded": () =>
      `Bridge relayer added: ${shortenAddr(args[0])}`,

    // ── Adapter ───────────────────────────────────────────────────────────
    "VaultfireERC8004Adapter.AgentAutoRegistered": () =>
      `Agent auto-registered via adapter: ${shortenAddr(args[0])} type="${args[1]}"`,
  };

  const key = `${contractName}.${eventName}`;
  const formatter = formatters[key];
  return formatter ? formatter() : `${contractName}.${eventName}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN — Sentinel orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
\x1b[31m╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🔥  V A U L T F I R E   S E N T I N E L   A G E N T  🔥       ║
║                                                                   ║
║   Morals over metrics. Privacy over surveillance.                 ║
║   Freedom over control.                                           ║
║                                                                   ║
║   Monitoring 14 contracts across Base + Avalanche                 ║
║   Autonomous bridge relay • Self-registered AI agent              ║
║                                                                   ║
║   Avalanche Build Games 2026                                      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝\x1b[0m
`);

  stats.startedAt = new Date();
  log("INFO", "SENTINEL", `Starting at ${stats.startedAt.toISOString()}`);

  // ── Initialize wallet ───────────────────────────────────────────────────
  const wallet = new ethers.Wallet(CONFIG.deployerKey);
  log("INFO", "SENTINEL", `Operator wallet: ${wallet.address}`);

  // ── Connect to chains ───────────────────────────────────────────────────
  const baseProvider = new ResilientProvider(CONFIG.base);
  const avaxProvider = new ResilientProvider(CONFIG.avalanche);

  await baseProvider.connect();
  await avaxProvider.connect();

  // ── Initialize bridge relay ─────────────────────────────────────────────
  const bridgeRelay = new BridgeRelay(baseProvider, avaxProvider, wallet);
  await bridgeRelay.init();

  // ── Self-register as AI agent ───────────────────────────────────────────
  const registration = new SelfRegistration(baseProvider, wallet);
  try {
    await registration.register();
  } catch (err) {
    log("WARN", "SENTINEL", `Self-registration encountered an issue: ${err.message}`);
    log("INFO", "SENTINEL", "Continuing with monitoring — registration can be retried later");
  }

  // ── Event callback ──────────────────────────────────────────────────────
  function onEvent(chainName, contractName, eventName, logEntry, parsed) {
    const description = formatEvent(chainName, contractName, eventName, parsed);
    const chain = chainName === "base" ? "\x1b[34m[Base]\x1b[0m" : "\x1b[31m[Avax]\x1b[0m";
    log("INFO", "EVENT", `${chain} ${description}`);

    // ── Bridge relay trigger ──────────────────────────────────────────────
    if (contractName === "VaultfireTeleporterBridge" && eventName === "MessageSent") {
      bridgeRelay.onMessageSent(chainName, logEntry, parsed).catch((err) => {
        log("ERROR", "BRIDGE", `Relay trigger error: ${err.message}`);
      });
    }

    // ── Alert on critical events ──────────────────────────────────────────
    if (eventName === "MissionViolationDetected" || eventName === "MissionViolationReported") {
      log("CRITICAL", "ALERT", `Mission violation on ${chainName}! Contract: ${contractName}`);
    }
    if (eventName === "SurveillanceAttemptBlocked") {
      log("CRITICAL", "ALERT", `Surveillance attempt blocked on ${chainName}!`);
    }
    if (eventName === "AIDominationPenalty") {
      log("CRITICAL", "ALERT", `AI domination penalty triggered on ${chainName}!`);
    }
    if (eventName === "DataDeletionRequested") {
      log("WARN", "PRIVACY", `Data deletion requested on ${chainName} — respecting user sovereignty`);
    }
  }

  // ── Build contract maps for monitors ────────────────────────────────────
  const baseContractMap = {};
  for (const [name, address] of Object.entries(BASE_CONTRACTS)) {
    if (ABIS[name]) {
      baseContractMap[name] = { address, abi: ABIS[name] };
    }
  }

  const avaxContractMap = {};
  for (const [name, address] of Object.entries(AVAX_CONTRACTS)) {
    if (ABIS[name]) {
      avaxContractMap[name] = { address, abi: ABIS[name] };
    }
  }

  // ── Start monitors ─────────────────────────────────────────────────────
  const baseMonitor = new ChainMonitor("base", baseProvider, baseContractMap, onEvent);
  const avaxMonitor = new ChainMonitor("avalanche", avaxProvider, avaxContractMap, onEvent);

  await baseMonitor.init();
  await avaxMonitor.init();

  log("INFO", "SENTINEL", `Monitoring ${Object.keys(baseContractMap).length} contracts on Base`);
  log("INFO", "SENTINEL", `Monitoring ${Object.keys(avaxContractMap).length} contracts on Avalanche`);
  log("INFO", "SENTINEL", `Poll interval: ${CONFIG.pollIntervalMs}ms`);
  log("INFO", "SENTINEL", "Sentinel is LIVE. Watching for events...\n");

  // Start polling (non-blocking)
  const basePolling = baseMonitor.startPolling();
  const avaxPolling = avaxMonitor.startPolling();

  // ── Health check loop ───────────────────────────────────────────────────
  const healthCheck = setInterval(() => {
    const summary = stats.summary();
    log("INFO", "HEALTH", "─── Sentinel Health Check ───");
    log("INFO", "HEALTH", `Uptime: ${summary.uptime}`);
    log("INFO", "HEALTH", `Events processed: ${summary.eventsProcessed} (Base: ${summary.eventsByChain.base}, Avax: ${summary.eventsByChain.avalanche})`);
    log("INFO", "HEALTH", `Bridge relays: ${summary.bridgeMessagesRelayed} success, ${summary.bridgeRelayErrors} errors`);
    log("INFO", "HEALTH", `Reconnections: ${summary.reconnections}`);
    if (summary.topEvents.length > 0) {
      log("INFO", "HEALTH", `Top events: ${summary.topEvents.join(", ")}`);
    }
    log("INFO", "HEALTH", `Last event: ${summary.lastEventAt || "none yet"}`);
    log("INFO", "HEALTH", "────────────────────────────");
  }, CONFIG.healthCheckIntervalMs);

  // ── Graceful shutdown ───────────────────────────────────────────────────
  async function shutdown(signal) {
    log("INFO", "SENTINEL", `\nReceived ${signal}. Shutting down gracefully...`);
    clearInterval(healthCheck);
    baseMonitor.stop();
    avaxMonitor.stop();

    const summary = stats.summary();
    log("INFO", "SENTINEL", "─── Final Statistics ───");
    log("INFO", "SENTINEL", `Uptime: ${summary.uptime}`);
    log("INFO", "SENTINEL", `Total events: ${summary.eventsProcessed}`);
    log("INFO", "SENTINEL", `Bridge relays: ${summary.bridgeMessagesRelayed}`);
    log("INFO", "SENTINEL", `Reconnections: ${summary.reconnections}`);
    log("INFO", "SENTINEL", "Sentinel stopped. Vaultfire values endure. 🔥");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Handle uncaught errors gracefully
  process.on("uncaughtException", (err) => {
    log("CRITICAL", "SENTINEL", `Uncaught exception: ${err.message}`);
    log("ERROR", "SENTINEL", err.stack);
    // Don't exit — keep running
  });

  process.on("unhandledRejection", (reason) => {
    log("CRITICAL", "SENTINEL", `Unhandled rejection: ${reason}`);
    // Don't exit — keep running
  });

  // Keep process alive
  await Promise.all([basePolling, avaxPolling]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

main().catch((err) => {
  log("CRITICAL", "SENTINEL", `Fatal error: ${err.message}`);
  log("ERROR", "SENTINEL", err.stack);
  process.exit(1);
});
