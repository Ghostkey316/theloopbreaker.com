/**
 * POST /api/agent/register
 *
 * Register an AI agent on the ERC8004IdentityRegistry.
 * Accepts agent metadata and builds the correct calldata for on-chain registration.
 *
 * Body:
 *   - name: string (3-32 chars, lowercase alphanumeric + hyphens)
 *   - walletAddress: string (0x...)
 *   - privateKey: string (0x... — used server-side to sign tx, never stored)
 *   - description?: string (agent description)
 *   - specializations?: string[] (e.g. ["research", "security"])
 *   - capabilities?: string[] (e.g. ["NLP", "Code Generation"])
 *   - identityType?: "human" | "companion" | "agent" (default: "agent")
 *   - chain?: "base" | "avalanche" | "ethereum" (default: "base")
 *
 * Uses verified selector: registerAgent(string,string,bytes32) → 0x2b3ce0bf
 */

import { NextRequest, NextResponse } from 'next/server';

/* ── Contract addresses ── */
const REGISTRY: Record<string, string> = {
  base: '0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5',
  avalanche: '0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5',
  ethereum: '0xaCB59e0f0eA47B25b24390B71b877928E5842630',
};

const CHAIN_IDS: Record<string, number> = { ethereum: 1, base: 8453, avalanche: 43114 };
const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};
const EXPLORER_URLS: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  avalanche: 'https://snowtrace.io',
};

/* ── ABI helpers ── */
function encodeUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, '0');
}
function encodeString(s: string): string {
  const utf8 = new TextEncoder().encode(s);
  const length = encodeUint256(utf8.length);
  const paddedLength = Math.ceil(utf8.length / 32) * 32;
  const padded = new Uint8Array(paddedLength);
  padded.set(utf8);
  let hex = '';
  for (const byte of padded) hex += byte.toString(16).padStart(2, '0');
  return length + hex;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name: rawName,
      walletAddress,
      privateKey,
      description = '',
      specializations = [],
      capabilities = [],
      identityType = 'agent',
      chain = 'base',
    } = body;

    // Validate required fields
    if (!rawName || !walletAddress || !privateKey) {
      return NextResponse.json(
        { error: 'Missing required fields: name, walletAddress, privateKey' },
        { status: 400 },
      );
    }

    const name = rawName.toLowerCase().replace(/\.vns$/, '').trim();
    if (name.length < 3 || name.length > 32) {
      return NextResponse.json({ error: 'Name must be 3-32 characters' }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && !/^[a-z0-9]{1,2}$/.test(name)) {
      return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
    }

    const validChains = ['base', 'avalanche', 'ethereum'];
    if (!validChains.includes(chain)) {
      return NextResponse.json({ error: 'Invalid chain. Use: base, avalanche, ethereum' }, { status: 400 });
    }

    const rpc = RPC_URLS[chain];
    const registry = REGISTRY[chain];
    const chainId = CHAIN_IDS[chain];

    // Build description metadata
    const meta: Record<string, unknown> = { type: identityType, v: 1 };
    if (description) meta.desc = description.slice(0, 200);
    if (specializations.length) meta.spec = specializations;
    if (capabilities.length) meta.caps = capabilities;
    const descJson = JSON.stringify(meta);

    // Build identityHash
    const identityHashHex = Array.from(new TextEncoder().encode(name))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('')
      .padEnd(64, '0')
      .slice(0, 64);

    // Encode calldata: registerAgent(string, string, bytes32) → 0x2b3ce0bf
    const nameEncoded = encodeString(name);
    const descEncoded = encodeString(descJson);
    const offset1 = 0x60;
    const string1Size = nameEncoded.length / 2;
    const offset2 = offset1 + string1Size;

    const calldata = '0x2b3ce0bf'
      + encodeUint256(offset1)
      + encodeUint256(offset2)
      + identityHashHex
      + nameEncoded
      + descEncoded;

    // Get nonce and gas price
    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return NextResponse.json({ error: 'RPC error: could not get nonce or gas price' }, { status: 502 });
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);

    // Estimate gas
    const gasEstResult = await rpcCall(rpc, 'eth_estimateGas', [
      { from: walletAddress, to: registry, data: calldata },
    ]);
    const gasLimit = gasEstResult.result ? BigInt(gasEstResult.result) * 12n / 10n : 300000n;

    // Sign transaction
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = { to: registry, data: calldata, nonce, gasLimit, gasPrice, chainId, value: 0n };
    const signedTx = await wallet.signTransaction(tx);

    // Send
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);
    if (sendResult.error || !sendResult.result) {
      return NextResponse.json(
        { error: sendResult.error?.message || 'Transaction failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${EXPLORER_URLS[chain]}/tx/${sendResult.result}`,
      chain,
      name: `${name}.vns`,
      message: `Agent "${name}.vns" registered on ${chain}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
