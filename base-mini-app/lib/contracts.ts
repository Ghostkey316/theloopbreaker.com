// Vaultfire Contract ABIs and Addresses for Base

export const DILITHIUM_ATTESTOR_ADDRESS = (process.env.NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const DILITHIUM_ATTESTOR_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' },
      { internalType: 'bytes', name: 'zkProofBundle', type: 'bytes' }
    ],
    name: 'attestBelief',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' }],
    name: 'isBeliefSovereign',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' }
    ],
    name: 'getUserAttestationTime',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'zkEnabled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'prover', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'zkVerified', type: 'bool' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    name: 'BeliefAttested',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'bool', name: 'enabled', type: 'bool' }
    ],
    name: 'ZKVerificationToggled',
    type: 'event'
  }
] as const;

// Module IDs for different proof types
export const MODULE_IDS = {
  GITHUB: 0,
  NS3: 1,
  BASE: 2,
  CREDENTIAL: 3,
  REPUTATION: 4,
  IDENTITY: 5,
  GOVERNANCE: 6,
  GENERIC: 7,
  AI_AGENT: 8,        // AI agent reputation and authorization
  WORK_HISTORY: 9,    // Employment and professional credentials
  EDUCATION: 10,      // Academic credentials and certifications
  HUMANITY_PROOF: 11, // Proof of being human (anti-bot)
} as const;

/**
 * All 15 Vaultfire protocol contracts deployed on Base mainnet (chain ID 8453).
 * The first 10 are core protocol contracts; the last 5 are security enhancements.
 * DilithiumAttestor (contract #15) was part of the original deployment on all chains:
 *   Base: 0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4 (DilithiumAttestorV2 — working, 2 attestations)
 *   Avalanche: 0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f
 *   Ethereum: 0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695
 */
export const PROTOCOL_CONTRACTS = [
  // Core protocol contracts (original 10)
  { name: 'PrivacyGuarantees', address: '0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045', category: 'core' as const },
  { name: 'MissionEnforcement', address: '0x8568F4020FCD55915dB3695558dD6D2532599e56', category: 'core' as const },
  { name: 'AntiSurveillance', address: '0x722E37A7D6f27896C688336AaaFb0dDA80D25E57', category: 'core' as const },
  { name: 'ERC8004IdentityRegistry', address: '0x35978DB675576598F0781dA2133E94cdCf4858bC', category: 'core' as const },
  { name: 'BeliefAttestationVerifier', address: '0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba', category: 'core' as const },
  { name: 'ERC8004ReputationRegistry', address: '0xdB54B8925664816187646174bdBb6Ac658A55a5F', category: 'core' as const },
  { name: 'ERC8004ValidationRegistry', address: '0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55', category: 'core' as const },
  { name: 'AIPartnershipBondsV2', address: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4', category: 'core' as const },
  { name: 'AIAccountabilityBondsV2', address: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8', category: 'core' as const },
  { name: 'VaultfireERC8004Adapter', address: '0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0', category: 'core' as const },
  // Security enhancement contracts (original 5)
  { name: 'MultisigGovernance', address: '0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92', category: 'security' as const },
  { name: 'FlourishingMetricsOracle', address: '0x83dd216449B3F0574E39043ECFE275946fa492e9', category: 'security' as const },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xa5CEC47B48999EB398707838E3A18dd20A1ae272', category: 'security' as const },
  { name: 'VaultfireTeleporterBridge', address: '0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2', category: 'security' as const },
  { name: 'DilithiumAttestor', address: '0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4', category: 'security' as const },
] as const;

export const TOTAL_CONTRACTS = PROTOCOL_CONTRACTS.length; // 15

/**
 * Check if contracts are configured (not using zero addresses)
 */
export function areContractsConfigured(): boolean {
  return DILITHIUM_ATTESTOR_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

// Helper to get module name
export function getModuleName(moduleId: number): string {
  switch (moduleId) {
    case MODULE_IDS.GITHUB:
      return 'GitHub';
    case MODULE_IDS.NS3:
      return 'NS3';
    case MODULE_IDS.BASE:
      return 'Base';
    case MODULE_IDS.CREDENTIAL:
      return 'Credential';
    case MODULE_IDS.REPUTATION:
      return 'Reputation';
    case MODULE_IDS.IDENTITY:
      return 'Identity';
    case MODULE_IDS.GOVERNANCE:
      return 'Governance';
    case MODULE_IDS.AI_AGENT:
      return 'AI Agent';
    case MODULE_IDS.WORK_HISTORY:
      return 'Work History';
    case MODULE_IDS.EDUCATION:
      return 'Education';
    case MODULE_IDS.HUMANITY_PROOF:
      return 'Humanity Proof';
    default:
      return 'Generic';
  }
}

// Helper to get module color
export function getModuleColor(moduleId: number): string {
  switch (moduleId) {
    case MODULE_IDS.GITHUB:
      return 'bg-gray-900 text-white';
    case MODULE_IDS.NS3:
      return 'bg-vaultfire-purple text-white';
    case MODULE_IDS.BASE:
      return 'bg-base-blue text-white';
    case MODULE_IDS.AI_AGENT:
      return 'bg-cyan-600 text-white';
    case MODULE_IDS.HUMANITY_PROOF:
      return 'bg-green-600 text-white';
    case MODULE_IDS.EDUCATION:
      return 'bg-indigo-600 text-white';
    case MODULE_IDS.WORK_HISTORY:
      return 'bg-orange-600 text-white';
    case MODULE_IDS.CREDENTIAL:
      return 'bg-purple-600 text-white';
    case MODULE_IDS.IDENTITY:
      return 'bg-pink-600 text-white';
    case MODULE_IDS.GOVERNANCE:
      return 'bg-red-600 text-white';
    case MODULE_IDS.REPUTATION:
      return 'bg-yellow-600 text-white';
    default:
      return 'bg-base-gray-600 text-white';
  }
}
