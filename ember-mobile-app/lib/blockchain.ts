/**
 * Blockchain connectivity service for Ethereum, Base, and Avalanche RPCs.
 * Uses raw JSON-RPC calls (no ethers.js dependency needed).
 */

import { CHAINS } from "@/constants/contracts";

export interface RPCResult {
  success: boolean;
  blockNumber?: number;
  chainId?: number;
  error?: string;
  latency?: number;
}

async function jsonRpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "RPC error");
  }

  return data.result;
}

export async function getBlockNumber(rpcUrl: string): Promise<number> {
  const result = await jsonRpc(rpcUrl, "eth_blockNumber");
  return parseInt(result as string, 16);
}

export async function getChainId(rpcUrl: string): Promise<number> {
  const result = await jsonRpc(rpcUrl, "eth_chainId");
  return parseInt(result as string, 16);
}

export async function getCode(rpcUrl: string, address: string): Promise<string> {
  const result = await jsonRpc(rpcUrl, "eth_getCode", [address, "latest"]);
  return result as string;
}

export async function checkContractExists(rpcUrl: string, address: string): Promise<boolean> {
  try {
    const code = await getCode(rpcUrl, address);
    return code !== "0x" && code !== "0x0" && code.length > 2;
  } catch {
    return false;
  }
}

export async function checkChainConnectivity(chain: "base" | "avalanche"): Promise<RPCResult> {
  const chainConfig = CHAINS[chain];
  const start = Date.now();

  try {
    const [blockNumber, chainId] = await Promise.all([
      getBlockNumber(chainConfig.rpc),
      getChainId(chainConfig.rpc),
    ]);

    return {
      success: true,
      blockNumber,
      chainId,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      latency: Date.now() - start,
    };
  }
}

export async function checkAllChains(): Promise<Record<string, RPCResult>> {
  const [base, avalanche] = await Promise.all([
    checkChainConnectivity("base"),
    checkChainConnectivity("avalanche"),
  ]);

  return { base, avalanche };
}
