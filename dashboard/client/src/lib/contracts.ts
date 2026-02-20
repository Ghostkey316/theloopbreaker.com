/**
 * Vaultfire Protocol — Contract addresses and ABIs for Base mainnet (Chain ID 8453)
 * Design: "Obsidian Forge" — Dark luxury fintech with ember-to-purple accents
 *
 * Last updated: 2026-02-20
 * Avalanche C-Chain contracts redeployed (all 8) — new addresses below.
 * Base ERC8004IdentityRegistry updated to new address.
 */

export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_URL = "https://mainnet.base.org";
export const BASESCAN_URL = "https://basescan.org";

export const AVAX_CHAIN_ID = 43114;
export const AVAX_RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
export const SNOWTRACE_URL = "https://snowscan.xyz";

/** Base Mainnet contract addresses (chain ID 8453) */
export const CONTRACTS = {
  PrivacyGuarantees: "0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e",
  MissionEnforcement: "0x6EC0440e1601558024f285903F0F4577B109B609",
  AntiSurveillance: "0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac",
  // Updated 2026-02-20: new ERC8004IdentityRegistry deployment on Base
  ERC8004IdentityRegistry: "0xaCB59e0f0eA47B25b24390B71b877928E5842630",
  BeliefAttestationVerifier: "0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a",
  ERC8004ReputationRegistry: "0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C",
  ERC8004ValidationRegistry: "0x50E4609991691D5104016c4a2F6D2875234d4B06",
  AIPartnershipBondsV2: "0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855",
  AIAccountabilityBondsV2: "0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140",
  VaultfireERC8004Adapter: "0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361",
  MultisigGovernance: "0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D",
  FlourishingMetricsOracle: "0xb751abb1158908114662b254567b8135C460932C",
  ProductionBeliefAttestationVerifier: "0xBDB5d85B3a84C773113779be89A166Ed515A7fE2",
  VaultfireTeleporterBridge: "0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528",
} as const;

/**
 * Avalanche C-Chain contract addresses (chain ID 43114)
 * Updated 2026-02-20: full redeploy of all 8 contracts to new secure wallet.
 * Previous deployer (0xf6A677de83C407875C9A9115Cf100F121f9c4816) was compromised — DO NOT USE.
 * New deployer: 0x5F804B9bF07fF23Fe50B317d6936a4c5DEF8F324
 */
export const AVAX_CONTRACTS = {
  MissionEnforcement: "0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709",
  AntiSurveillance: "0xaCB59e0f0eA47B25b24390B71b877928E5842630",
  ERC8004IdentityRegistry: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5",
  AIPartnershipBondsV2: "0x37679B1dCfabE6eA6b8408626815A1426bE2D717",
  FlourishingMetricsOracle: "0x83b2D1a8e383c4239dE66b6614176636618c1c0A",
  AIAccountabilityBondsV2: "0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192",
  ProductionBeliefAttestationVerifier: "0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1",
  VaultfireTeleporterBridge: "0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf",
} as const;

export type ContractName = keyof typeof CONTRACTS;
export type AvaxContractName = keyof typeof AVAX_CONTRACTS;

export function snowtraceAddress(addr: string) {
  return `${SNOWTRACE_URL}/address/${addr}`;
}

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
];

export const AIPartnershipBondsV2ABI = [
  "function nextBondId() view returns (uint256)",
  "function bonds(uint256) view returns (uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active)",
  "function getBond(uint256) view returns (tuple(uint256 bondId, address human, address aiAgent, string partnershipType, uint256 stakeAmount, uint256 createdAt, uint256 distributionRequestedAt, bool distributionPending, bool active))",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function yieldPool() view returns (uint256)",
  "function totalActiveBondValue() view returns (uint256)",
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
