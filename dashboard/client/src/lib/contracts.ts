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
  PrivacyGuarantees: "0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045",
  MissionEnforcement: "0x8568F4020FCD55915dB3695558dD6D2532599e56",
  AntiSurveillance: "0x722E37A7D6f27896C688336AaaFb0dDA80D25E57",
  // Updated 2026-02-20: new ERC8004IdentityRegistry deployment on Base
  ERC8004IdentityRegistry: "0x35978DB675576598F0781dA2133E94cdCf4858bC",
  BeliefAttestationVerifier: "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
  ERC8004ReputationRegistry: "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
  ERC8004ValidationRegistry: "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
  AIPartnershipBondsV2: "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4",
  AIAccountabilityBondsV2: "0xf92baef9523BC264144F80F9c31D5c5C017c6Da8",
  VaultfireERC8004Adapter: "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
  MultisigGovernance: "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
  FlourishingMetricsOracle: "0x83dd216449B3F0574E39043ECFE275946fa492e9",
  ProductionBeliefAttestationVerifier: "0xa5CEC47B48999EB398707838E3A18dd20A1ae272",
  VaultfireTeleporterBridge: "0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2",
} as const;

/**
 * Avalanche C-Chain contract addresses (chain ID 43114)
 * Updated 2026-02-20: full redeploy of all 8 contracts to new secure wallet.
 * Previous deployer (0xf6A677de83C407875C9A9115Cf100F121f9c4816) was compromised — DO NOT USE.
 * New deployer: 0xA054f831B562e729F8D268291EBde1B2EDcFb84F
 */
export const AVAX_CONTRACTS = {
  MissionEnforcement: "0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB",
  AntiSurveillance: "0x281814eF92062DA8049Fe5c4743c4Aef19a17380",
  PrivacyGuarantees: "0xc09F0e06690332eD9b490E1040BdE642f11F3937",
  ERC8004IdentityRegistry: "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3",
  BeliefAttestationVerifier: "0x227e27e7776d3ee14128BC66216354495E113B19",
  AIPartnershipBondsV2: "0xea6B504827a746d781f867441364C7A732AA4b07",
  FlourishingMetricsOracle: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
  AIAccountabilityBondsV2: "0xaeFEa985E0C52f92F73606657B9dA60db2798af3",
  ERC8004ReputationRegistry: "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24",
  ERC8004ValidationRegistry: "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b",
  VaultfireERC8004Adapter: "0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053",
  MultisigGovernance: "0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee",
  ProductionBeliefAttestationVerifier: "0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F",
  DilithiumAttestor: "0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f",
  VaultfireTeleporterBridge: "0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31",
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
