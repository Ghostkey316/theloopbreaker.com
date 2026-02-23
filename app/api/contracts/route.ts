/**
 * GET /api/contracts
 *
 * Return all Vaultfire Protocol contract addresses across all 3 chains.
 * 15 contracts per chain, 45 total.
 */

import { NextResponse } from 'next/server';

const CONTRACTS = {
  ethereum: {
    chainId: 1,
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    contracts: {
      ERC8004IdentityRegistry: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
      AIAccountabilityBondsV2: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
      AIPartnershipBondsV2: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
      BeliefAttestationVerifier: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05',
      PrivacyGuarantees: '0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709',
      MissionEnforcement: '0xe24Ab41dC93833d63d8dd501C53bED674daa4839',
      ReputationOracle: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
      AgentRegistryV2: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
      GovernanceModule: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
      DilithiumAttestor: '0xE1b9817FC0F10d2676303C7732497E9B593a22de',
      TaskEscrow: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
      DisputeResolver: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
      FeeDistributor: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c',
      CrossChainBridge: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
      ProtocolRegistry: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
    },
  },
  base: {
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    contracts: {
      ERC8004IdentityRegistry: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
      AIAccountabilityBondsV2: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
      AIPartnershipBondsV2: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
      BeliefAttestationVerifier: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
      PrivacyGuarantees: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
      MissionEnforcement: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
      ReputationOracle: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
      AgentRegistryV2: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c',
      GovernanceModule: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
      CrossChainBridge: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
      TaskEscrow: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
      DisputeResolver: '0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709',
      FeeDistributor: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05',
      ProtocolRegistry: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
      DilithiumAttestor: '0xe24Ab41dC93833d63d8dd501C53bED674daa4839',
    },
  },
  avalanche: {
    chainId: 43114,
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
    contracts: {
      ERC8004IdentityRegistry: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
      AIAccountabilityBondsV2: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
      AIPartnershipBondsV2: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
      BeliefAttestationVerifier: '0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55',
      PrivacyGuarantees: '0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C',
      MissionEnforcement: '0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF',
      ReputationOracle: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
      AgentRegistryV2: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
      GovernanceModule: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
      CrossChainBridge: '0xe24Ab41dC93833d63d8dd501C53bED674daa4839',
      TaskEscrow: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
      DisputeResolver: '0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709',
      FeeDistributor: '0xFe122605364f428570c4C0EB2CCAEBb68dD22d05',
      ProtocolRegistry: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
      DilithiumAttestor: '0x5470d8189849675C043fFA7fc451e5F2f4e5532c',
    },
  },
};

export async function GET() {
  return NextResponse.json({
    totalContracts: 45,
    contractsPerChain: 15,
    chains: ['ethereum', 'base', 'avalanche'],
    ...CONTRACTS,
    verifiedSelectors: {
      'registerAgent(string,string,bytes32)': '0x2b3ce0bf',
      'createBond(address,string)': '0x7ac5113b',
      'grantConsent(bytes32)': '0x1c9df7ef',
      'getTotalAgents()': '0x3731a16f',
      'getAgent(address)': '0xfb3551ff',
    },
  });
}
