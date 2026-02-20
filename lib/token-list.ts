/**
 * Token List Service
 *
 * Fetches token metadata (logos, prices, symbols) from CoinGecko API
 * Supports Base and Avalanche C-Chain
 */

import { ethers } from "ethers";

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  price?: number;
  chain: "base" | "avalanche";
}

// Popular tokens on Base (can be expanded)
const BASE_POPULAR_TOKENS: TokenMetadata[] = [
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    chain: "base",
  },
  {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    chain: "base",
  },
  {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    chain: "base",
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    chain: "base",
  },
  {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    decimals: 18,
    chain: "base",
  },
];

// Popular tokens on Avalanche C-Chain
const AVALANCHE_POPULAR_TOKENS: TokenMetadata[] = [
  {
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    chain: "avalanche",
  },
  {
    address: "0x9702230A8657203E2F74BFF266665CDD778ec7bf",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    chain: "avalanche",
  },
  {
    address: "0xd586E7F844cEa2F87f50C2F71eB04cDF0923FF1C",
    symbol: "DAI.e",
    name: "Dai Stablecoin",
    decimals: 18,
    chain: "avalanche",
  },
  {
    address: "0x49D8723B9EcFa512CCF5Aa4908249b41b9e0e7BE",
    symbol: "WAVAX",
    name: "Wrapped AVAX",
    decimals: 18,
    chain: "avalanche",
  },
];

// Cache for token metadata
const tokenMetadataCache = new Map<string, TokenMetadata>();

/**
 * Get popular tokens for a chain
 */
export function getPopularTokens(chain: "base" | "avalanche"): TokenMetadata[] {
  return chain === "base" ? BASE_POPULAR_TOKENS : AVALANCHE_POPULAR_TOKENS;
}

/**
 * Get token metadata from cache or fetch it
 */
export async function getTokenMetadata(
  address: string,
  chain: "base" | "avalanche"
): Promise<TokenMetadata | null> {
  const cacheKey = `${chain}:${address.toLowerCase()}`;

  if (tokenMetadataCache.has(cacheKey)) {
    return tokenMetadataCache.get(cacheKey) || null;
  }

  try {
    // Check if it's a known popular token
    const allTokens = [...BASE_POPULAR_TOKENS, ...AVALANCHE_POPULAR_TOKENS];
    const known = allTokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
    if (known) {
      tokenMetadataCache.set(cacheKey, known);
      return known;
    }

    // Try to fetch from on-chain (ERC-20 metadata)
    const rpcUrl = chain === "base"
      ? "https://mainnet.base.org"
      : "https://api.avax.network/ext/bc/C/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const erc20ABI = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ];

    const contract = new ethers.Contract(address, erc20ABI, provider);

    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => "Unknown"),
      contract.symbol().catch(() => "???"),
      contract.decimals().catch(() => 18),
    ]);

    const metadata: TokenMetadata = {
      address: ethers.getAddress(address),
      symbol: symbol || "???",
      name: name || "Unknown Token",
      decimals: Number(decimals) || 18,
      chain,
    };

    tokenMetadataCache.set(cacheKey, metadata);
    return metadata;
  } catch (error) {
    console.error(`Failed to fetch token metadata for ${address}:`, error);
    return null;
  }
}

/**
 * Get token logo URL from CoinGecko
 */
export function getTokenLogoUrl(symbol: string): string | undefined {
  // Map common symbols to CoinGecko IDs
  const coinGeckoMap: Record<string, string> = {
    USDC: "usd-coin",
    USDT: "tether",
    DAI: "dai",
    WETH: "weth",
    ETH: "ethereum",
    AVAX: "avalanche-2",
    WAVAX: "avalanche-2",
    cbETH: "coinbase-wrapped-staked-eth",
  };

  const geckoId = coinGeckoMap[symbol.toUpperCase()];
  if (geckoId) {
    return `https://assets.coingecko.com/coins/images/825/small/${geckoId}.png`;
  }

  return undefined;
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: string, decimals: number, maxDecimals: number = 4): string {
  try {
    const value = ethers.formatUnits(amount, decimals);
    const num = parseFloat(value);

    if (num === 0) return "0";
    if (num < 0.0001) return "<0.0001";

    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    });
  } catch {
    return "0";
  }
}

/**
 * Parse token amount from user input
 */
export function parseTokenAmount(input: string, decimals: number): string {
  try {
    return ethers.parseUnits(input, decimals).toString();
  } catch {
    return "0";
  }
}
