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
  { name: 'PrivacyGuarantees', address: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55', category: 'core' as const },
  { name: 'MissionEnforcement', address: '0x38165D2D7a8584985CCa5640f4b32b1f3347CC83', category: 'core' as const },
  { name: 'AntiSurveillance', address: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C', category: 'core' as const },
  { name: 'ERC8004IdentityRegistry', address: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5', category: 'core' as const },
  { name: 'BeliefAttestationVerifier', address: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF', category: 'core' as const },
  { name: 'ERC8004ReputationRegistry', address: '0x544B575431ECD927bA83E85008446fA1e100204a', category: 'core' as const },
  { name: 'ERC8004ValidationRegistry', address: '0x501fE0f960c1e061C4d295Af241f9F1512775556', category: 'core' as const },
  { name: 'AIPartnershipBondsV2', address: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1', category: 'core' as const },
  { name: 'AIAccountabilityBondsV2', address: '0xDfc66395A4742b5168712a04942C90B99394aEEb', category: 'core' as const },
  { name: 'VaultfireERC8004Adapter', address: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c', category: 'core' as const },
  // Security enhancement contracts (new 3)
  { name: 'MultisigGovernance', address: '0xea0A6750642AA294658dC9f1eDf36b95D21e7B22', category: 'security' as const },
  { name: 'FlourishingMetricsOracle', address: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1', category: 'security' as const },
  { name: 'ProductionBeliefAttestationVerifier', address: '0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B', category: 'security' as const },
  { name: 'VaultfireTeleporterBridge', address: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05', category: 'security' as const },
] as const;

export const TOTAL_CONTRACTS = PROTOCOL_CONTRACTS.length; // 14

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
