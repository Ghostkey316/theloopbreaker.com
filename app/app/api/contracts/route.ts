/**
 * GET /api/contracts
 *
 * Return all Embris by Vaultfire Protocol contract addresses across all 3 chains.
 * 15 contracts per chain, 45 total.
 *
 * Contract names match the canonical names used in contracts.ts and on-chain deployments.
 */

import { NextResponse } from 'next/server';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS, CHAINS } from '../../lib/contracts';

function buildChainEntry(
  chain: 'base' | 'avalanche' | 'ethereum',
  contracts: { name: string; address: string }[],
) {
  const config = CHAINS[chain];
  const contractMap: Record<string, string> = {};
  for (const c of contracts) {
    contractMap[c.name] = c.address;
  }
  return {
    chainId: config.id,
    rpc: config.rpcUrls.default.http[0],
    explorer: config.explorerUrl,
    contracts: contractMap,
  };
}

const CONTRACTS = {
  ethereum: buildChainEntry('ethereum', ETHEREUM_CONTRACTS),
  base: buildChainEntry('base', BASE_CONTRACTS),
  avalanche: buildChainEntry('avalanche', AVALANCHE_CONTRACTS),
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
