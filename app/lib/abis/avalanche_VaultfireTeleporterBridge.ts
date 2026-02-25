// ABI for VaultfireTeleporterBridge on avalanche
// Auto-fetched from Etherscan V2 API
export const VaultfireTeleporterBridge_avalanche_ABI = [
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "aiCompany",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "AccountabilityBondSynced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "agentType",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "AgentSynced",
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
    "name": "BridgePaused",
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
    "name": "BridgeUnpaused",
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
        "internalType": "enum VaultfireTeleporterBridge.MessageType",
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
    "name": "MessageReceived",
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
        "internalType": "enum VaultfireTeleporterBridge.MessageType",
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
    "name": "MessageSent",
    "type": "event"
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "human",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "aiAgent",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "PartnershipBondSynced",
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
        "indexed": false,
        "internalType": "bytes32",
        "name": "remoteBlockchainID",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "remoteBridgeAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "remoteChainId",
        "type": "uint256"
      }
    ],
    "name": "RemoteConfigured",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "averageRating",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "ReputationSynced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "status",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sourceChainId",
        "type": "uint256"
      }
    ],
    "name": "ValidationSynced",
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
    "inputs": [],
    "name": "getRelayerCount",
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      }
    ],
    "name": "getSyncedAccountabilityBond",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "bondId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "aiCompany",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "companyName",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "quarterlyRevenue",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "stakeAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          }
        ],
        "internalType": "struct VaultfireTeleporterBridge.AccountabilityBondPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedAccountabilityBondCount",
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
        "name": "agent",
        "type": "address"
      }
    ],
    "name": "getSyncedAgent",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "agentAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "agentURI",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "agentType",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "capabilitiesHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "registeredAt",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultfireTeleporterBridge.AgentRegistrationPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedAgentCount",
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      }
    ],
    "name": "getSyncedPartnershipBond",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "bondId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "human",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "aiAgent",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "purpose",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          }
        ],
        "internalType": "struct VaultfireTeleporterBridge.PartnershipBondPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedPartnershipBondCount",
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
        "name": "agent",
        "type": "address"
      }
    ],
    "name": "getSyncedReputation",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "agentAddress",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "totalFeedbacks",
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
            "name": "lastUpdated",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultfireTeleporterBridge.ReputationPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedReputationCount",
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
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "name": "getSyncedValidation",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "requestId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "agentAddress",
            "type": "address"
          },
          {
            "internalType": "uint8",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "approvalsCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "rejectionsCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultfireTeleporterBridge.ValidationPayload",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSyncedValidationCount",
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
        "name": "agent",
        "type": "address"
      }
    ],
    "name": "isAgentRecognized",
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
    "inputs": [],
    "name": "lastProcessedNonce",
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
        "name": "encodedMessage",
        "type": "bytes"
      }
    ],
    "name": "relayMessage",
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
    "name": "relayerList",
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "aiCompany",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "companyName",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "quarterlyRevenue",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "stakeAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "name": "sendAccountabilityBond",
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
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "agentURI",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "agentType",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "capabilitiesHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "registeredAt",
        "type": "uint256"
      }
    ],
    "name": "sendAgentRegistration",
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "human",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "aiAgent",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "purpose",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "name": "sendPartnershipBond",
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
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "totalFeedbacks",
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
        "name": "lastUpdated",
        "type": "uint256"
      }
    ],
    "name": "sendReputation",
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
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "approvalsCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "rejectionsCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "sendValidation",
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
    "name": "syncedAccountabilityBondIds",
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
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "syncedAccountabilityBonds",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "aiCompany",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "companyName",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "quarterlyRevenue",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "stakeAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
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
    "name": "syncedAgentList",
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
    "name": "syncedAgents",
    "outputs": [
      {
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "agentURI",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "agentType",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "capabilitiesHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "registeredAt",
        "type": "uint256"
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
    "name": "syncedPartnershipBondIds",
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
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "syncedPartnershipBonds",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "human",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "aiAgent",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "purpose",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
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
    "name": "syncedReputationAgents",
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
    "name": "syncedReputations",
    "outputs": [
      {
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "totalFeedbacks",
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
        "name": "lastUpdated",
        "type": "uint256"
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
    "name": "syncedValidationIds",
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
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "syncedValidations",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "approvalsCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "rejectionsCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
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
