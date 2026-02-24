/**
 * POST /api/agent/bond
 *
 * Stake a bond for an AI agent on AIPartnershipBondsV2.
 * Uses verified selector: createBond(address,string) payable → 0x7ac5113b
 *
 * Body:
 *   - walletAddress: string (0x... — the wallet paying the bond)
 *   - privateKey: string (0x... — used server-side to sign tx, never stored)
 *   - agentAddress: string (0x... — the agent receiving the bond)
 *   - amountEth: number (bond amount in ETH, min 0.01)
 *   - partnershipType?: string (default: "agent:{address}")
 *   - chain?: "base" | "avalanche" | "ethereum" (default: "base")
 *
 * Bond tiers:
 *   Bronze:   0.01+ ETH
 *   Silver:   0.05+ ETH
 *   Gold:     0.1+  ETH
 *   Platinum: 0.5+  ETH
 */

import { NextRequest, NextResponse } from 'next/server';

const BOND_CONTRACTS: Record<string, string> = {
  base: '0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1',
  avalanche: '0x37679B1dCfabE6eA6b8408626815A1426bE2D717',
  ethereum: '0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1',
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

function encodeAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}
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

function getBondTier(ethAmount: number): string {
  if (ethAmount >= 0.5) return 'platinum';
  if (ethAmount >= 0.1) return 'gold';
  if (ethAmount >= 0.05) return 'silver';
  return 'bronze';
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
      walletAddress,
      privateKey,
      agentAddress,
      amountEth,
      partnershipType,
      chain = 'base',
    } = body;

    if (!walletAddress || !privateKey || !agentAddress || !amountEth) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, privateKey, agentAddress, amountEth' },
        { status: 400 },
      );
    }

    if (typeof amountEth !== 'number' || amountEth < 0.01) {
      return NextResponse.json({ error: 'Minimum bond is 0.01 ETH' }, { status: 400 });
    }

    const validChains = ['base', 'avalanche', 'ethereum'];
    if (!validChains.includes(chain)) {
      return NextResponse.json({ error: 'Invalid chain' }, { status: 400 });
    }

    const rpc = RPC_URLS[chain];
    const bondContract = BOND_CONTRACTS[chain];
    const chainId = CHAIN_IDS[chain];
    const bondWei = BigInt(Math.floor(amountEth * 1e18));

    // Encode calldata: createBond(address, string) → 0x7ac5113b
    const addressParam = encodeAddress(agentAddress);
    const stringOffset = encodeUint256(0x40); // 2 slots: address + offset
    const pType = partnershipType || `agent:${agentAddress.slice(0, 10)}`;
    const stringEncoded = encodeString(pType);
    const calldata = '0x7ac5113b' + addressParam + stringOffset + stringEncoded;

    const [nonceResult, gasPriceResult] = await Promise.all([
      rpcCall(rpc, 'eth_getTransactionCount', [walletAddress, 'latest']),
      rpcCall(rpc, 'eth_gasPrice', []),
    ]);

    if (!nonceResult.result || !gasPriceResult.result) {
      return NextResponse.json({ error: 'RPC error' }, { status: 502 });
    }

    const nonce = parseInt(nonceResult.result, 16);
    const gasPrice = BigInt(gasPriceResult.result);

    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const tx = {
      to: bondContract,
      data: calldata,
      nonce,
      gasLimit: 200000n,
      gasPrice,
      chainId,
      value: bondWei,
    };

    const signedTx = await wallet.signTransaction(tx);
    const sendResult = await rpcCall(rpc, 'eth_sendRawTransaction', [signedTx]);

    if (sendResult.error || !sendResult.result) {
      return NextResponse.json(
        { error: sendResult.error?.message || 'Bond staking failed' },
        { status: 500 },
      );
    }

    const tier = getBondTier(amountEth);
    return NextResponse.json({
      success: true,
      txHash: sendResult.result,
      explorerUrl: `${EXPLORER_URLS[chain]}/tx/${sendResult.result}`,
      chain,
      tier,
      amountEth,
      message: `Bond staked: ${amountEth} ETH (${tier} tier)`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
