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
 * All 13 Vaultfire protocol contracts deployed on Base mainnet (chain ID 8453).
 * The first 10 are core protocol contracts; the last 3 are security enhancements.
 */
export const PROTOCOL_CONTRACTS = [
  // Core protocol contracts (original 10)
  { name: 'PrivacyGuarantees', address: '0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e', category: 'core' as const },
  { name: 'MissionEnforcement', address: '0x6EC0440e1601558024f285903F0F4577B109B609', category: 'core' as const },
  { name: 'AntiSurveillance', address: '0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac', category: 'core' as const },
  { name: 'ERC8004IdentityRegistry', address: '0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD', category: 'core' as const },
  { name: 'BeliefAttestationVerifier', address: '0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a', category: 'core' as const },
  { name: 'ERC8004ReputationRegistry', address: '0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C', category: 'core' as const },
  { name: 'ERC8004ValidationRegistry', address: '0x50E4609991691D5104016c4a2F6D2875234d4B06', category: 'core' as const },
  { name: 'AIPartnershipBondsV2', address: '0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855', category: 'core' as const },
  { name: 'AIAccountabilityBondsV2', address: '0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140', category: 'core' as const },
  { name: 'VaultfireERC8004Adapter', address: '0x02Cb2bFBeC479Cb1EA109E4c92744e08d5A5B361', category: 'core' as const },
  // Security enhancement contracts (new 3)
  { name: 'MultisigGovernance', address: '0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D', category: 'security' as const },
  { name: 'FlourishingMetricsOracle', address: '0xb751abb1158908114662b254567b8135C460932C', category: 'security' as const },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xBDB5d85B3a84C773113779be89A166Ed515A7fE2', category: 'security' as const },
] as const;

export const TOTAL_CONTRACTS = PROTOCOL_CONTRACTS.length; // 13

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
