// ABI for TrustDataBridge
// Chains: ethereum
// Auto-fetched from Etherscan V2 API
export const TrustDataBridge_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_teleporterMessenger",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_requiredGasLimit",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "by",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "relayer",
        "type": "address"
      }
    ],
    "name": "RelayerAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "relayer",
        "type": "address"
      }
    ],
    "name": "RelayerRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "enum TrustPortabilityExtension.TrustMessageType",
        "name": "messageType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "messageHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "TrustMessageReceived",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "enum TrustPortabilityExtension.TrustMessageType",
        "name": "messageType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "messageHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "destinationChainId",
        "type": "uint256"
      }
    ],
    "name": "TrustMessageSent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "subject",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum TrustPortabilityExtension.TrustTier",
        "name": "tier",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "expiresAt",
        "type": "uint256"
      }
    ],
    "name": "TrustTierSynced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "by",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "nameHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "enum TrustPortabilityExtension.IdentityType",
        "name": "identityType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "VNSIdentitySynced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "prover",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "beliefHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "zkVerified",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "ZKAttestationSynced",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "relayer",
        "type": "address"
      }
    ],
    "name": "addRelayer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "authorizedRelayers",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "prover",
        "type": "address"
      }
    ],
    "name": "getProverAttestations",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "beliefHashes",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "subject",
        "type": "address"
      }
    ],
    "name": "getSyncedTrustTier",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "enum TrustPortabilityExtension.TrustTier",
            "name": "tier",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "score",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "activeBondCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "averageRating",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "verifiedFeedbacks",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "computedAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expiresAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "sourceChainId",
            "type": "uint256"
          }
        ],
        "internalType": "struct TrustPortabilityExtension.TrustTierPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedTrustTierCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      }
    ],
    "name": "getSyncedVNSByName",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "nameHash",
            "type": "bytes32"
          },
          {
            "internalType": "enum TrustPortabilityExtension.IdentityType",
            "name": "identityType",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "registeredAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expiresAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "sourceChainId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "paymentAddress",
            "type": "address"
          }
        ],
        "internalType": "struct TrustPortabilityExtension.VNSIdentityPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedVNSCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "beliefHash",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "prover",
        "type": "address"
      }
    ],
    "name": "isBeliefAttested",
    "outputs": [
      {
        "internalType": "bool",
        "name": "attested",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "zkVerified",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "subject",
        "type": "address"
      }
    ],
    "name": "isTrustTierRecognized",
    "outputs": [
      {
        "internalType": "bool",
        "name": "recognized",
        "type": "bool"
      },
      {
        "internalType": "enum TrustPortabilityExtension.TrustTier",
        "name": "tier",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "outboundNonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "processedMessages",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "proverAttestations",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "sourceBlockchainID",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "originSenderAddress",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "message",
        "type": "bytes"
      }
    ],
    "name": "receiveTeleporterMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "encoded",
        "type": "bytes"
      }
    ],
    "name": "relayTrustMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "remoteBlockchainID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "remoteBridgeAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "remoteChainId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "relayer",
        "type": "address"
      }
    ],
    "name": "removeRelayer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "requiredGasLimit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      }
    ],
    "name": "resolveVNS",
    "outputs": [
      {
        "internalType": "address",
        "name": "owner_",
        "type": "address"
      },
      {
        "internalType": "enum TrustPortabilityExtension.IdentityType",
        "name": "identityType",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "paymentAddress",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "subject",
        "type": "address"
      }
    ],
    "name": "reverseResolveVNS",
    "outputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "subject",
        "type": "address"
      },
      {
        "internalType": "enum TrustPortabilityExtension.TrustTier",
        "name": "tier",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activeBondCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "averageRating",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "verifiedFeedbacks",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tierValiditySeconds",
        "type": "uint256"
      }
    ],
    "name": "sendTrustTier",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner_",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "enum TrustPortabilityExtension.IdentityType",
        "name": "identityType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "registeredAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "expiresAt",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "paymentAddress",
        "type": "address"
      }
    ],
    "name": "sendVNSIdentity",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "prover",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "beliefHash",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "zkVerified",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "attestedAt",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "verifierImageId",
        "type": "bytes32"
      }
    ],
    "name": "sendZKAttestation",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_remoteBlockchainID",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "_remoteBridgeAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_remoteChainId",
        "type": "uint256"
      }
    ],
    "name": "setRemoteBridge",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_gasLimit",
        "type": "uint256"
      }
    ],
    "name": "setRequiredGasLimit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_messenger",
        "type": "address"
      }
    ],
    "name": "setTeleporterMessenger",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "syncedTrustTierSubjects",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "syncedTrustTiers",
    "outputs": [
      {
        "internalType": "address",
        "name": "subject",
        "type": "address"
      },
      {
        "internalType": "enum TrustPortabilityExtension.TrustTier",
        "name": "tier",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "score",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activeBondCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "averageRating",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "verifiedFeedbacks",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "computedAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "expiresAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "syncedVNSByAddress",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "syncedVNSByNameHash",
    "outputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "nameHash",
        "type": "bytes32"
      },
      {
        "internalType": "enum TrustPortabilityExtension.IdentityType",
        "name": "identityType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "registeredAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "expiresAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "paymentAddress",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "syncedVNSNameHashes",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "syncedZKAttestations",
    "outputs": [
      {
        "internalType": "address",
        "name": "prover",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "beliefHash",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "zkVerified",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "attestedAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "verifierImageId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "teleporterMessenger",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
