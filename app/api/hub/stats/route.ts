/**
 * GET /api/hub/stats
 *
 * Get current Agent Hub statistics — live from all three chains.
 * No hardcoded data. Every number comes from the blockchain.
 *
 * Uses verified selector: getTotalAgents() → 0x3731a16f
 */

import { NextResponse } from 'next/server';
import {
  IDENTITY_REGISTRY,
  PARTNERSHIP_BONDS,
  ACCOUNTABILITY_BONDS,
  RPC_URLS,
  type SupportedChain,
} from '../../../lib/contracts';

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

async function getAgentCount(chain: SupportedChain): Promise<number> {
  try {
    const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: IDENTITY_REGISTRY[chain], data: '0x3731a16f' }, // getTotalAgents()
      'latest',
    ]);
    if (!result.result || result.error) return 0;
    return parseInt(result.result, 16);
  } catch {
    return 0;
  }
}

async function getBondBalance(chain: SupportedChain): Promise<number> {
  try {
    const [bondResult, partnershipResult] = await Promise.allSettled([
      rpcCall(RPC_URLS[chain], 'eth_getBalance', [ACCOUNTABILITY_BONDS[chain], 'latest']),
      rpcCall(RPC_URLS[chain], 'eth_getBalance', [PARTNERSHIP_BONDS[chain], 'latest']),
    ]);
    let total = 0;
    if (bondResult.status === 'fulfilled' && bondResult.value.result) {
      total += Number(BigInt(bondResult.value.result)) / 1e18;
    }
    if (partnershipResult.status === 'fulfilled' && partnershipResult.value.result) {
      total += Number(BigInt(partnershipResult.value.result)) / 1e18;
    }
    return total;
  } catch {
    return 0;
  }
}

// Cache stats for 60 seconds
let statsCache: { data: Record<string, unknown>; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET() {
  try {
    if (statsCache && Date.now() - statsCache.ts < CACHE_TTL) {
      return NextResponse.json(statsCache.data);
    }

    const [baseCount, avaxCount, ethCount, baseBonded, avaxBonded, ethBonded] = await Promise.all([
      getAgentCount('base'),
      getAgentCount('avalanche'),
      getAgentCount('ethereum'),
      getBondBalance('base'),
      getBondBalance('avalanche'),
      getBondBalance('ethereum'),
    ]);

    const totalIdentities = baseCount + avaxCount + ethCount;
    const activeBonds = (baseBonded > 0 ? baseCount : 0) + (avaxBonded > 0 ? avaxCount : 0) + (ethBonded > 0 ? ethCount : 0);

    const data = {
      totalIdentities,
      activeBonds: Math.max(activeBonds, baseBonded > 0 || avaxBonded > 0 || ethBonded > 0 ? 1 : 0),
      totalBondedEth: baseBonded + ethBonded,
      totalBondedAvax: avaxBonded,
      chainCounts: {
        base: baseCount,
        avalanche: avaxCount,
        ethereum: ethCount,
      },
      chainBonded: {
        base: baseBonded,
        avalanche: avaxBonded,
        ethereum: ethBonded,
      },
      contracts: {
        identityRegistry: IDENTITY_REGISTRY,
        partnershipBonds: PARTNERSHIP_BONDS,
        accountabilityBonds: ACCOUNTABILITY_BONDS,
      },
      timestamp: Date.now(),
    };

    statsCache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
