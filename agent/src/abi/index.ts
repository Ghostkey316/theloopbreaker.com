/**
 * Vaultfire Agent — Contract ABI Definitions
 *
 * Minimal ABI fragments for the functions the agent actually calls.
 * Extracted from the compiled Vaultfire contract artifacts.
 */

// ---------------------------------------------------------------------------
// ERC8004IdentityRegistry
// ---------------------------------------------------------------------------
export const ERC8004IdentityRegistryABI = [
  // Write
  'function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash) external',
  'function updateAgentURI(string newAgentURI) external',
  'function deactivateAgent() external',
  // Read
  'function getAgent(address agentAddress) external view returns (string agentURI, bool active, string agentType, uint256 registeredAt)',
  'function isAgentActive(address agentAddress) external view returns (bool)',
  'function getTotalAgents() external view returns (uint256 count)',
  'function agents(address) external view returns (address agentAddress, string agentURI, uint256 registeredAt, bool active, string agentType, bytes32 capabilitiesHash)',
  'function registeredAgents(uint256) external view returns (address)',
  'function discoverAgentsByCapability(bytes32 capabilitiesHash) external view returns (address[])',
  // Events
  'event AgentRegistered(address indexed agentAddress, string agentURI, string agentType, bytes32 capabilitiesHash, uint256 timestamp)',
  'event AgentUpdated(address indexed agentAddress, string newAgentURI, uint256 timestamp)',
  'event AgentDeactivated(address indexed agentAddress, uint256 timestamp)',
] as const;

// ---------------------------------------------------------------------------
// AIPartnershipBondsV2
// ---------------------------------------------------------------------------
export const AIPartnershipBondsV2ABI = [
  // Write
  'function createBond(address aiAgent, string partnershipType) external payable returns (uint256)',
  'function submitPartnershipMetrics(uint256 bondId, uint256 humanGrowth, uint256 humanAutonomy, uint256 humanDignity, uint256 tasksMastered, uint256 creativityScore, string progressNotes) external',
  'function submitHumanVerification(uint256 bondId, bool confirmsPartnership, bool confirmsGrowth, bool confirmsAutonomy, string relationship, string notes) external',
  'function requestDistribution(uint256 bondId) external',
  'function distributeBond(uint256 bondId) external',
  // Read
  'function getBond(uint256 bondId) external view returns (tuple(uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))',
  'function getBondsByParticipant(address participant) external view returns (uint256[])',
  'function getBondsByParticipantCount(address participant) external view returns (uint256 count)',
  'function getBondMetricsCount(uint256 bondId) external view returns (uint256)',
  'function getMetrics(uint256 bondId, uint256 offset, uint256 limit) external view returns (tuple(uint256 timestamp, address submitter, uint256 humanGrowth, uint256 humanAutonomy, uint256 humanDignity, uint256 tasksMastered, uint256 creativityScore, string progressNotes)[])',
  'function getProtocolHealth() external view returns (bool isHealthy, bool yieldPoolOK, bool reserveRatioOK, uint256 currentRatio)',
  'function getYieldPoolBalance() external view returns (uint256 balance)',
  'function getReserveRatio() external view returns (uint256 ratio)',
  'function nextBondId() external view returns (uint256)',
  'function totalActiveBondValue() external view returns (uint256)',
  'function partnershipFund() external view returns (uint256)',
  'function partnershipQualityScore(uint256 bondId) external view returns (uint256)',
  'function calculateBondValue(uint256 bondId) external view returns (uint256)',
  'function calculateAppreciation(uint256 bondId) external view returns (int256)',
  'function loyaltyMultiplier(uint256 bondId) external view returns (uint256)',
  'function isPaused() external view returns (bool)',
  // Events
  'event BondCreated(uint256 indexed bondId, address indexed human, address indexed aiAgent, string partnershipType, uint256 stakeAmount, uint256 timestamp)',
  'event PartnershipMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp)',
] as const;

// ---------------------------------------------------------------------------
// FlourishingMetricsOracle
// ---------------------------------------------------------------------------
export const FlourishingMetricsOracleABI = [
  // Write
  'function startRound(bytes32 metricId) external returns (uint256)',
  'function submitMetric(uint256 roundId, uint256 value) external',
  'function finalizeRound(uint256 roundId) external',
  // Read
  'function getLatestValue(bytes32 metricId) external view returns (uint256 value, uint256 roundId)',
  'function getRound(uint256 roundId) external view returns (tuple(uint256 roundId, bytes32 metricId, uint256 startTime, uint256 deadline, uint256 consensusValue, bool finalized, uint256 submissionCount))',
  'function getOracles() external view returns (address[])',
  'function isOracle(address) external view returns (bool)',
  'function oracleCount() external view returns (uint256)',
  'function nextRoundId() external view returns (uint256)',
  'function hasSubmitted(uint256, address) external view returns (bool)',
  'function owner() external view returns (address)',
  // Events
  'event MetricSubmitted(uint256 indexed roundId, address indexed oracle, uint256 value)',
  'event RoundStarted(uint256 indexed roundId, bytes32 indexed metricId, uint256 deadline)',
  'event ConsensusReached(uint256 indexed roundId, bytes32 indexed metricId, uint256 consensusValue, uint256 submissionCount)',
] as const;

// ---------------------------------------------------------------------------
// AIAccountabilityBondsV2
// ---------------------------------------------------------------------------
export const AIAccountabilityBondsV2ABI = [
  'function getBond(uint256 bondId) external view returns (tuple(uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))',
  'function nextBondId() external view returns (uint256)',
] as const;

// ---------------------------------------------------------------------------
// ERC8004ReputationRegistry
// ---------------------------------------------------------------------------
export const ERC8004ReputationRegistryABI = [
  'function getReputation(address agent) external view returns (uint256 score, uint256 totalReviews)',
] as const;

// ---------------------------------------------------------------------------
// ERC8004ValidationRegistry
// ---------------------------------------------------------------------------
export const ERC8004ValidationRegistryABI = [
  'function isValidated(address agent) external view returns (bool)',
] as const;
