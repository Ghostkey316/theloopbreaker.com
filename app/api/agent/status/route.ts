/**
 * GET /api/agent/status?address=0x...&chain=base
 *
 * Check if a wallet address is registered on-chain, its bond status, and reputation.
 * Uses verified selector: getAgent(address) → 0xfb3551ff
 *
 * Query params:
 *   - address: string (required — wallet address)
 *   - chain: "base" | "avalanche" | "ethereum" (default: "base")
 */

import { NextRequest, NextResponse } from 'next/server';

const REGISTRY: Record<string, string> = {
  base: '0x35978DB675576598F0781dA2133E94cdCf4858bC',
  avalanche: '0x57741F4116925341d8f7Eb3F381d98e07C73B4a3',
  ethereum: '0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C',
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

function encodeAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function decodeAgentResponse(hex: string): { name: string; description: string } | null {
  try {
    if (!hex || hex === '0x' || hex.length < 130) return null;
    const data = hex.slice(2);
    const nameOffset = parseInt(data.slice(0, 64), 16) * 2;
    if (nameOffset >= data.length) return null;
    const nameLength = parseInt(data.slice(nameOffset, nameOffset + 64), 16);
    if (nameLength === 0) return null;
    const nameHex = data.slice(nameOffset + 64, nameOffset + 64 + nameLength * 2);
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
      nameBytes[i] = parseInt(nameHex.slice(i * 2, i * 2 + 2), 16);
    }
    const name = new TextDecoder().decode(nameBytes);

    let description = '';
    const descOffset = parseInt(data.slice(64, 128), 16) * 2;
    if (descOffset < data.length) {
      const descLength = parseInt(data.slice(descOffset, descOffset + 64), 16);
      if (descLength > 0 && descOffset + 64 + descLength * 2 <= data.length) {
        const descHex = data.slice(descOffset + 64, descOffset + 64 + descLength * 2);
        const descBytes = new Uint8Array(descLength);
        for (let i = 0; i < descLength; i++) {
          descBytes[i] = parseInt(descHex.slice(i * 2, i * 2 + 2), 16);
        }
        description = new TextDecoder().decode(descBytes);
      }
    }
    return { name, description };
  } catch {
    return null;
  }
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(12000),
  });
  return res.json();
}

function getBondTier(ethAmount: number): string | null {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  if (ethAmount >= 0.01) return 'bronze';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain') || 'base';

    if (!address) {
      return NextResponse.json({ error: 'Missing required query param: address' }, { status: 400 });
    }

    if (!['base', 'avalanche', 'ethereum'].includes(chain)) {
      return NextResponse.json({ error: 'Invalid chain' }, { status: 400 });
    }

    const rpc = RPC_URLS[chain];
    const registry = REGISTRY[chain];

    // Query on-chain identity: getAgent(address) → 0xfb3551ff
    const calldata = '0xfb3551ff' + encodeAddress(address);
    const result = await rpcCall(rpc, 'eth_call', [
      { to: registry, data: calldata },
      'latest',
    ]);

    let registered = false;
    let name: string | null = null;
    let description: string | null = null;
    let identityType = 'unknown';

    if (result.result && result.result !== '0x' && !result.error) {
      const decoded = decodeAgentResponse(result.result);
      if (decoded?.name) {
        registered = true;
        name = decoded.name;
        description = decoded.description;
        try {
          const meta = JSON.parse(decoded.description);
          identityType = meta.type || 'agent';
          description = meta.desc || decoded.description;
        } catch {
          identityType = 'agent';
        }
      }
    }

    // Check bond contract balance
    const bondContract = PARTNERSHIP_BONDS[chain];
    const balanceResult = await rpcCall(rpc, 'eth_getBalance', [bondContract, 'latest']);
    const bondBalance = balanceResult.result ? Number(BigInt(balanceResult.result)) / 1e18 : 0;
    const bondTier = getBondTier(bondBalance);

    // Calculate trust score
    let trustScore = 0;
    if (registered) trustScore += 40;
    if (bondBalance > 0) trustScore += 30;
    if (bondTier === 'gold' || bondTier === 'platinum') trustScore += 20;
    if (chain === 'base') trustScore += 10;

    return NextResponse.json({
      address,
      chain,
      registered,
      vnsName: name ? `${name}.vns` : null,
      identityType,
      description,
      hasBond: bondBalance > 0 && registered,
      bondTier: registered ? bondTier : null,
      bondAmountEth: bondBalance,
      trustScore: Math.min(trustScore, 100),
      explorerUrl: `${chain === 'base' ? 'https://basescan.org' : chain === 'avalanche' ? 'https://snowtrace.io' : 'https://etherscan.io'}/address/${address}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
