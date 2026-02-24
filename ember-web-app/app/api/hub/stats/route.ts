/**
 * GET /api/hub/stats
 *
 * Get current Agent Hub statistics — live from all three chains.
 * No hardcoded data. Every number comes from the blockchain.
 *
 * Uses verified selector: getTotalAgents() → 0x3731a16f
 */

import { NextResponse } from 'next/server';

const REGISTRY: Record<string, string> = {
  base: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  avalanche: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
  ethereum: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
};

const ACCOUNTABILITY_BONDS: Record<string, string> = {
  base: '0xDfc66395A4742b5168712a04942C90B99394aEEb',
  avalanche: '0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192',
  ethereum: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
};

const PARTNERSHIP_BONDS: Record<string, string> = {
  base: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  avalanche: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
  ethereum: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
};

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

async function getAgentCount(chain: string): Promise<number> {
  try {
    const result = await rpcCall(RPC_URLS[chain], 'eth_call', [
      { to: REGISTRY[chain], data: '0x3731a16f' }, // getTotalAgents()
      'latest',
    ]);
    if (!result.result || result.error) return 0;
    return parseInt(result.result, 16);
  } catch {
    return 0;
  }
}

async function getBondBalance(chain: string): Promise<number> {
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
        identityRegistry: REGISTRY,
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
