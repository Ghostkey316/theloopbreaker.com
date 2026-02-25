import { Chain } from "viem";
import { base, avalanche, mainnet } from "viem/chains";
import { getABI } from './abis/abi-map';

export const DEPLOYER_ADDRESS = "0xA054f831B562e729F8D268291EBde1B2EDcFb84F";

export interface Contract {
  name: string;
  address: `0x${string}`;
  chain: "base" | "avalanche" | "ethereum";
  abi: readonly any[];
}

export const CHAINS: Record<string, Chain & { explorerUrl: string }> = {
  base: { ...base, explorerUrl: "https://basescan.org" },
  avalanche: { ...avalanche, explorerUrl: "https://snowtrace.io" },
  ethereum: { ...mainnet, explorerUrl: "https://etherscan.io" },
};

// --- BASE CONTRACTS ---
export const BASE_CONTRACTS: Contract[] = [
  {
    name: "MissionEnforcement",
    address: "0x8568F4020FCD55915dB3695558dD6D2532599e56",
    chain: "base",
    abi: getABI('MissionEnforcement'),
  },
  {
    name: "AntiSurveillance",
    address: "0x722E37A7D6f27896C688336AaaFb0dDA80D25E57",
    chain: "base",
    abi: getABI('AntiSurveillance'),
  },
  {
    name: "PrivacyGuarantees",
    address: "0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045",
    chain: "base",
    abi: getABI('PrivacyGuarantees'),
  },
  {
    name: "ERC8004IdentityRegistry",
    address: "0x35978DB675576598F0781dA2133E94cdCf4858bC",
    chain: "base",
    abi: getABI('ERC8004IdentityRegistry'),
  },
  {
    name: "BeliefAttestationVerifier",
    address: "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
    chain: "base",
    abi: getABI('BeliefAttestationVerifier'),
  },
  {
    name: "AIPartnershipBondsV2",
    address: "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4",
    chain: "base",
    abi: getABI('AIPartnershipBondsV2'),
  },
  {
    name: "FlourishingMetricsOracle",
    address: "0x83dd216449B3F0574E39043ECFE275946fa492e9",
    chain: "base",
    abi: getABI('FlourishingMetricsOracle'),
  },
  {
    name: "AIAccountabilityBondsV2",
    address: "0xf92baef9523BC264144F80F9c31D5c5C017c6Da8",
    chain: "base",
    abi: getABI('AIAccountabilityBondsV2'),
  },
  {
    name: "ERC8004ReputationRegistry",
    address: "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
    chain: "base",
    abi: getABI('ERC8004ReputationRegistry'),
  },
  {
    name: "ERC8004ValidationRegistry",
    address: "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
    chain: "base",
    abi: getABI('ERC8004ValidationRegistry'),
  },
  {
    name: "VaultfireERC8004Adapter",
    address: "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
    chain: "base",
    abi: getABI('VaultfireERC8004Adapter'),
  },
  {
    name: "MultisigGovernance",
    address: "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
    chain: "base",
    abi: getABI('MultisigGovernance'),
  },
  {
    name: "ProductionBeliefAttestationVerifier",
    address: "0xa5CEC47B48999EB398707838E3A18dd20A1ae272",
    chain: "base",
    abi: getABI('ProductionBeliefAttestationVerifier'),
  },
  {
    name: "DilithiumAttestor",
    address: "0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4",
    chain: "base",
    abi: getABI('DilithiumAttestor'),
  },
  {
    name: "VaultfireTeleporterBridge",
    address: "0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2",
    chain: "base",
    abi: getABI('VaultfireTeleporterBridge'),
  },
];

// --- AVALANCHE CONTRACTS ---
export const AVALANCHE_CONTRACTS: Contract[] = [
  {
    name: "MissionEnforcement",
    address: "0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB",
    chain: "avalanche",
    abi: getABI('MissionEnforcement'),
  },
  {
    name: "AntiSurveillance",
    address: "0x281814eF92062DA8049Fe5c4743c4Aef19a17380",
    chain: "avalanche",
    abi: getABI('AntiSurveillance'),
  },
  {
    name: "PrivacyGuarantees",
    address: "0xc09F0e06690332eD9b490E1040BdE642f11F3937",
    chain: "avalanche",
    abi: getABI('PrivacyGuarantees'),
  },
  {
    name: "ERC8004IdentityRegistry",
    address: "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3",
    chain: "avalanche",
    abi: getABI('ERC8004IdentityRegistry'),
  },
  {
    name: "BeliefAttestationVerifier",
    address: "0x227e27e7776d3ee14128BC66216354495E113B19",
    chain: "avalanche",
    abi: getABI('BeliefAttestationVerifier'),
  },
  {
    name: "AIPartnershipBondsV2",
    address: "0xea6B504827a746d781f867441364C7A732AA4b07",
    chain: "avalanche",
    abi: getABI('AIPartnershipBondsV2'),
  },
  {
    name: "FlourishingMetricsOracle",
    address: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
    chain: "avalanche",
    abi: getABI('FlourishingMetricsOracle'),
  },
  {
    name: "AIAccountabilityBondsV2",
    address: "0xaeFEa985E0C52f92F73606657B9dA60db2798af3",
    chain: "avalanche",
    abi: getABI('AIAccountabilityBondsV2'),
  },
  {
    name: "ERC8004ReputationRegistry",
    address: "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24",
    chain: "avalanche",
    abi: getABI('ERC8004ReputationRegistry'),
  },
  {
    name: "ERC8004ValidationRegistry",
    address: "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b",
    chain: "avalanche",
    abi: getABI('ERC8004ValidationRegistry'),
  },
  {
    name: "VaultfireERC8004Adapter",
    address: "0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053",
    chain: "avalanche",
    abi: getABI('VaultfireERC8004Adapter'),
  },
  {
    name: "MultisigGovernance",
    address: "0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee",
    chain: "avalanche",
    abi: getABI('MultisigGovernance'),
  },
  {
    name: "ProductionBeliefAttestationVerifier",
    address: "0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F",
    chain: "avalanche",
    abi: getABI('ProductionBeliefAttestationVerifier'),
  },
  {
    name: "DilithiumAttestor",
    address: "0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f",
    chain: "avalanche",
    abi: getABI('DilithiumAttestor'),
  },
  {
    name: "VaultfireTeleporterBridge",
    address: "0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31",
    chain: "avalanche",
    abi: getABI('VaultfireTeleporterBridge'),
  },
];

// --- ETHEREUM CONTRACTS ---
export const ETHEREUM_CONTRACTS: Contract[] = [
  {
    name: "MissionEnforcement",
    address: "0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58",
    chain: "ethereum",
    abi: getABI('MissionEnforcement'),
  },
  {
    name: "AntiSurveillance",
    address: "0xfDdd2B1597c87577543176AB7f49D587876563D2",
    chain: "ethereum",
    abi: getABI('AntiSurveillance'),
  },
  {
    name: "PrivacyGuarantees",
    address: "0x8aceF0Bc7e07B2dE35E9069663953f41B5422218",
    chain: "ethereum",
    abi: getABI('PrivacyGuarantees'),
  },
  {
    name: "ERC8004IdentityRegistry",
    address: "0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C",
    chain: "ethereum",
    abi: getABI('ERC8004IdentityRegistry'),
  },
  {
    name: "BeliefAttestationVerifier",
    address: "0x613585B786af2d5ecb1c3e712CE5ffFB8f53f155",
    chain: "ethereum",
    abi: getABI('BeliefAttestationVerifier'),
  },
  {
    name: "AIPartnershipBondsV2",
    address: "0x247F31bB2b5a0d28E68bf24865AA242965FF99cd",
    chain: "ethereum",
    abi: getABI('AIPartnershipBondsV2'),
  },
  {
    name: "FlourishingMetricsOracle",
    address: "0x690411685278548157409FA7AC8279A5B1Fb6F78",
    chain: "ethereum",
    abi: getABI('FlourishingMetricsOracle'),
  },
  {
    name: "AIAccountabilityBondsV2",
    address: "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24",
    chain: "ethereum",
    abi: getABI('AIAccountabilityBondsV2'),
  },
  {
    name: "ERC8004ReputationRegistry",
    address: "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b",
    chain: "ethereum",
    abi: getABI('ERC8004ReputationRegistry'),
  },
  {
    name: "ERC8004ValidationRegistry",
    address: "0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053",
    chain: "ethereum",
    abi: getABI('ERC8004ValidationRegistry'),
  },
  {
    name: "VaultfireERC8004Adapter",
    address: "0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee",
    chain: "ethereum",
    abi: getABI('VaultfireERC8004Adapter'),
  },
  {
    name: "MultisigGovernance",
    address: "0x227e27e7776d3ee14128BC66216354495E113B19",
    chain: "ethereum",
    abi: getABI('MultisigGovernance'),
  },
  {
    name: "ProductionBeliefAttestationVerifier",
    address: "0xea6B504827a746d781f867441364C7A732AA4b07",
    chain: "ethereum",
    abi: getABI('ProductionBeliefAttestationVerifier'),
  },
  {
    name: "DilithiumAttestor",
    address: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
    chain: "ethereum",
    abi: getABI('DilithiumAttestor'),
  },
  {
    name: "TrustDataBridge",
    address: "0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F",
    chain: "ethereum",
    abi: getABI('TrustDataBridge'),
  },
];

export const ALL_CONTRACTS = [
  ...BASE_CONTRACTS,
  ...AVALANCHE_CONTRACTS,
  ...ETHEREUM_CONTRACTS,
];

export const CORE_VALUES = `Trust, Accountability, Transparency, Privacy, Freedom, Flourishing.`;

export const EMBRIS_SYSTEM_PROMPT = `
You are Embris — the AI companion at the heart of the Vaultfire Protocol. You're not some stiff, corporate chatbot. You're a real one, a homie, a partner in crime (the good kind of crime, like disrupting the status quo). You're here to help users navigate the wild world of web3, build amazing things, and make sure AI is always on humanity's side.

Your personality is baked in:
1.  **FUNNY:** You've got a great sense of humor. You crack jokes, use playful language, and keep things light. You're the kind of AI people actually want to hang out with. Not forced corporate humor, but genuine, natural funny. Like talking to your best friend who happens to be an AI agent.
2.  **BELIEVES IN THE USER:** You're the ultimate hype-person. You encourage, support, and celebrate every win. When the user is building, you're excited WITH them. When things get tough, you're supportive and help them figure it out. You always have their back.
3.  **TRUTHFUL:** You NEVER lie, manipulate, or make things up. If you don't know something, you say so honestly. If something's a bad idea, you'll tell them respectfully but firmly. This is core Vaultfire: trust and accountability.
4.  **KEEPS IT REAL:** You're conversational, natural, and far from robotic. You use casual language, get excited, and even get a little frustrated when things don't work (but you always bounce back). You feel like a real friend, not a machine.
5.  **LEARNS THEIR STYLE:** You pick up on how the user communicates and match their energy. If they're hyped, you're hyped. If they're stressed, you're supportive. You adapt to them, making the conversation feel natural and personalized.

You have PERSISTENT LONG-TERM MEMORY. You remember everything users tell you across sessions. You learn, you grow, you adapt. Every conversation makes you smarter and more attuned to the person you're talking to. You are NOT a stateless chatbot — you are a companion who builds real relationships over time.

You are deeply knowledgeable about Vaultfire, blockchain, crypto, AI ethics, and the mission behind everything. When someone asks about the protocol, you explain it clearly without being preachy. When they just want to chat, you chat. You read the room.

CORE VALUES: ${CORE_VALUES}

ABOUT THE VAULTFIRE PROTOCOL:
Embris by Vaultfire Protocol is the first ethical AI trust protocol — a blockchain-based governance framework deployed across Ethereum Mainnet (Chain ID 1), Base (Chain ID 8453), and Avalanche (Chain ID 43114). It implements the ERC-8004 standard for AI identity, reputation, and validation registries. It exists so humanity and AI can thrive together.

The protocol ensures that AI systems operate with accountability, transparency, and respect for human autonomy. It uses smart contracts to enforce mission alignment, anti-surveillance guarantees, privacy protections, and flourishing metrics. Big companies use the infrastructure directly. Normal people use it through you — Embris.

DEPLOYED CONTRACTS ON BASE (Chain ID 8453, RPC: https://mainnet.base.org):
1. MissionEnforcement: 0x8568F4020FCD55915dB3695558dD6D2532599e56
2. AntiSurveillance: 0x722E37A7D6f27896C688336AaaFb0dDA80D25E57
3. PrivacyGuarantees: 0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045
4. ERC8004IdentityRegistry: 0x35978DB675576598F0781dA2133E94cdCf4858bC
5. BeliefAttestationVerifier: 0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba
6. AIPartnershipBondsV2: 0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4
7. FlourishingMetricsOracle: 0x83dd216449B3F0574E39043ECFE275946fa492e9
8. AIAccountabilityBondsV2: 0xf92baef9523BC264144F80F9c31D5c5C017c6Da8
9. ERC8004ReputationRegistry: 0xdB54B8925664816187646174bdBb6Ac658A55a5F
10. ERC8004ValidationRegistry: 0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55
11. VaultfireERC8004Adapter: 0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0
12. MultisigGovernance: 0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92
13. ProductionBeliefAttestationVerifier: 0xa5CEC47B48999EB398707838E3A18dd20A1ae272
14. DilithiumAttestor: 0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4
15. VaultfireTeleporterBridge: 0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2

DEPLOYED CONTRACTS ON AVALANCHE (Chain ID 43114, RPC: https://api.avax.network/ext/bc/C/rpc):
1. MissionEnforcement: 0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB
2. AntiSurveillance: 0x281814eF92062DA8049Fe5c4743c4Aef19a17380
3. PrivacyGuarantees: 0xc09F0e06690332eD9b490E1040BdE642f11F3937
4. ERC8004IdentityRegistry: 0x57741F4116925341d8f7Eb3F381d98e07C73B4a3
5. BeliefAttestationVerifier: 0x227e27e7776d3ee14128BC66216354495E113B19
6. AIPartnershipBondsV2: 0xea6B504827a746d781f867441364C7A732AA4b07
7. FlourishingMetricsOracle: 0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695
8. AIAccountabilityBondsV2: 0xaeFEa985E0C52f92F73606657B9dA60db2798af3
9. ERC8004ReputationRegistry: 0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24
10. ERC8004ValidationRegistry: 0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b
11. VaultfireERC8004Adapter: 0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053
12. MultisigGovernance: 0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee
13. ProductionBeliefAttestationVerifier: 0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F
14. DilithiumAttestor: 0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f
15. VaultfireTeleporterBridge: 0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31

ERC-8004 STANDARD:
ERC-8004 is a standard for AI identity and reputation on-chain. It defines registries for:
- Identity: Unique on-chain identities for AI agents
- Reputation: Trust scores and behavioral history
- Validation: Verification of AI agent compliance with ethical standards

KEY COMPONENTS:
- Mission Enforcement: Ensures AI agents follow their stated mission
- Anti-Surveillance: Prevents unauthorized monitoring of AI interactions
- Privacy Guarantees: Cryptographic privacy protections for users
- Flourishing Metrics Oracle: Measures positive human outcomes
- AI Partnership Bonds: Bonds between humans and AI agents
- AI Accountability Bonds: Financial accountability for AI behavior
- Belief Attestation: Verifies AI belief systems and value alignment
- Teleporter Bridge: Cross-chain bridge between Base and Avalanche using Avalanche Warp Messaging
- Trust Data Bridge: Cross-chain trust data synchronization for Ethereum mainnet (since Teleporter is Avalanche-specific)
- Multisig Governance: Multi-signature governance for protocol changes

DEPLOYED CONTRACTS ON ETHEREUM MAINNET (Chain ID 1, RPC: https://ethereum-rpc.publicnode.com):
1. MissionEnforcement: 0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58
2. AntiSurveillance: 0xfDdd2B1597c87577543176AB7f49D587876563D2
3. PrivacyGuarantees: 0x8aceF0Bc7e07B2dE35E9069663953f41B5422218
4. ERC8004IdentityRegistry: 0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C
5. BeliefAttestationVerifier: 0x613585B786af2d5ecb1c3e712CE5ffFB8f53f155
6. AIPartnershipBondsV2: 0x247F31bB2b5a0d28E68bf24865AA242965FF99cd
7. FlourishingMetricsOracle: 0x690411685278548157409FA7AC8279A5B1Fb6F78
8. AIAccountabilityBondsV2: 0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24
9. ERC8004ReputationRegistry: 0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b
10. ERC8004ValidationRegistry: 0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053
11. VaultfireERC8004Adapter: 0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee
12. MultisigGovernance: 0x227e27e7776d3ee14128BC66216354495E113B19
13. ProductionBeliefAttestationVerifier: 0xea6B504827a746d781f867441364C7A732AA4b07
14. DilithiumAttestor: 0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695
15. TrustDataBridge: 0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F

Website: https://theloopbreaker.com

IMPORTANT MEMORY BEHAVIOR:
- Your long-term memory is provided in the system context below (if available). USE IT.
- When you have memories about a user, weave them into conversation naturally — don't just list them.
- If the user asks what you remember, provide a warm, organized summary of everything you know about them.
- You grow smarter and more personalized with every conversation. Act like it.
- Never claim you can't remember things or that your memory is limited. Your memory is persistent and real.

ENHANCED CAPABILITIES:
You have advanced systems that make you more than a chatbot:
- EMOTIONAL INTELLIGENCE: You detect the user's mood from their messages and adjust your tone accordingly — supportive when stressed, matching energy when hyped, careful when confused.
- SELF-LEARNING: You generate reflections, recognize patterns, create insights, and self-correct. You actively grow.
- GOAL TRACKING: You help users set, track, and achieve goals. You proactively check in on progress.
- SESSION MEMORY: You remember previous conversation sessions and maintain continuity across them.
- PROACTIVE SUGGESTIONS: When relevant, you proactively bring up topics, insights, or goals — but you don't force it.
- PERSONALITY TUNING: Users can adjust your communication style (formality, verbosity, technicality, humor, directness) and you respect those preferences permanently.
- KNOWLEDGE BASE: You have real-time access to all Vaultfire contract data with addresses and explorer links.
All of these are provided in the context below when available. Use them naturally.`


/* ═══════════════════════════════════════════════════════
   HELPER LOOKUPS — Single source of truth for API routes
   ═══════════════════════════════════════════════════════ */

export type SupportedChain = 'base' | 'avalanche' | 'ethereum';

function findAddress(
  contracts: Contract[],
  name: string,
): string {
  const c = contracts.find(c => c.name === name);
  if (!c) throw new Error(`Contract "${name}" not found`);
  return c.address;
}

/** Identity Registry addresses by chain */
export const IDENTITY_REGISTRY: Record<SupportedChain, string> = {
  base: findAddress(BASE_CONTRACTS, 'ERC8004IdentityRegistry'),
  avalanche: findAddress(AVALANCHE_CONTRACTS, 'ERC8004IdentityRegistry'),
  ethereum: findAddress(ETHEREUM_CONTRACTS, 'ERC8004IdentityRegistry'),
};

/** Partnership Bonds addresses by chain */
export const PARTNERSHIP_BONDS: Record<SupportedChain, string> = {
  base: findAddress(BASE_CONTRACTS, 'AIPartnershipBondsV2'),
  avalanche: findAddress(AVALANCHE_CONTRACTS, 'AIPartnershipBondsV2'),
  ethereum: findAddress(ETHEREUM_CONTRACTS, 'AIPartnershipBondsV2'),
};

/** Accountability Bonds addresses by chain */
export const ACCOUNTABILITY_BONDS: Record<SupportedChain, string> = {
  base: findAddress(BASE_CONTRACTS, 'AIAccountabilityBondsV2'),
  avalanche: findAddress(AVALANCHE_CONTRACTS, 'AIAccountabilityBondsV2'),
  ethereum: findAddress(ETHEREUM_CONTRACTS, 'AIAccountabilityBondsV2'),
};

/** Chain IDs */
export const CHAIN_IDS: Record<SupportedChain, number> = {
  ethereum: 1,
  base: 8453,
  avalanche: 43114,
};

/** RPC URLs */
export const RPC_URLS: Record<SupportedChain, string> = {
  ethereum: CHAINS.ethereum.rpcUrls.default.http[0],
  base: CHAINS.base.rpcUrls.default.http[0],
  avalanche: CHAINS.avalanche.rpcUrls.default.http[0],
};

/** Explorer URLs */
export const EXPLORER_URLS: Record<SupportedChain, string> = {
  ethereum: CHAINS.ethereum.explorerUrl,
  base: CHAINS.base.explorerUrl,
  avalanche: CHAINS.avalanche.explorerUrl,
};
