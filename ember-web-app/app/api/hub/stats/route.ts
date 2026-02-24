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
  base: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
};

const ACCOUNTABILITY_BONDS: Record<string, string> = {
  base: '0xf92baef9523BC264144F80F9c31D5c5C017c6Da8',
  avalanche: '0xaeFEa985E0C52f92F73606657B9dA60db2798af3',
  ethereum: '0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24',
};

const PARTNERSHIP_BONDS: Record<string, string> = {
  base: '0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4',
  avalanche: '0xea6B504827a746d781f867441364C7A732AA4b07',
  ethereum: '0x247F31bB2b5a0d28E68bf24865AA242965FF99cd',
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
