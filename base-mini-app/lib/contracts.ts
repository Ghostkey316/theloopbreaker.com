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
} as const;

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
    default:
      return 'bg-base-gray-600 text-white';
  }
}
