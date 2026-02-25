// ABI for VaultfireERC8004Adapter on ethereum
// Auto-fetched from Etherscan V2 API
export const VaultfireERC8004Adapter_ethereum_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_partnershipBonds",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_identityRegistry",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_reputationRegistry",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_validationRegistry",
        "type": "address"
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
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "AgentAutoRegistered",
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
        "indexed": true,
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "rating",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "PartnershipReputationSynced",
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
        "indexed": true,
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "ValidationRequestCreated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "autoRegisteredAgents",
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
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "bondReputationSynced",
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
    "name": "discoverVaultfireAgents",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "agentType",
        "type": "string"
      }
    ],
    "name": "discoverVaultfireAgents",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "agentAddress",
        "type": "address"
      }
    ],
    "name": "getAgentCrossPlatformReputation",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "vaultfireRating",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "erc8004Rating",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalFeedbacks",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "verifiedPercentage",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "identityRegistry",
    "outputs": [
      {
        "internalType": "contract ERC8004IdentityRegistry",
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
        "name": "agentAddress",
        "type": "address"
      }
    ],
    "name": "isAgentFullyRegistered",
    "outputs": [
      {
        "internalType": "bool",
        "name": "registeredERC8004",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "registeredVaultFire",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "partnershipBonds",
    "outputs": [
      {
        "internalType": "contract AIPartnershipBondsV2",
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
        "internalType": "string",
        "name": "agentURI",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "agentType",
        "type": "string"
      }
    ],
    "name": "registerAgentForPartnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reputationRegistry",
    "outputs": [
      {
        "internalType": "contract ERC8004ReputationRegistry",
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
        "internalType": "uint256",
        "name": "bondId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "claimURI",
        "type": "string"
      },
      {
        "internalType": "enum ERC8004ValidationRegistry.ValidationType",
        "name": "validationType",
        "type": "uint8"
      }
    ],
    "name": "requestPartnershipValidation",
    "outputs": [],
    "stateMutability": "payable",
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
    "name": "syncPartnershipReputation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "validationRegistry",
    "outputs": [
      {
        "internalType": "contract ERC8004ValidationRegistry",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
