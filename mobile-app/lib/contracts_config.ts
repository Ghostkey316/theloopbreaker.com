/**
 * Vaultfire Protocol — Contract addresses and ABIs for Base mainnet (Chain ID 8453)
 * Design: "Obsidian Forge" — Dark luxury fintech with warm-to-purple accents
 */

export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_URL = "https://mainnet.base.org";
export const BASESCAN_URL = "https://basescan.org";

export const AVAX_CHAIN_ID = 43114;
export const AVAX_RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
export const SNOWTRACE_URL = "https://snowscan.xyz";

export const CONTRACTS = {
  PrivacyGuarantees: "0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55",
  MissionEnforcement: "0x38165D2D7a8584985CCa5640f4b32b1f3347CC83",
  AntiSurveillance: "0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C",
  ERC8004IdentityRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
  BeliefAttestationVerifier: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
  ERC8004ReputationRegistry: "0x544B575431ECD927bA83E85008446fA1e100204a",
  ERC8004ValidationRegistry: "0x501fE0f960c1e061C4d295Af241f9F1512775556",
  AIPartnershipBondsV2: "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1",
  AIAccountabilityBondsV2: "0xDfc66395A4742b5168712a04942C90B99394aEEb",
  VaultfireERC8004Adapter: "0x5470d8189849675C043fFA7fc451e5F2f4e5532c",
  MultisigGovernance: "0xea0A6750642AA294658dC9f1eDf36b95D21e7B22",
  FlourishingMetricsOracle: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1",
  ProductionBeliefAttestationVerifier: "0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B",
  VaultfireTeleporterBridge: "0xFe122605364f428570c4C0EB2CCAEBb68dD22d05",
} as const;

/** Avalanche C-Chain contract addresses (chain ID 43114) */
export const AVAX_CONTRACTS = {
  MissionEnforcement: "0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709",
  AntiSurveillance: "0xaCB59e0f0eA47B25b24390B71b877928E5842630",
  ERC8004IdentityRegistry: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5",
  AIPartnershipBondsV2: "0x37679B1dCfabE6eA6b8408626815A1426bE2D717",
  FlourishingMetricsOracle: "0x83b2D1a8e383c4239dE66b6614176636618c1c0A",
  AIAccountabilityBondsV2: "0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192",
  ProductionBeliefAttestationVerifier: "0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1",
  VaultfireTeleporterBridge: "0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf",
  PrivacyGuarantees: "0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C",
  BeliefAttestationVerifier: "0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55",
  ERC8004ReputationRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
  ERC8004ValidationRegistry: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
  VaultfireERC8004Adapter: "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1",
  MultisigGovernance: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1",
} as const;

export function snowtraceAddress(addr: string) {
  return `${SNOWTRACE_URL}/address/${addr}`;
}

export type ContractName = keyof typeof CONTRACTS;

export function basescanAddress(addr: string) {
  return `${BASESCAN_URL}/address/${addr}`;
}

export function basescanTx(hash: string) {
  return `${BASESCAN_URL}/tx/${hash}`;
}

export function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ============ ABIs (read-only functions we need) ============

export const ERC8004IdentityRegistryABI = [
  "function getTotalAgents() view returns (uint256)",
  "function registeredAgents(uint256 index) view returns (address)",
  "function agents(address) view returns (address agentAddress, string agentURI, uint256 registeredAt, bool active, string agentType, bytes32 capabilitiesHash)",
  "function isAgentActive(address) view returns (bool)",
  "function getAgent(address) view returns (address agentAddress, string agentURI, uint256 registeredAt, bool active, string agentType, bytes32 capabilitiesHash)",
  // Write functions
  "function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash)",
];

export const AIPartnershipBondsV2ABI = [
  "function nextBondId() view returns (uint256)",
  "function bonds(uint256) view returns (uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active)",
  "function getBond(uint256) view returns (tuple(uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function yieldPool() view returns (uint256)",
  "function totalActiveBondValue() view returns (uint256)",
  // Write functions
  "function createBond(address aiAgent, string partnershipType) payable",
];

export const AIAccountabilityBondsV2ABI = [
  "function nextBondId() view returns (uint256)",
  "function bonds(uint256) view returns (uint256 bondId, address aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active)",
  "function getBond(uint256) view returns (tuple(uint256 bondId, address aiCompany, string companyName, uint256 quarterlyRevenue, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function yieldPool() view returns (uint256)",
  "function totalActiveBondValue() view returns (uint256)",
];

export const ERC8004ReputationRegistryABI = [
  "function nextFeedbackId() view returns (uint256)",
  "function nextFeedbackIdHashed() view returns (uint256)",
  "function reputations(address) view returns (uint256 totalFeedbacks, uint256 averageRating, uint256 verifiedFeedbacks, uint256 lastUpdated)",
  "function getReputation(address) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 verifiedFeedbacks, uint256 lastUpdated)",
  // Write functions
  "function submitFeedback(address agent, uint256 rating, string comment)",
];

export const MultisigGovernanceABI = [
  "function getSigners() view returns (address[])",
  "function getSignerCount() view returns (uint256)",
  "function threshold() view returns (uint256)",
  "function transactionCount() view returns (uint256)",
  "function getTransaction(uint256) view returns (address to, uint256 value, bytes data, bool executed, uint256 confirmationCount, uint256 proposedAt)",
  "function isTransactionReady(uint256) view returns (bool)",
];

export const FlourishingMetricsOracleABI = [
  "function owner() view returns (address)",
  "function oracleCount() view returns (uint256)",
  "function nextRoundId() view returns (uint256)",
  "function getOracles() view returns (address[])",
  "function getRound(uint256) view returns (tuple(uint256 roundId, bytes32 metricId, uint256 startTime, uint256 deadline, uint256 consensusValue, bool finalized, uint256 submissionCount))",
  "function getSubmissions(uint256) view returns (tuple(address oracle, uint256 value, uint256 timestamp)[])",
];

export const ProductionBeliefAttestationVerifierABI = [
  "function owner() view returns (address)",
  "function attestationCount() view returns (uint256)",
  "function pendingImageId() view returns (bytes32)",
  "function pendingImageIdEffectiveAt() view returns (uint256)",
  "function getPendingImageIdChange() view returns (bytes32 pendingId, uint256 effectiveAt, bool isReady)",
  "function getImageId() view returns (bytes32)",
  "function getTimelockDelay() view returns (uint256)",
];

export const BeliefAttestationVerifierABI = [
  "function getPublicInputsCount() view returns (uint256)",
  "function getProofSystemId() view returns (string)",
  "function getMinBeliefThreshold() view returns (uint256)",
];

export const ERC8004ValidationRegistryABI = [
  "function nextRequestId() view returns (uint256)",
  "function nextResponseId() view returns (uint256)",
  "function getAgentValidationRequestsCount(address) view returns (uint256)",
];

export const PrivacyGuaranteesABI = [
  "function getPrivacyPolicy() view returns (string)",
];

export const MissionEnforcementABI = [
  "function owner() view returns (address)",
];

export const AntiSurveillanceABI = [
  "function owner() view returns (address)",
  "function getAntiSurveillancePolicy() view returns (string)",
];

export const VaultfireERC8004AdapterABI = [
  "function discoverVaultfireAgents() view returns (address[])",
  "function isAgentFullyRegistered(address) view returns (bool registeredERC8004, bool registeredVaultFire)",
];

export const VaultfireTeleporterBridgeABI = [
  "function owner() external view returns (address)",
  "function teleporterMessenger() external view returns (address)",
  "function requiredGasLimit() external view returns (uint256)",
  "function remoteBridgeAddress() external view returns (address)",
  "function remoteChainId() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "function messageCount() external view returns (uint256)",
  "function getRelayers() external view returns (address[])",
  "function isAgentRecognized(address) external view returns (bool)",
  "function getSyncedAgentCount() external view returns (uint256)",
];

// Generic owner ABI for contracts that have owner()
export const OwnerABI = [
  "function owner() view returns (address)",
];

export const PausableABI = [
  "function paused() view returns (bool)",
];
