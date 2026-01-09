// Vaultfire Contract ABIs and Addresses for Base

export const DILITHIUM_ATTESTOR_ADDRESS = '0x...' as `0x${string}`; // TODO: Replace with deployed address
export const BELIEF_VERIFIER_ADDRESS = '0x...' as `0x${string}`; // TODO: Replace with deployed address

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
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'beliefHash', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'prover', type: 'address' },
      { indexed: false, internalType: 'bool', name: 'zkVerified', type: 'bool' }
    ],
    name: 'BeliefAttested',
    type: 'event'
  }
] as const;

export const BELIEF_VERIFIER_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'proofBytes', type: 'bytes' },
      { internalType: 'uint256[]', name: 'publicInputs', type: 'uint256[]' }
    ],
    name: 'verifyProof',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getProofSystemId',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getPublicInputsCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Module IDs for different proof types
export const MODULE_IDS = {
  GENERIC: 0,
  GITHUB: 1,
  NS3: 2,
  BASE: 3,
} as const;

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
