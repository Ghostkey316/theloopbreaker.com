/**
 * Vaultfire Transaction Engine
 * Handles gas estimation, transaction signing, and broadcasting
 * for native tokens (ETH, AVAX) and ERC-20 tokens.
 */

// ─── Chain Config ─────────────────────────────────────────────────────────────

export interface ChainConfig {
  id: "ethereum" | "base" | "avalanche";
  chainId: number;
  name: string;
  rpc: string;
  symbol: string;
  explorerTx: string;
  color: string;
}

export const TX_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: "ethereum",
    chainId: 1,
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    symbol: "ETH",
    explorerTx: "https://etherscan.io/tx/",
    color: "#627EEA",
  },
  base: {
    id: "base",
    chainId: 8453,
    name: "Base",
    rpc: "https://mainnet.base.org",
    symbol: "ETH",
    explorerTx: "https://basescan.org/tx/",
    color: "#0052FF",
  },
  avalanche: {
    id: "avalanche",
    chainId: 43114,
    name: "Avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    symbol: "AVAX",
    explorerTx: "https://snowtrace.io/tx/",
    color: "#E84142",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  estimatedFeeWei: bigint;
  estimatedFeeFormatted: string;
  isEIP1559: boolean;
}

export interface TxResult {
  hash: string;
  explorerUrl: string;
}

// ─── JSON-RPC ─────────────────────────────────────────────────────────────────

async function jsonRpc(
  rpc: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const data = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Gas Estimation ───────────────────────────────────────────────────────────

function formatWeiToNative(wei: bigint, decimals = 6): string {
  const divisor = BigInt(10 ** 18);
  const whole = wei / divisor;
  const remainder = wei % divisor;
  const fracStr = remainder.toString().padStart(18, "0").slice(0, decimals);
  return `${whole}.${fracStr}`;
}

export async function estimateGas(
  chain: ChainConfig,
  from: string,
  to: string,
  value: bigint,
  data: string = "0x"
): Promise<GasEstimate> {
  const rpc = chain.rpc;

  // Get gas limit estimate
  const gasLimitHex = (await jsonRpc(rpc, "eth_estimateGas", [
    { from, to, value: `0x${value.toString(16)}`, data },
  ])) as string;
  const gasLimit = BigInt(gasLimitHex) * BigInt(12) / BigInt(10); // +20% buffer

  // Try EIP-1559 first
  try {
    const feeHistory = (await jsonRpc(rpc, "eth_feeHistory", [
      "0x5",
      "latest",
      [50],
    ])) as {
      baseFeePerGas: string[];
      reward: string[][];
    };

    const latestBaseFee = BigInt(
      feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1]
    );
    const priorityFees = feeHistory.reward.map((r) => BigInt(r[0]));
    const avgPriority =
      priorityFees.reduce((a, b) => a + b, BigInt(0)) /
      BigInt(priorityFees.length);

    const maxPriorityFeePerGas = avgPriority > BigInt(0) ? avgPriority : BigInt(1_500_000_000); // 1.5 gwei min
    const maxFeePerGas = latestBaseFee * BigInt(2) + maxPriorityFeePerGas;
    const estimatedFeeWei = gasLimit * maxFeePerGas;

    return {
      gasLimit,
      gasPrice: maxFeePerGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedFeeWei,
      estimatedFeeFormatted: formatWeiToNative(estimatedFeeWei),
      isEIP1559: true,
    };
  } catch {
    // Fallback to legacy gas price
    const gasPriceHex = (await jsonRpc(rpc, "eth_gasPrice", [])) as string;
    const gasPrice = BigInt(gasPriceHex);
    const estimatedFeeWei = gasLimit * gasPrice;
    return {
      gasLimit,
      gasPrice,
      estimatedFeeWei,
      estimatedFeeFormatted: formatWeiToNative(estimatedFeeWei),
      isEIP1559: false,
    };
  }
}

// ─── ERC-20 Transfer Encoding ─────────────────────────────────────────────────

export function encodeERC20Transfer(to: string, amount: bigint): string {
  // transfer(address,uint256) selector = 0xa9059cbb
  const selector = "a9059cbb";
  const toEncoded = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountEncoded = amount.toString(16).padStart(64, "0");
  return `0x${selector}${toEncoded}${amountEncoded}`;
}

// ─── Get Nonce ────────────────────────────────────────────────────────────────

export async function getNonce(chain: ChainConfig, address: string): Promise<number> {
  const result = (await jsonRpc(chain.rpc, "eth_getTransactionCount", [
    address,
    "latest",
  ])) as string;
  return parseInt(result, 16);
}

// ─── Transaction Signing & Sending ───────────────────────────────────────────

export async function sendNativeToken(
  chain: ChainConfig,
  privateKey: string,
  from: string,
  to: string,
  amountEther: string
): Promise<TxResult> {
  const { ethers } = await import("ethers");

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  const amountWei = ethers.parseEther(amountEther);
  const gasEstimate = await estimateGas(chain, from, to, amountWei);

  const txRequest: {
    to: string; value: bigint; gasLimit: bigint; chainId: number;
    maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint;
  } = {
    to,
    value: amountWei,
    gasLimit: gasEstimate.gasLimit,
    chainId: chain.chainId,
  };

  if (gasEstimate.isEIP1559 && gasEstimate.maxFeePerGas && gasEstimate.maxPriorityFeePerGas) {
    txRequest.maxFeePerGas = gasEstimate.maxFeePerGas;
    txRequest.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;
  } else {
    txRequest.gasPrice = gasEstimate.gasPrice;
  }

  const tx = await wallet.sendTransaction(txRequest);
  return {
    hash: tx.hash,
    explorerUrl: `${chain.explorerTx}${tx.hash}`,
  };
}

export async function sendERC20Token(
  chain: ChainConfig,
  privateKey: string,
  from: string,
  tokenAddress: string,
  to: string,
  amount: bigint
): Promise<TxResult> {
  const { ethers } = await import("ethers");

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  const data = encodeERC20Transfer(to, amount);
  const gasEstimate = await estimateGas(chain, from, tokenAddress, BigInt(0), data);

  const txRequest: {
    to: string; value: bigint; data: string; gasLimit: bigint; chainId: number;
    maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint;
  } = {
    to: tokenAddress,
    value: BigInt(0),
    data,
    gasLimit: gasEstimate.gasLimit,
    chainId: chain.chainId,
  };

  if (gasEstimate.isEIP1559 && gasEstimate.maxFeePerGas && gasEstimate.maxPriorityFeePerGas) {
    txRequest.maxFeePerGas = gasEstimate.maxFeePerGas;
    txRequest.maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;
  } else {
    txRequest.gasPrice = gasEstimate.gasPrice;
  }

  const tx = await wallet.sendTransaction(txRequest);
  return {
    hash: tx.hash,
    explorerUrl: `${chain.explorerTx}${tx.hash}`,
  };
}

// ─── Gas Estimate for UI ──────────────────────────────────────────────────────

export async function estimateNativeSendGas(
  chain: ChainConfig,
  from: string,
  to: string,
  amountEther: string
): Promise<GasEstimate> {
  const { ethers } = await import("ethers");
  const amountWei = ethers.parseEther(amountEther || "0");
  return estimateGas(chain, from, to, amountWei);
}

export async function estimateERC20SendGas(
  chain: ChainConfig,
  from: string,
  tokenAddress: string,
  to: string,
  amount: bigint
): Promise<GasEstimate> {
  const data = encodeERC20Transfer(to, amount);
  return estimateGas(chain, from, tokenAddress, BigInt(0), data);
}
