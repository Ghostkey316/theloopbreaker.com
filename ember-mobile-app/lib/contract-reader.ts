/**
 * Contract Reader Service
 * Reads data from Vaultfire Protocol contracts using JSON-RPC
 */

import { CHAINS } from "@/constants/contracts";

// ERC-8004 Registry ABIs (minimal, just what we need)
const ERC8004_REGISTRY_ABI = [
  {
    name: "getAgentCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "tuple", components: [{ type: "address" }, { type: "string" }, { type: "uint256" }] }],
  },
];

// Simple function selector encoding (first 4 bytes of keccak256 hash)
function encodeSelector(signature: string): string {
  // For demo purposes, use known selectors
  const selectors: Record<string, string> = {
    "getAgentCount()": "0x0f755a56",
    "getAgent(address)": "0x2b82f94e",
  };
  return selectors[signature] || "0x";
}

async function jsonRpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<unknown> {
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

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export async function getContractBalance(
  chain: "base" | "avalanche",
  address: string
): Promise<{ balance: string; balanceEth: string }> {
  const rpc = CHAINS[chain].rpc;
  try {
    const balanceHex = (await jsonRpcCall(rpc, "eth_getBalance", [address, "latest"])) as string;
    const balance = BigInt(balanceHex).toString();
    const balanceEth = (BigInt(balanceHex) / BigInt(10 ** 18)).toString();
    return { balance, balanceEth };
  } catch (error) {
    throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function callContractFunction(
  chain: "base" | "avalanche",
  contractAddress: string,
  functionSignature: string,
  params: string[] = []
): Promise<string> {
  const rpc = CHAINS[chain].rpc;
  try {
    const selector = encodeSelector(functionSignature);
    let callData = selector;

    // Encode parameters (simplified for common types)
    for (const param of params) {
      // Pad address to 32 bytes
      if (param.startsWith("0x") && param.length === 42) {
        callData += param.slice(2).padStart(64, "0");
      } else if (param.startsWith("0x")) {
        callData += param.slice(2).padStart(64, "0");
      } else {
        // Treat as number
        callData += BigInt(param).toString(16).padStart(64, "0");
      }
    }

    const result = (await jsonRpcCall(rpc, "eth_call", [
      {
        to: contractAddress,
        data: callData,
      },
      "latest",
    ])) as string;

    return result;
  } catch (error) {
    throw new Error(`Contract call failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function getAgentCount(
  chain: "base" | "avalanche",
  registryAddress: string
): Promise<number> {
  try {
    const result = await callContractFunction(chain, registryAddress, "getAgentCount()");
    // Parse result (first 32 bytes = uint256)
    const count = BigInt(result).toString();
    return parseInt(count, 10);
  } catch (error) {
    console.error("Failed to get agent count:", error);
    return 0;
  }
}

export async function checkContractAlive(
  chain: "base" | "avalanche",
  address: string
): Promise<boolean> {
  const rpc = CHAINS[chain].rpc;
  try {
    const code = (await jsonRpcCall(rpc, "eth_getCode", [address, "latest"])) as string;
    return code !== "0x" && code.length > 2;
  } catch {
    return false;
  }
}

export async function getMultipleContractStatus(
  chain: "base" | "avalanche",
  addresses: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const rpc = CHAINS[chain].rpc;

  try {
    // Batch check all contracts
    const promises = addresses.map((addr) =>
      jsonRpcCall(rpc, "eth_getCode", [addr, "latest"])
        .then((code) => {
          const codeStr = code as string;
          results[addr] = codeStr !== "0x" && codeStr.length > 2;
        })
        .catch(() => {
          results[addr] = false;
        })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error("Batch contract check failed:", error);
  }

  return results;
}

export async function getTeleporterBridgeStats(
  chain: "base" | "avalanche",
  bridgeAddress: string
): Promise<{
  isAlive: boolean;
  messageCount: number;
  relayerCount: number;
}> {
  try {
    const isAlive = await checkContractAlive(chain, bridgeAddress);

    // For demo: return estimated stats based on contract being alive
    // In production, these would be read from contract state variables
    if (!isAlive) {
      return { isAlive: false, messageCount: 0, relayerCount: 0 };
    }

    // Simulated stats (in real app, read from contract storage)
    return {
      isAlive: true,
      messageCount: Math.floor(Math.random() * 10000) + 1000,
      relayerCount: Math.floor(Math.random() * 50) + 5,
    };
  } catch (error) {
    console.error("Failed to get bridge stats:", error);
    return { isAlive: false, messageCount: 0, relayerCount: 0 };
  }
}

export async function getGovernanceProposalCount(
  chain: "base" | "avalanche",
  governanceAddress: string
): Promise<number> {
  try {
    const isAlive = await checkContractAlive(chain, governanceAddress);
    if (!isAlive) return 0;

    // Simulated proposal count (in real app, read from contract)
    return Math.floor(Math.random() * 100) + 10;
  } catch (error) {
    console.error("Failed to get proposal count:", error);
    return 0;
  }
}
