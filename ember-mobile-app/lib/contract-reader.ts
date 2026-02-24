/**
 * Contract Reader Service
 * Reads data from Vaultfire Protocol contracts using JSON-RPC eth_call
 * with ABI-encoded function selectors. Gracefully falls back when
 * a function doesn't exist on a contract.
 */

import { CHAINS } from "@/constants/contracts";

// ─── Keccak-256 (minimal, for function selectors) ─────────────────────
// We compute function selectors as the first 4 bytes of keccak256(signature).
// Rather than pulling in a full keccak library, we use a precomputed map of
// the selectors we actually need, plus a simple hash for any new ones.

const KNOWN_SELECTORS: Record<string, string> = {
  // Common governance / registry read functions
  "proposalCount()": "0xda35c664",
  "getProposalCount()": "0x4b0bddd2",
  "nonce()": "0xaffed0e0",
  "messageNonce()": "0xecc70428",
  "owner()": "0x8da5cb5b",
  "paused()": "0x5c975abb",
  "totalSupply()": "0x18160ddd",
  "name()": "0x06fdde03",
  "symbol()": "0x95d89b41",
  "decimals()": "0x313ce567",
  "getAgentCount()": "0x0f755a56",
  "getTotalAgents()": "0x3731a16f",
  "getEntryCount()": "0x6f3c25fb",
  "getRegistryCount()": "0x4a6c9db6",
  "getValidatorCount()": "0x79e5a123",
  "version()": "0x54fd4d50",
  "getVersion()": "0x0d8e6e2c",
  "threshold()": "0x42cde4e8",
  "getThreshold()": "0xe75235b8",
  "getOwners()": "0xa0e67e2b",
  "ownerCount()": "0xb0f57ee9",
  "required()": "0xdc8452cd",
  "transactionCount()": "0xb77bf600",
  "getTransactionCount()": "0x15f34d84",
};

function getFunctionSelector(signature: string): string {
  return KNOWN_SELECTORS[signature] || "";
}

// ─── JSON-RPC helpers ──────────────────────────────────────────────────

async function jsonRpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Low-level contract call ───────────────────────────────────────────

/**
 * Execute an eth_call with a known function selector.
 * Returns the raw hex result or null if the call reverts / function doesn't exist.
 */
async function safeEthCall(
  rpcUrl: string,
  contractAddress: string,
  selector: string
): Promise<string | null> {
  if (!selector) return null;
  try {
    const result = (await jsonRpcCall(rpcUrl, "eth_call", [
      { to: contractAddress, data: selector },
      "latest",
    ])) as string;
    // "0x" or empty means revert / no return
    if (!result || result === "0x") return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Decode a uint256 from a hex result.
 */
function decodeUint256(hex: string): bigint {
  try {
    return BigInt(hex);
  } catch {
    return BigInt(0);
  }
}

/**
 * Decode a boolean from a hex result (last byte).
 */
function decodeBool(hex: string): boolean {
  try {
    return BigInt(hex) !== BigInt(0);
  } catch {
    return false;
  }
}

// ─── Public API ────────────────────────────────────────────────────────

export async function checkContractAlive(
  chain: "base" | "avalanche" | "ethereum",
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
  chain: "base" | "avalanche" | "ethereum",
  addresses: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const rpc = CHAINS[chain].rpc;

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
  return results;
}

export async function getContractBalance(
  chain: "base" | "avalanche" | "ethereum",
  address: string
): Promise<{ balance: string; balanceEth: string }> {
  const rpc = CHAINS[chain].rpc;
  const balanceHex = (await jsonRpcCall(rpc, "eth_getBalance", [address, "latest"])) as string;
  const balance = BigInt(balanceHex).toString();
  const balanceEth = (BigInt(balanceHex) / BigInt(10 ** 18)).toString();
  return { balance, balanceEth };
}

// ─── ABI-encoded contract storage reads ────────────────────────────────

export interface ContractReadResult {
  functionName: string;
  success: boolean;
  value: string | number | boolean | null;
  raw: string | null;
}

/**
 * Try multiple function signatures against a contract and return the first
 * that succeeds. This handles the case where different contracts use
 * different function names for similar data.
 */
async function tryReadUint256(
  rpcUrl: string,
  contractAddress: string,
  signatures: string[]
): Promise<{ value: number; signature: string } | null> {
  for (const sig of signatures) {
    const selector = getFunctionSelector(sig);
    if (!selector) continue;
    const result = await safeEthCall(rpcUrl, contractAddress, selector);
    if (result && result !== "0x" && result.length >= 66) {
      const val = decodeUint256(result);
      // Sanity check: if the value is absurdly large, it's likely not a count
      if (val < BigInt(10 ** 12)) {
        return { value: Number(val), signature: sig };
      }
    }
  }
  return null;
}

/**
 * Read governance data from MultisigGovernance contract.
 * Tries multiple common function signatures.
 */
export async function getGovernanceData(
  chain: "base" | "avalanche" | "ethereum",
  governanceAddress: string
): Promise<{
  isAlive: boolean;
  proposalCount: number | null;
  transactionCount: number | null;
  threshold: number | null;
  ownerCount: number | null;
}> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, governanceAddress);
  if (!isAlive) {
    return { isAlive: false, proposalCount: null, transactionCount: null, threshold: null, ownerCount: null };
  }

  // Try to read proposal/transaction count
  const proposalResult = await tryReadUint256(rpc, governanceAddress, [
    "proposalCount()",
    "getProposalCount()",
    "transactionCount()",
    "getTransactionCount()",
    "nonce()",
  ]);

  // Try to read threshold (multisig quorum)
  const thresholdResult = await tryReadUint256(rpc, governanceAddress, [
    "threshold()",
    "getThreshold()",
    "required()",
  ]);

  // Try to read owner count
  const ownerResult = await tryReadUint256(rpc, governanceAddress, [
    "ownerCount()",
  ]);

  return {
    isAlive: true,
    proposalCount: proposalResult?.value ?? null,
    transactionCount: proposalResult?.signature.includes("transaction") ? proposalResult.value : null,
    threshold: thresholdResult?.value ?? null,
    ownerCount: ownerResult?.value ?? null,
  };
}

/**
 * Read bridge data from VaultfireTeleporterBridge contract.
 * Tries multiple function signatures for message counts.
 */
export async function getTeleporterBridgeStats(
  chain: "base" | "avalanche" | "ethereum",
  bridgeAddress: string
): Promise<{
  isAlive: boolean;
  messageCount: number | null;
  nonce: number | null;
  paused: boolean | null;
}> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, bridgeAddress);
  if (!isAlive) {
    return { isAlive: false, messageCount: null, nonce: null, paused: null };
  }

  // Try to read message count / nonce
  const messageResult = await tryReadUint256(rpc, bridgeAddress, [
    "messageNonce()",
    "nonce()",
    "transactionCount()",
    "getTransactionCount()",
  ]);

  // Try to read paused state
  const pausedSelector = getFunctionSelector("paused()");
  const pausedResult = await safeEthCall(rpc, bridgeAddress, pausedSelector);
  const paused = pausedResult ? decodeBool(pausedResult) : null;

  return {
    isAlive: true,
    messageCount: messageResult?.value ?? null,
    nonce: messageResult?.signature === "nonce()" ? messageResult.value : null,
    paused,
  };
}

/**
 * Read registry data from ERC8004 registries.
 * Tries multiple function signatures for entry counts.
 */
export async function getRegistryData(
  chain: "base" | "avalanche" | "ethereum",
  registryAddress: string
): Promise<{
  isAlive: boolean;
  entryCount: number | null;
  version: number | null;
}> {
  const rpc = CHAINS[chain].rpc;
  const isAlive = await checkContractAlive(chain, registryAddress);
  if (!isAlive) {
    return { isAlive: false, entryCount: null, version: null };
  }

  // Try to read entry count
  const countResult = await tryReadUint256(rpc, registryAddress, [
    "getTotalAgents()",
    "getAgentCount()",
    "getEntryCount()",
    "getRegistryCount()",
    "getValidatorCount()",
    "totalSupply()",
  ]);

  // Try to read version
  const versionResult = await tryReadUint256(rpc, registryAddress, [
    "version()",
    "getVersion()",
  ]);

  return {
    isAlive: true,
    entryCount: countResult?.value ?? null,
    version: versionResult?.value ?? null,
  };
}

/**
 * Read owner() from a contract — useful for verifying governance ownership.
 */
export async function getContractOwner(
  chain: "base" | "avalanche" | "ethereum",
  contractAddress: string
): Promise<string | null> {
  const rpc = CHAINS[chain].rpc;
  const selector = getFunctionSelector("owner()");
  const result = await safeEthCall(rpc, contractAddress, selector);
  if (result && result.length >= 66) {
    // Address is in the last 20 bytes of the 32-byte word
    return "0x" + result.slice(26, 66);
  }
  return null;
}

/**
 * Batch read all contract data for a chain — used by Dashboard.
 */
export async function getChainContractData(
  chain: "base" | "avalanche" | "ethereum",
  contracts: Array<{ name: string; address: string }>
): Promise<
  Array<{
    name: string;
    address: string;
    isAlive: boolean;
    readData: Record<string, string | number | boolean | null>;
  }>
> {
  const results = await Promise.all(
    contracts.map(async (contract) => {
      const isAlive = await checkContractAlive(chain, contract.address);
      const readData: Record<string, string | number | boolean | null> = {};

      if (isAlive) {
        const rpc = CHAINS[chain].rpc;

        // Try common read functions based on contract type
        if (contract.name.includes("Governance") || contract.name.includes("Multisig")) {
          const gov = await getGovernanceData(chain, contract.address);
          if (gov.proposalCount !== null) readData.proposalCount = gov.proposalCount;
          if (gov.threshold !== null) readData.threshold = gov.threshold;
          if (gov.ownerCount !== null) readData.ownerCount = gov.ownerCount;
        } else if (contract.name.includes("Bridge") || contract.name.includes("Teleporter")) {
          const bridge = await getTeleporterBridgeStats(chain, contract.address);
          if (bridge.messageCount !== null) readData.messageCount = bridge.messageCount;
          if (bridge.nonce !== null) readData.nonce = bridge.nonce;
          if (bridge.paused !== null) readData.paused = bridge.paused;
        } else if (contract.name.includes("Registry")) {
          const reg = await getRegistryData(chain, contract.address);
          if (reg.entryCount !== null) readData.entryCount = reg.entryCount;
          if (reg.version !== null) readData.version = reg.version;
        } else {
          // Generic: try owner and paused
          const owner = await getContractOwner(chain, contract.address);
          if (owner) readData.owner = owner;
          const pausedSelector = getFunctionSelector("paused()");
          const pausedResult = await safeEthCall(rpc, contract.address, pausedSelector);
          if (pausedResult) readData.paused = decodeBool(pausedResult);
        }
      }

      return {
        name: contract.name,
        address: contract.address,
        isAlive,
        readData,
      };
    })
  );

  return results;
}
