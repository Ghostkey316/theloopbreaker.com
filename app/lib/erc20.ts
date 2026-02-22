/**
 * ERC-20 Token utilities for reading token data and balances across chains.
 * Supports Ethereum, Base, and Avalanche C-Chain.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedChain = "ethereum" | "base" | "avalanche";

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chain: SupportedChain;
  chainId: number;
  coingeckoId?: string; // for price lookup
  logoColor?: string;   // fallback color for icon
}

export interface TokenBalance extends TokenInfo {
  balanceRaw: string;   // raw decimal string from chain
  balanceFormatted: string;
  usdValue?: number;
}

// ─── Chain Config ─────────────────────────────────────────────────────────────

interface ChainCfg {
  chainId: number;
  rpc: string;
  name: string;
}

const CHAIN_CFG: Record<SupportedChain, ChainCfg> = {
  ethereum: { chainId: 1, rpc: "https://eth.llamarpc.com", name: "Ethereum" },
  base:     { chainId: 8453, rpc: "https://mainnet.base.org", name: "Base" },
  avalanche:{ chainId: 43114, rpc: "https://api.avax.network/ext/bc/C/rpc", name: "Avalanche" },
};

// ─── Featured / Default Tokens ────────────────────────────────────────────────

export const FEATURED_TOKENS: TokenInfo[] = [
  {
    address: "0x2565ae0385659badCada1031DB704442E1b69982",
    name: "Assemble Protocol",
    symbol: "ASM",
    decimals: 18,
    chain: "ethereum",
    chainId: 1,
    coingeckoId: "assemble-protocol",
    logoColor: "#00B4D8",
  },
  {
    address: "0x3b53604113B5677291BFc0bc255379E7a796559b",
    name: "Assemble Protocol",
    symbol: "ASM",
    decimals: 18,
    chain: "base",
    chainId: 8453,
    coingeckoId: "assemble-protocol",
    logoColor: "#00B4D8",
  },
];

// ─── JSON-RPC ─────────────────────────────────────────────────────────────────

async function jsonRpc(
  rpc: string,
  method: string,
  params: unknown[]
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal,
    });
    const data = (await res.json()) as { result?: string; error?: { message: string } };
    if (data.error) throw new Error(data.error.message);
    return data.result || "0x";
  } finally {
    clearTimeout(timeout);
  }
}

// ─── ERC-20 Function Selectors ────────────────────────────────────────────────

const SELECTORS: Record<string, string> = {
  "balanceOf(address)": "0x70a08231",
  "name()":             "0x06fdde03",
  "symbol()":           "0x95d89b41",
  "decimals()":         "0x313ce567",
};

function encodeCall(sig: string, params: string[] = []): string {
  const selector = SELECTORS[sig];
  if (!selector) throw new Error(`Unknown ERC-20 function: ${sig}`);
  if (params.length === 0) return selector;
  let encoded = selector;
  for (const p of params) {
    const hex = p.startsWith("0x") ? p.slice(2) : p;
    encoded += hex.padStart(64, "0");
  }
  return encoded;
}

// ─── ABI Decoding ─────────────────────────────────────────────────────────────

function decodeString(hex: string): string {
  if (!hex || hex === "0x" || hex.length < 4) return "";
  try {
    const raw = hex.slice(2);
    // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = raw.slice(64, 128);
    const length = parseInt(lengthHex, 16);
    if (length === 0) return "";
    const dataHex = raw.slice(128, 128 + length * 2);
    return Buffer.from(dataHex, "hex").toString("utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}

function decodeUint8(hex: string): number {
  if (!hex || hex === "0x") return 18; // default
  try {
    return parseInt(hex.slice(-2), 16);
  } catch {
    return 18;
  }
}

function decodeUint256(hex: string): string {
  if (!hex || hex === "0x") return "0";
  try {
    return BigInt(hex).toString();
  } catch {
    return "0";
  }
}

// ─── eth_call Helper ──────────────────────────────────────────────────────────

async function ethCall(
  rpc: string,
  to: string,
  data: string
): Promise<string> {
  try {
    return await jsonRpc(rpc, "eth_call", [{ to, data }, "latest"]);
  } catch {
    return "0x";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchTokenInfo(
  chain: SupportedChain,
  address: string
): Promise<TokenInfo | null> {
  const cfg = CHAIN_CFG[chain];
  const rpc = cfg.rpc;

  try {
    const [nameHex, symbolHex, decimalsHex] = await Promise.all([
      ethCall(rpc, address, encodeCall("name()")),
      ethCall(rpc, address, encodeCall("symbol()")),
      ethCall(rpc, address, encodeCall("decimals()")),
    ]);

    const name = decodeString(nameHex);
    const symbol = decodeString(symbolHex);
    const decimals = decodeUint8(decimalsHex);

    if (!symbol) return null;

    return {
      address,
      name: name || symbol,
      symbol,
      decimals,
      chain,
      chainId: cfg.chainId,
    };
  } catch {
    return null;
  }
}

export async function fetchTokenBalance(
  token: TokenInfo,
  ownerAddress: string
): Promise<TokenBalance> {
  const cfg = CHAIN_CFG[token.chain];
  const rpc = cfg.rpc;

  try {
    const balHex = await ethCall(
      rpc,
      token.address,
      encodeCall("balanceOf(address)", [ownerAddress])
    );
    const balRaw = decodeUint256(balHex);
    const balFormatted = formatTokenAmount(balRaw, token.decimals);

    return { ...token, balanceRaw: balRaw, balanceFormatted: balFormatted };
  } catch {
    return { ...token, balanceRaw: "0", balanceFormatted: "0" };
  }
}

export async function fetchAllFeaturedBalances(
  ownerAddress: string
): Promise<TokenBalance[]> {
  const results = await Promise.allSettled(
    FEATURED_TOKENS.map((t) => fetchTokenBalance(t, ownerAddress))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<TokenBalance> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

export function formatTokenAmount(
  rawAmount: string,
  decimals: number,
  maxDecimals = 6
): string {
  try {
    const big = BigInt(rawAmount);
    if (big === BigInt(0)) return "0";
    const divisor = BigInt(10 ** decimals);
    const whole = big / divisor;
    const remainder = big % divisor;
    const fracStr = remainder.toString().padStart(decimals, "0").slice(0, maxDecimals);
    const trimmed = fracStr.replace(/0+$/, "");
    if (!trimmed) return whole.toString();
    return `${whole}.${trimmed}`;
  } catch {
    return "0";
  }
}

export function parseTokenAmount(
  humanAmount: string,
  decimals: number
): bigint {
  try {
    const [whole, frac = ""] = humanAmount.split(".");
    const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded);
  } catch {
    return BigInt(0);
  }
}
