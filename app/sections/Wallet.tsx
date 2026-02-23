"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  createWallet, importFromMnemonic, importFromPrivateKey,
  deleteWallet, isWalletCreated, getWalletAddress,
  getWalletMnemonic, getWalletPrivateKey, type WalletData,
  unlockWallet, isWalletUnlocked, hasLegacyUnencryptedWallet, migrateLegacyWallet,
} from "../lib/wallet";
import { getAllBalances, type ChainBalance } from "../lib/blockchain";
import {
  fetchAllTokenBalances, fetchTokenInfo, fetchTokenBalance,
  fetchTokenLogo, lookupTokenOnCoinGecko, parseTokenAmount,
  ALL_COINGECKO_IDS, type TokenInfo, type TokenBalance, type SupportedChain,
} from "../lib/erc20";
import {
  TX_CHAINS, sendNativeToken, sendERC20Token,
  estimateNativeSendGas, estimateERC20SendGas,
  type ChainConfig, type GasEstimate,
} from "../lib/transactions";
import { DisclaimerModal, FooterDisclaimer } from "../components/DisclaimerBanner";
import { isDisclaimerAcknowledged } from "../lib/disclaimers";
import { useWalletAuth } from "../lib/WalletAuthContext";
import {
  getSpendingLimits, saveSpendingLimits, upsertSpendingLimit, removeSpendingLimit,
  getAllLimitStatuses, makeLimitId, getPeriodLabel,
  type SpendingLimitConfig, type SpendingLimitStatus, type LimitPeriod,
} from "../lib/spending-limits";
import {
  getTrustGateConfig, setTrustGateLevel, TRUST_GATE_LEVELS,
  type TrustGateLevel,
} from "../lib/trust-gate";
import { getPaymentHistory, type X402PaymentRecord } from "../lib/x402-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenPrices = Record<string, number>;
interface PriceCache { prices: TokenPrices; fetchedAt: number }
type WalletView = "none" | "created" | "locked" | "migrate-legacy" | "create-password" | "import-mnemonic" | "import-pk";
type ModalView = "none" | "send" | "receive" | "add-token" | "send-success" | "security";

interface SendState {
  token: AssetItem | null;
  toAddress: string;
  amount: string;
  gas: GasEstimate | null;
  gasLoading: boolean;
  sending: boolean;
  error: string;
  txHash: string;
  txExplorerUrl: string;
}

interface AssetItem {
  type: "native" | "erc20";
  chain: SupportedChain;
  chainConfig: ChainConfig;
  symbol: string;
  name: string;
  decimals: number;
  balanceFormatted: string;
  balanceRaw: string;
  usdValue: number;
  pricePerToken: number;
  tokenAddress?: string;
  coingeckoId?: string;
  logoUrl?: string;
  logoColor?: string;
  chainName: string;
  error?: string;
}

// ─── VNS ─────────────────────────────────────────────────────────────────────

const VNS_KEY = "vaultfire_vns_name";
function getVNSName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(VNS_KEY) || "";
}
function setVNSName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VNS_KEY, name);
}

// ─── Companion Name ───────────────────────────────────────────────────────────

const COMPANION_NAME_KEY = "vaultfire_companion_name";
function getCompanionName(): string {
  if (typeof window === "undefined") return "Embris";
  return localStorage.getItem(COMPANION_NAME_KEY) || "Embris";
}
function setCompanionNameStorage(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMPANION_NAME_KEY, name || "Embris");
}

// ─── Price Fetching (module-level cache — never re-fetches within TTL) ────────

const PRICE_TTL = 60_000;
let _priceCache: PriceCache | null = null;
let _priceFetchPromise: Promise<TokenPrices> | null = null;

const NATIVE_PRICE_IDS = ["ethereum", "avalanche-2"];

async function fetchPrices(): Promise<TokenPrices> {
  const now = Date.now();
  if (_priceCache && now - _priceCache.fetchedAt < PRICE_TTL) return _priceCache.prices;
  // Deduplicate concurrent calls
  if (_priceFetchPromise) return _priceFetchPromise;
  _priceFetchPromise = (async () => {
    try {
      const allIds = [...new Set([...NATIVE_PRICE_IDS, ...ALL_COINGECKO_IDS])];
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${allIds.join(",")}&vs_currencies=usd`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as Record<string, { usd: number }>;
      const prices: TokenPrices = {};
      for (const [id, val] of Object.entries(data)) {
        if (val?.usd) prices[id] = val.usd;
      }
      _priceCache = { prices, fetchedAt: Date.now() };
      return prices;
    } catch {
      return _priceCache?.prices || {};
    } finally {
      _priceFetchPromise = null;
    }
  })();
  return _priceFetchPromise;
}

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "< $0.01";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatPrice(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

// ─── Custom Token Storage ─────────────────────────────────────────────────────

const CUSTOM_TOKENS_KEY = "vaultfire_custom_tokens";
function loadCustomTokens(): TokenInfo[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomTokens(tokens: TokenInfo[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function PlusIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function KeyIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>);
}
function FileTextIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>);
}
function CopyIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>);
}
function CheckIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
}
function ArrowLeftIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>);
}
function RefreshIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>);
}
function EyeOffIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);
}
function TrashIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>);
}
function SendIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>);
}
function ReceiveIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>);
}
function ClockIcon({ size = 20 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
}
function ShieldIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
}
function AlertTriangleIcon({ size = 14 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
}
function XIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
}
function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>);
}
function GasIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V8l7-6 7 6v14H3z"/><path d="M10 22V12h4v10"/><path d="M14 10h3l2 2v4l-2 2h-3"/></svg>);
}
function UserIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
}
function EditIcon({ size = 12 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
}
function LockIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
}
function FireIcon({ size = 16 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" fill="none"><path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/><path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C"/><path d="M16 14c-.7 1-1.4 2.2-1.4 3.2 0 .77.63 1.4 1.4 1.4s1.4-.63 1.4-1.4c0-1-.7-2.2-1.4-3.2z" fill="#FDE68A" opacity="0.6"/></svg>);
}

// ─── Chain Token Icons ────────────────────────────────────────────────────────

// ─── Native Chain Token Icons ────────────────────────────────────────────
function EthIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#627EEA"/>
      <path d="M16 5v9.14l7.5 3.35L16 5z" fill="#fff" opacity="0.6"/>
      <path d="M16 5L8.5 17.49 16 14.14V5z" fill="#fff"/>
      <path d="M16 22.44v5.56l7.5-10.38L16 22.44z" fill="#fff" opacity="0.6"/>
      <path d="M16 28v-5.56l-7.5-4.82L16 28z" fill="#fff"/>
      <path d="M16 21.07l7.5-4.35-7.5-3.35v7.7z" fill="#fff" opacity="0.2"/>
      <path d="M8.5 16.72l7.5 4.35v-7.7l-7.5 3.35z" fill="#fff" opacity="0.5"/>
    </svg>
  );
}
function AvaxIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#E84142"/>
      {/* Avalanche triangle logo */}
      <path d="M20.5 21H11.5c-.55 0-.85-.6-.55-1.05l4.5-7.8c.3-.5 1-.5 1.3 0l4.5 7.8c.3.45 0 1.05-.55 1.05h-.2z" fill="#fff"/>
      <path d="M11.2 21H8.5c-.55 0-.85-.6-.55-1.05l3-5.2c.3-.5 1-.5 1.3 0l1.5 2.6-2.05 3.65H11.2z" fill="#fff" opacity="0.7"/>
    </svg>
  );
}
function BaseIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#0052FF"/>
      <path d="M16 26c5.523 0 10-4.477 10-10S21.523 6 16 6c-5.2 0-9.473 3.97-9.95 9.04h13.1v1.92H6.05C6.527 22.03 10.8 26 16 26z" fill="#fff"/>
    </svg>
  );
}

// ─── Known ERC-20 Token SVG Logos ────────────────────────────────────────────
function UsdcIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#2775CA"/>
      {/* USDC: white circle ring with dollar sign */}
      <circle cx="16" cy="16" r="10" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.4"/>
      <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">$</text>
      <path d="M16 7.5v2M16 22.5v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    </svg>
  );
}
function AsmIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#8B5CF6"/>
      {/* ASM: stylized A mark */}
      <path d="M10 22l6-12 6 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M12.5 18h7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function UsdtIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#26A17B"/>
      <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">₮</text>
    </svg>
  );
}
function WbtcIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F7931A"/>
      <text x="16" y="21" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">₿</text>
    </svg>
  );
}

// Map of symbol → SVG icon component
const TOKEN_SVG_ICONS: Record<string, (props: { size?: number }) => React.ReactElement> = {
  USDC: UsdcIcon,
  ASM: AsmIcon,
  USDT: UsdtIcon,
  WBTC: WbtcIcon,
  ETH: EthIcon,
  WETH: EthIcon,
  AVAX: AvaxIcon,
};

// ─── // ─── Known Token Colors ────────────────────────────────────────────

const TOKEN_COLORS: Record<string, string> = {
  USDC: "#2775CA",   // USDC blue-green
  USDT: "#26A17B",   // Tether green
  DAI: "#F5AC37",    // DAI gold
  WBTC: "#F7931A",   // Bitcoin orange
  WETH: "#627EEA",   // Wrapped ETH blue
  LINK: "#375BD2",   // Chainlink blue
  UNI: "#FF007A",    // Uniswap pink
  AAVE: "#B6509E",   // Aave purple
  ASM: "#8B5CF6",    // Assemble AI purple
  MATIC: "#8247E5",  // Polygon purple
  OP: "#FF0420",     // Optimism red
  ARB: "#28A0F0",    // Arbitrum blue
  PEPE: "#4CAF50",   // Pepe green
};

// ─── Token Letter Fallback ────────────────────────────────────────────

function TokenLetter({ symbol, color, size = 40 }: { symbol: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: color + "18", border: `1.5px solid ${color}35`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 800, color, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
        {symbol.slice(0, 3)}
      </span>
    </div>
  );
}

function TokenAvatar({ item, size = 40 }: { item: AssetItem; size?: number }) {
  // 1. Use logoUrl if available (from on-chain metadata)
  if (item.logoUrl) {
    return (
      <img
        src={item.logoUrl}
        alt={item.symbol}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  // 2. Native chain tokens get their chain icon
  if (item.type === "native") {
    if (item.chain === "avalanche") return <AvaxIcon size={size} />;
    if (item.chain === "base") return <BaseIcon size={size} />;
    return <EthIcon size={size} />;
  }
  // 3. Known tokens get proper SVG logos
  const SvgIcon = TOKEN_SVG_ICONS[item.symbol.toUpperCase()];
  if (SvgIcon) return <SvgIcon size={size} />;
  // 4. Unknown tokens fall back to colored letter circle
  const knownColor = TOKEN_COLORS[item.symbol.toUpperCase()];
  return <TokenLetter symbol={item.symbol} color={knownColor || item.logoColor || "#71717A"} size={size} />;
}

function ChainBadge({ chain }: { chain: SupportedChain }) {
  const colors: Record<SupportedChain, string> = { ethereum: "#627EEA", base: "#0052FF", avalanche: "#E84142" };
  const labels: Record<SupportedChain, string> = { ethereum: "E", base: "B", avalanche: "A" };
  return (
    <div style={{
      position: "absolute", bottom: -2, right: -2,
      width: 16, height: 16, borderRadius: "50%",
      backgroundColor: colors[chain], border: "2px solid #0A0A0A",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 7, color: "#fff", fontWeight: 800 }}>{labels[chain]}</span>
    </div>
  );
}

// ─── Portal Modal Shell ───────────────────────────────────────────────────────

function WalletModal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!mounted) return null;

  const content = (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999, backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 520,
          backgroundColor: "#111113",
          borderRadius: "24px 24px 0 0",
          border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none",
          maxHeight: "92dvh", overflowY: "auto", overflowX: "hidden",
          animation: "fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          WebkitOverflowScrolling: "touch",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" }} />
        </div>
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 0" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.03em" }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.06)", border: "none",
                cursor: "pointer", color: "#71717A",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── QR Code Component ────────────────────────────────────────────────────────

function QRCodeDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: 200, margin: 2,
        color: { dark: "#F4F4F5", light: "#111113" },
      });
    });
  }, [value]);
  return (
    <div style={{ padding: 16, backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, display: "inline-flex" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 10, background: "none", border: "none",
        cursor: "pointer", padding: 0,
        userSelect: "none", WebkitUserSelect: "none",
        transform: pressed ? "scale(0.9)" : "scale(1)",
        transition: "transform 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: `linear-gradient(145deg, ${color}22, ${color}10)`,
        border: `1.5px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color,
        boxShadow: pressed ? `0 0 20px ${color}15` : `0 4px 16px ${color}08`,
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#A1A1AA", letterSpacing: "0.02em" }}>{label}</span>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mono = { fontFamily: "'Courier New', 'JetBrains Mono', monospace" };

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Wallet() {
  // ── Auth context ─────────────────────────────────────────────────────────────
  const { unlock: ctxUnlock, logout: ctxLogout } = useWalletAuth();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<WalletView>("none");
  const [showWalletDisclaimer, setShowWalletDisclaimer] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [nativeBalances, setNativeBalances] = useState<ChainBalance[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loadingBals, setLoadingBals] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [prices, setPrices] = useState<TokenPrices>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [modalView, setModalView] = useState<ModalView>("none");
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);

  // ─── Spending Limits State ──────────────────────────────────────────────────
  const [limitStatuses, setLimitStatuses] = useState<SpendingLimitStatus[]>([]);
  const [showAddLimit, setShowAddLimit] = useState(false);
  const [newLimitToken, setNewLimitToken] = useState("USDC");
  const [newLimitPeriod, setNewLimitPeriod] = useState<LimitPeriod>("daily");
  const [newLimitAmount, setNewLimitAmount] = useState("100");

  // ─── Trust Gate State ──────────────────────────────────────────────────────
  const [trustGateLevel, setTrustGateLevelState] = useState<TrustGateLevel>("none");

  // ─── Transaction History State ──────────────────────────────────────────────
  const [txHistory, setTxHistory] = useState<X402PaymentRecord[]>([]);

  // ── CRITICAL FIX: Logo cache stored in useRef (NOT useState) ──────────────
  // This means logo updates do NOT trigger re-renders.
  // We use a separate counter to trigger ONE re-render when all logos are done.
  const logoCache = useRef<Record<string, string | null>>({});
  const [logoVersion, setLogoVersion] = useState(0);
  const logoFetchInProgress = useRef(false);

  // ── VNS state ────────────────────────────────────────────────────────────────
  const [vnsName, setVnsName] = useState("");
  const [vnsInput, setVnsInput] = useState("");
  const [vnsEditing, setVnsEditing] = useState(false);

  // ── Companion name state ─────────────────────────────────────────────────────
  const [companionName, setCompanionName] = useState("Embris");
  const [companionNameInput, setCompanionNameInput] = useState("");
  const [companionNameEditing, setCompanionNameEditing] = useState(false);

  // ── Send state ───────────────────────────────────────────────────────────────
  const [sendState, setSendState] = useState<SendState>({
    token: null, toAddress: "", amount: "", gas: null,
    gasLoading: false, sending: false, error: "", txHash: "", txExplorerUrl: "",
  });

  // ── Security state ───────────────────────────────────────────────────────────
  const [securityRevealInput, setSecurityRevealInput] = useState("");
  const [securityRevealed, setSecurityRevealed] = useState(false);

  // ── Password / unlock state ─────────────────────────────────────────────────
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  // showPassword reserved for future show/hide toggle
  const [_showPassword, _setShowPassword] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

  // ── Add token state ──────────────────────────────────────────────────────────
  const [addTokenChain, setAddTokenChain] = useState<SupportedChain>("base");
  const [addTokenAddress, setAddTokenAddress] = useState("");
  const [addTokenInfo, setAddTokenInfo] = useState<TokenInfo | null>(null);
  const [addTokenLoading, setAddTokenLoading] = useState(false);
  const [addTokenError, setAddTokenError] = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Resize listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Init: load wallet, VNS, companion name ─────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    setCustomTokens(loadCustomTokens());
    setVnsName(getVNSName());
    setCompanionName(getCompanionName());
    // Initialize trust gate and tx history — spending limits start empty (user opts in)
    setLimitStatuses(getAllLimitStatuses());
    const tgConfig = getTrustGateConfig();
    setTrustGateLevelState(tgConfig.minimumTier);
    setTxHistory(getPaymentHistory());
    if (isWalletCreated()) {
      const addr = getWalletAddress();
      if (addr) {
        // Check if wallet is already unlocked in this session
        if (isWalletUnlocked()) {
          setWalletData({ address: addr, mnemonic: getWalletMnemonic() || "", privateKey: getWalletPrivateKey() || "" });
          setView("created");
          loadAllBalances(addr);
        } else if (hasLegacyUnencryptedWallet()) {
          // Legacy unencrypted wallet — needs migration
          setView("migrate-legacy");
        } else {
          // Encrypted wallet exists but session is locked — show unlock screen
          setView("locked");
        }
      }
    }
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Price loading: fires once on wallet ready, then every 60s ────────────────
  useEffect(() => {
    if (view !== "created") return;
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      setPricesLoading(true);
      const p = await fetchPrices();
      if (!cancelled && mountedRef.current) {
        setPrices(p);
        setPricesLoading(false);
      }
    };
    load();
    priceIntervalRef.current = setInterval(load, PRICE_TTL);
    return () => {
      cancelled = true;
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };
  }, [view]);

  // ── CRITICAL FIX: Logo fetching — batched, single state update, no cascade ───
  // Uses useRef for cache so no re-renders during fetching.
  // Only triggers ONE re-render (via logoVersion) when ALL logos are fetched.
  useEffect(() => {
    if (tokenBalances.length === 0) return;
    if (logoFetchInProgress.current) return;

    const idsToFetch = tokenBalances
      .filter(t => t.coingeckoId && logoCache.current[t.coingeckoId] === undefined)
      .map(t => t.coingeckoId!);

    if (idsToFetch.length === 0) return;

    logoFetchInProgress.current = true;
    let cancelled = false;

    const fetchAll = async () => {
      // Fetch all logos in parallel (not sequential)
      const results = await Promise.allSettled(
        idsToFetch.map(id => fetchTokenLogo(id).then(url => ({ id, url })))
      );
      if (cancelled || !mountedRef.current) return;

      let changed = false;
      for (const r of results) {
        if (r.status === "fulfilled") {
          logoCache.current[r.value.id] = r.value.url;
          changed = true;
        }
      }
      // ONE state update to trigger re-render — not one per logo
      if (changed) setLogoVersion(v => v + 1);
      logoFetchInProgress.current = false;
    };

    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenBalances]);

  // ── CRITICAL FIX: Assets computed with useMemo — only recalculates when deps change ──
  const assets = useMemo((): AssetItem[] => {
    const items: AssetItem[] = [];

    for (const bal of nativeBalances) {
      const amount = parseFloat(bal.balanceFormatted);
      if (amount <= 0) continue;
      const chain: SupportedChain = bal.chain.toLowerCase().includes("avalanche") ? "avalanche"
        : bal.chain.toLowerCase().includes("base") ? "base" : "ethereum";
      const chainCfg = TX_CHAINS[chain];
      const priceId = chain === "avalanche" ? "avalanche-2" : "ethereum";
      const pricePerToken = prices[priceId] || 0;
      items.push({
        type: "native", chain, chainConfig: chainCfg,
        symbol: bal.symbol, name: `${bal.symbol} on ${bal.chain}`,
        chainName: bal.chain, decimals: 18,
        balanceFormatted: bal.balanceFormatted, balanceRaw: bal.balance,
        usdValue: amount * pricePerToken, pricePerToken, error: bal.error,
      });
    }

    for (const tb of tokenBalances) {
      const amount = parseFloat(tb.balanceFormatted);
      if (amount <= 0) continue;
      const pricePerToken = prices[tb.coingeckoId || ""] || 0;
      const chainLabel = { ethereum: "Ethereum", base: "Base", avalanche: "Avalanche" }[tb.chain];
      // Read from ref cache (no state dependency = no extra re-renders)
      const logoUrl = tb.coingeckoId ? logoCache.current[tb.coingeckoId] : undefined;
      items.push({
        type: "erc20", chain: tb.chain, chainConfig: TX_CHAINS[tb.chain],
        symbol: tb.symbol, name: tb.name, chainName: chainLabel,
        decimals: tb.decimals, balanceFormatted: tb.balanceFormatted, balanceRaw: tb.balanceRaw,
        usdValue: amount * pricePerToken, pricePerToken,
        tokenAddress: tb.address, coingeckoId: tb.coingeckoId,
        logoUrl: logoUrl || undefined, logoColor: tb.logoColor,
      });
    }

    const nativeItems = items.filter(a => a.type === "native");
    const erc20Items = items.filter(a => a.type === "erc20").sort((a, b) => b.usdValue - a.usdValue);
    return [...nativeItems, ...erc20Items];
  // logoVersion is intentionally included to re-render when logos arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeBalances, tokenBalances, prices, logoVersion]);

  const totalUsd = useMemo(() => assets.reduce((s, a) => s + a.usdValue, 0), [assets]);

  // ── Balance loading ───────────────────────────────────────────────────────────

  const loadAllBalances = useCallback(async (address: string) => {
    setLoadingBals(true);
    try {
      const customs = loadCustomTokens();
      const [native, tokens] = await Promise.all([
        getAllBalances(address),
        fetchAllTokenBalances(address, customs),
      ]);
      if (mountedRef.current) {
        setNativeBalances(native);
        setTokenBalances(tokens);
      }
    } finally {
      if (mountedRef.current) setLoadingBals(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!walletData) return;
    setLoadingBals(true);
    setPricesLoading(true);
    try {
      const customs = loadCustomTokens();
      const [native, tokens, p] = await Promise.all([
        getAllBalances(walletData.address),
        fetchAllTokenBalances(walletData.address, customs),
        fetchPrices(),
      ]);
      if (mountedRef.current) {
        setNativeBalances(native);
        setTokenBalances(tokens);
        setPrices(p);
      }
    } finally {
      if (mountedRef.current) {
        setLoadingBals(false);
        setPricesLoading(false);
      }
    }
  }, [walletData]);

  // ── Wallet creation / import ──────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!passwordInput) { setPasswordError("Please set a wallet password."); return; }
    if (passwordInput.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (passwordInput !== passwordConfirm) { setPasswordError("Passwords do not match."); return; }
    setCreating(true); setPasswordError("");
    try {
      const data = await createWallet(passwordInput);
      setWalletData(data);
      setView("created");
      setPasswordInput(""); setPasswordConfirm("");
      await ctxUnlock(data.privateKey, data.mnemonic, data.address);
      loadAllBalances(data.address);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to create wallet.");
    } finally { setCreating(false); }
  };

  const handleImportMnemonic = async () => {
    if (!passwordInput) { setPasswordError("Please set a wallet password."); return; }
    if (passwordInput.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (passwordInput !== passwordConfirm) { setPasswordError("Passwords do not match."); return; }
    setImportError(""); setImporting(true); setPasswordError("");
    try {
      const data = await importFromMnemonic(importInput, passwordInput);
      setWalletData(data); setView("created"); setImportInput("");
      setPasswordInput(""); setPasswordConfirm("");
      await ctxUnlock(data.privateKey, data.mnemonic, data.address);
      loadAllBalances(data.address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid mnemonic phrase.";
      setImportError(msg);
    } finally { setImporting(false); }
  };

  const handleImportPK = async () => {
    if (!passwordInput) { setPasswordError("Please set a wallet password."); return; }
    if (passwordInput.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (passwordInput !== passwordConfirm) { setPasswordError("Passwords do not match."); return; }
    setImportError(""); setImporting(true); setPasswordError("");
    try {
      const data = await importFromPrivateKey(importInput, passwordInput);
      setWalletData(data); setView("created"); setImportInput("");
      setPasswordInput(""); setPasswordConfirm("");
      await ctxUnlock(data.privateKey, data.mnemonic, data.address);
      loadAllBalances(data.address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid private key.";
      setImportError(msg);
    } finally { setImporting(false); }
  };

  const handleUnlock = async () => {
    if (!passwordInput) { setPasswordError("Enter your wallet password."); return; }
    setUnlocking(true); setPasswordError("");
    try {
      const data = await unlockWallet(passwordInput);
      setWalletData(data);
      setView("created");
      setPasswordInput("");
      await ctxUnlock(data.privateKey, data.mnemonic, data.address);
      loadAllBalances(data.address);
    } catch {
      setPasswordError("Incorrect password. Please try again.");
    } finally { setUnlocking(false); }
  };

  const handleMigrateLegacy = async () => {
    if (!passwordInput) { setPasswordError("Set a password to encrypt your wallet."); return; }
    if (passwordInput.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (passwordInput !== passwordConfirm) { setPasswordError("Passwords do not match."); return; }
    setUnlocking(true); setPasswordError("");
    try {
      await migrateLegacyWallet(passwordInput);
      const addr = getWalletAddress() || "";
      const pk = getWalletPrivateKey() || "";
      const mn = getWalletMnemonic() || "";
      setWalletData({ address: addr, mnemonic: mn, privateKey: pk });
      setView("created");
      setPasswordInput(""); setPasswordConfirm("");
      await ctxUnlock(pk, mn, addr);
      loadAllBalances(addr);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Migration failed.");
    } finally { setUnlocking(false); }
  };

  const handleDelete = () => {
    if (confirm("Delete this wallet? Make sure you have your seed phrase backed up.")) {
      deleteWallet();
      ctxLogout();
      setWalletData(null); setNativeBalances([]); setTokenBalances([]);
      setView("none"); setModalView("none");
    }
  };

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }, []);

  // ── Send flow ─────────────────────────────────────────────────────────────────

  const openSend = useCallback((token?: AssetItem) => {
    setSendState({
      token: token || null, toAddress: "", amount: "",
      gas: null, gasLoading: false, sending: false,
      error: "", txHash: "", txExplorerUrl: "",
    });
    setModalView("send");
  }, []);

  const estimateGasForSend = useCallback(async (state: SendState) => {
    if (!state.token || !isValidAddress(state.toAddress) || !state.amount || !walletData) return;
    const amount = parseFloat(state.amount);
    if (isNaN(amount) || amount <= 0) return;
    setSendState(s => ({ ...s, gasLoading: true, gas: null }));
    try {
      let gas: GasEstimate;
      if (state.token.type === "native") {
        gas = await estimateNativeSendGas(state.token.chainConfig, walletData.address, state.toAddress, state.amount);
      } else {
        const rawAmount = parseTokenAmount(state.amount, state.token.decimals);
        gas = await estimateERC20SendGas(state.token.chainConfig, walletData.address, state.token.tokenAddress!, state.toAddress, rawAmount);
      }
      setSendState(s => ({ ...s, gas, gasLoading: false }));
    } catch {
      setSendState(s => ({ ...s, gasLoading: false }));
    }
  }, [walletData]);

  const handleSendConfirm = async () => {
    if (!sendState.token || !walletData) return;
    const pk = getWalletPrivateKey();
    if (!pk) { setSendState(s => ({ ...s, error: "Private key not found." })); return; }
    setSendState(s => ({ ...s, sending: true, error: "" }));
    try {
      let result;
      if (sendState.token.type === "native") {
        result = await sendNativeToken(sendState.token.chainConfig, pk, walletData.address, sendState.toAddress, sendState.amount);
      } else {
        const rawAmount = parseTokenAmount(sendState.amount, sendState.token.decimals);
        result = await sendERC20Token(sendState.token.chainConfig, pk, walletData.address, sendState.token.tokenAddress!, sendState.toAddress, rawAmount);
      }
      setSendState(s => ({ ...s, sending: false, txHash: result.hash, txExplorerUrl: result.explorerUrl }));
      setModalView("send-success");
      setTimeout(() => loadAllBalances(walletData.address), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setSendState(s => ({ ...s, sending: false, error: msg }));
    }
  };

  // ── Add custom token ──────────────────────────────────────────────────────────

  const handleLookupToken = async () => {
    if (!isValidAddress(addTokenAddress)) { setAddTokenError("Invalid contract address"); return; }
    setAddTokenLoading(true); setAddTokenError(""); setAddTokenInfo(null);
    const cgResult = await lookupTokenOnCoinGecko(addTokenChain, addTokenAddress);
    if (cgResult) {
      const info = await fetchTokenInfo(addTokenChain, addTokenAddress);
      if (info) {
        setAddTokenInfo({ ...info, coingeckoId: cgResult.coingeckoId, logoUrl: cgResult.logoUrl });
        setAddTokenLoading(false);
        return;
      }
    }
    const info = await fetchTokenInfo(addTokenChain, addTokenAddress);
    if (!info) { setAddTokenError("Token not found on this chain. Check the address and network."); }
    else { setAddTokenInfo(info); }
    setAddTokenLoading(false);
  };

  const handleAddToken = async () => {
    if (!addTokenInfo || !walletData) return;
    const updated = [...customTokens, addTokenInfo];
    setCustomTokens(updated);
    saveCustomTokens(updated);
    const bal = await fetchTokenBalance(addTokenInfo, walletData.address);
    setTokenBalances(prev => [...prev, bal]);
    setAddTokenAddress(""); setAddTokenInfo(null); setAddTokenError("");
    setModalView("none");
  };

  // ── VNS ───────────────────────────────────────────────────────────────────────

  const saveVNS = useCallback(() => {
    // Enforce [username].vns format
    let raw = vnsInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!raw) { setVnsEditing(false); return; }
    // Strip any existing .vns suffix the user may have typed
    raw = raw.replace(/\.vns$/i, "").replace(/\.vault$/i, "");
    const name = `${raw}.vns`;
    setVNSName(name);
    setVnsName(name);
    setVnsEditing(false);
    setVnsInput("");
  }, [vnsInput]);

  // ── Companion Name ────────────────────────────────────────────────────────────

  const saveCompanionName = useCallback(() => {
    const name = companionNameInput.trim() || "Embris";
    setCompanionNameStorage(name);
    setCompanionName(name);
    setCompanionNameEditing(false);
    setCompanionNameInput("");
  }, [companionNameInput]);

  // ── Onboarding view ───────────────────────────────────────────────────────────

  if (view === "none") {
    return (
    <>
      <div className="page-enter" style={{
        padding: isMobile ? "24px 20px 48px" : "48px 40px",
        maxWidth: 480, margin: "0 auto",
        display: "flex", flexDirection: "column", minHeight: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40, paddingTop: isMobile ? 20 : 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 28,
            background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.04))",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, marginLeft: "auto", marginRight: "auto",
            border: "1px solid rgba(249,115,22,0.15)",
          }}>
            <FireIcon size={36} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>Embris Wallet</h1>
          <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.7, marginBottom: 28 }}>
            Secure multi-chain wallet for Ethereum, Base, and Avalanche. Full control of your assets.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {[
            { icon: <PlusIcon size={20} />, label: "Create New Wallet", sub: "Generate a new seed phrase", onClick: () => { if (!isDisclaimerAcknowledged('wallet')) { setShowWalletDisclaimer(true); } else { setView("create-password"); } }, color: "#F97316" },
            { icon: <FileTextIcon size={20} />, label: "Import Seed Phrase", sub: "12 or 24 word recovery phrase", onClick: () => { if (!isDisclaimerAcknowledged('wallet')) { setShowWalletDisclaimer(true); } else { setView("import-mnemonic"); } }, color: "#22C55E" },
            { icon: <KeyIcon size={20} />, label: "Import Private Key", sub: "Direct private key import", onClick: () => { if (!isDisclaimerAcknowledged('wallet')) { setShowWalletDisclaimer(true); } else { setView("import-pk"); } }, color: "#A78BFA" },
          ].map((item) => (
            <button key={item.label} type="button" onClick={item.onClick} disabled={creating || importing} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 18px", borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              color: "#F4F4F5", cursor: "pointer", transition: "all 0.15s ease", textAlign: "left",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                backgroundColor: `${item.color}12`, border: `1px solid ${item.color}25`,
                display: "flex", alignItems: "center", justifyContent: "center", color: item.color,
              }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{creating && item.label === "Create New Wallet" ? "Creating..." : item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: "#71717A", marginTop: 2 }}>{item.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: "14px 16px", backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)", borderRadius: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: "#F97316", marginTop: 1, flexShrink: 0 }}><AlertTriangleIcon size={14} /></div>
          <div>
            <p style={{ fontSize: 12, color: "#F97316", fontWeight: 600, marginBottom: 4 }}>Non-Custodial Wallet</p>
            <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.65 }}>
              You are solely responsible for your private keys and seed phrase. Embris cannot recover lost keys. Not financial advice. Use at your own risk.
            </p>
          </div>
        </div>
        <FooterDisclaimer />
      </div>
      {showWalletDisclaimer && (
        <DisclaimerModal
          disclaimerKey="wallet"
          onAcknowledge={() => { setShowWalletDisclaimer(false); setView("create-password"); }}
          onDecline={() => setShowWalletDisclaimer(false)}
        />
      )}
    </>
    );
  }

  // ── Create Password view ─────────────────────────────────────────────────

  if (view === "create-password") {
    return (
      <div className="page-enter" style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 480, margin: "0 auto" }}>
        <button type="button" onClick={() => { setView("none"); setPasswordInput(""); setPasswordConfirm(""); setPasswordError(""); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#71717A", cursor: "pointer", marginBottom: 32, fontSize: 13, padding: 0, fontWeight: 500, WebkitTapHighlightColor: "transparent" }}>
          <ArrowLeftIcon size={14} /> Back
        </button>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, marginLeft: "auto", marginRight: "auto" }}>
            <LockIcon size={28} style={{ color: "#F97316" }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>Secure Your Wallet</h2>
          <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6 }}>Set a password to encrypt your wallet. You\'ll need it to unlock the app each session.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Password (min 8 characters)"
            style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Confirm password"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {passwordError && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
            <span style={{ color: "#EF4444", flexShrink: 0, display: "flex" }}><AlertTriangleIcon size={12} /></span>
            <p style={{ color: "#EF4444", fontSize: 12 }}>{passwordError}</p>
          </div>
        )}
        <button type="button" onClick={handleCreate} disabled={creating}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px", width: "100%", background: creating ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)", border: "none", borderRadius: 14, color: creating ? "#3F3F46" : "#FFFFFF", fontSize: 15, fontWeight: 600, cursor: creating ? "default" : "pointer", boxShadow: creating ? "none" : "0 4px 20px rgba(249,115,22,0.2)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {creating && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          {creating ? "Creating Wallet..." : "Create Wallet"}
        </button>
      </div>
    );
  }

  // ── Locked view ─────────────────────────────────────────────────────

  if (view === "locked") {
    return (
      <div className="page-enter" style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: isMobile ? 20 : 40, marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, marginLeft: "auto", marginRight: "auto" }}>
            <LockIcon size={32} style={{ color: "#F97316" }} />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>Wallet Locked</h2>
          <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6 }}>Enter your password to unlock your wallet.</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter password"
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            autoFocus
            style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {passwordError && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
            <span style={{ color: "#EF4444", flexShrink: 0, display: "flex" }}><AlertTriangleIcon size={12} /></span>
            <p style={{ color: "#EF4444", fontSize: 12 }}>{passwordError}</p>
          </div>
        )}
        <button type="button" onClick={handleUnlock} disabled={unlocking}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px", width: "100%", background: unlocking ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)", border: "none", borderRadius: 14, color: unlocking ? "#3F3F46" : "#FFFFFF", fontSize: 15, fontWeight: 600, cursor: unlocking ? "default" : "pointer", boxShadow: unlocking ? "none" : "0 4px 20px rgba(249,115,22,0.2)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {unlocking && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          {unlocking ? "Unlocking..." : "Unlock Wallet"}
        </button>
        <button type="button" onClick={() => { deleteWallet(); setView("none"); }}
          style={{ display: "block", width: "100%", marginTop: 16, padding: "12px", background: "none", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, color: "#EF4444", fontSize: 13, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Forgot password? Delete wallet
        </button>
      </div>
    );
  }

  // ── Migrate Legacy view ─────────────────────────────────────────────────

  if (view === "migrate-legacy") {
    return (
      <div className="page-enter" style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", paddingTop: isMobile ? 20 : 40, marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, marginLeft: "auto", marginRight: "auto" }}>
            <span style={{ color: "#EAB308", display: "flex" }}><AlertTriangleIcon size={28} /></span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>Encrypt Your Wallet</h2>
          <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6 }}>Your wallet is stored unencrypted. Set a password to protect it with AES-256 encryption.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="New password (min 8 characters)"
            style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Confirm password"
            onKeyDown={(e) => e.key === "Enter" && handleMigrateLegacy()}
            style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {passwordError && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
            <span style={{ color: "#EF4444", flexShrink: 0, display: "flex" }}><AlertTriangleIcon size={12} /></span>
            <p style={{ color: "#EF4444", fontSize: 12 }}>{passwordError}</p>
          </div>
        )}
        <button type="button" onClick={handleMigrateLegacy} disabled={unlocking}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px", width: "100%", background: unlocking ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #EAB308, #CA8A04)", border: "none", borderRadius: 14, color: unlocking ? "#3F3F46" : "#FFFFFF", fontSize: 15, fontWeight: 600, cursor: unlocking ? "default" : "pointer", boxShadow: unlocking ? "none" : "0 4px 20px rgba(234,179,8,0.15)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {unlocking && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          {unlocking ? "Encrypting..." : "Encrypt & Continue"}
        </button>
        <button type="button" onClick={() => {
          // Skip encryption — use legacy mode (not recommended)
          const addr = getWalletAddress() || "";
          setWalletData({ address: addr, mnemonic: getWalletMnemonic() || "", privateKey: getWalletPrivateKey() || "" });
          setView("created");
          loadAllBalances(addr);
        }}
          style={{ display: "block", width: "100%", marginTop: 12, padding: "12px", background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "#71717A", fontSize: 13, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Skip for now (not recommended)
        </button>
      </div>
    );
  }

  // ── Import views ──────────────────────────────────────────────────

  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div className="page-enter" style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 480, margin: "0 auto" }}>
        <button type="button" onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#71717A", cursor: "pointer", marginBottom: 32, fontSize: 13, padding: 0, fontWeight: 500, WebkitTapHighlightColor: "transparent" }}>
          <ArrowLeftIcon size={14} /> Back
        </button>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>
          {isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}
        </h2>
        <p style={{ fontSize: 13, color: "#71717A", marginBottom: 24, lineHeight: 1.6 }}>
          {isMnemonicView ? "Enter your 12 or 24 word recovery phrase, separated by spaces." : "Enter your private key (with or without 0x prefix)."}
        </p>
        <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 4, marginBottom: 12 }}>
          <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)}
            placeholder={isMnemonicView ? "word1 word2 word3 word4 ..." : "0x..."}
            rows={isMnemonicView ? 4 : 2}
            style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", borderRadius: 12, color: "#F4F4F5", fontSize: 14, resize: "none", ...mono, outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Set wallet password (min 8 characters)"
            style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Confirm password"
            style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {(importError || passwordError) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
            <div style={{ color: "#EF4444", flexShrink: 0 }}><AlertTriangleIcon size={12} /></div>
            <p style={{ color: "#EF4444", fontSize: 12 }}>{importError || passwordError}</p>
          </div>
        )}
        <button type="button" onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
          disabled={importInput.trim().length === 0 || importing}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "15px", width: "100%", marginTop: 16,
            background: importInput.trim().length === 0 || importing ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)",
            border: "none", borderRadius: 14,
            color: importInput.trim().length === 0 || importing ? "#3F3F46" : "#FFFFFF",
            fontSize: 15, fontWeight: 600,
            cursor: importInput.trim().length === 0 || importing ? "default" : "pointer",
            boxShadow: importInput.trim().length === 0 || importing ? "none" : "0 4px 20px rgba(249,115,22,0.2)",
            WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          }}>
          {importing && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          {importing ? "Importing..." : "Import Wallet"}
        </button>
      </div>
    );
  }

  // ── Main Wallet View ──────────────────────────────────────────────────────────

  const addr = walletData?.address || "";
  const truncAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const px = isMobile ? "20px" : "32px";

  return (
    <div className="page-enter" style={{ paddingBottom: 48 }}>

      {/* ── Hero: Total Portfolio Value ── */}
      <div style={{
        padding: `${isMobile ? 32 : 48}px ${px} ${isMobile ? 32 : 40}px`,
        background: "linear-gradient(180deg, rgba(249,115,22,0.08) 0%, rgba(249,115,22,0.02) 40%, transparent 100%)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle radial glow behind balance */}
        <div style={{
          position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* VNS / Address pill */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={() => setShowFullAddress(!showFullAddress)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 24,
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#A1A1AA", fontSize: 12, fontWeight: 500,
                cursor: "pointer", ...mono, transition: "all 0.2s ease",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22C55E", flexShrink: 0, boxShadow: "0 0 8px rgba(34,197,94,0.4)" }} />
              {vnsName ? <span style={{ color: "#F97316", fontWeight: 700 }}>{vnsName}</span> : null}
              <span style={{ color: "#71717A" }}>{showFullAddress ? addr : truncAddr}</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); copyToClipboard(addr, "addr"); }}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, cursor: "pointer",
                color: copied === "addr" ? "#22C55E" : "#52525B",
                padding: 8, display: "flex", alignItems: "center",
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.15s ease",
              }}
            >
              {copied === "addr" ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            </button>
          </div>
        </div>

        {/* Total USD Value — the star of the show */}
        <div style={{ textAlign: "center", marginBottom: 36, position: "relative" }}>
          {loadingBals || pricesLoading ? (
            <>
              <div className="skeleton" style={{ height: 64, width: 240, borderRadius: 16, margin: "0 auto 12px" }} />
              <div className="skeleton" style={{ height: 14, width: 160, borderRadius: 8, margin: "0 auto" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#52525B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Total Balance</p>
              <h1 style={{
                fontSize: isMobile ? 48 : 60, fontWeight: 800,
                color: "#FAFAFA", letterSpacing: "-0.04em",
                lineHeight: 1.0, marginBottom: 10, ...mono,
                textShadow: "0 0 60px rgba(249,115,22,0.12), 0 2px 4px rgba(0,0,0,0.3)",
              }}>
                {formatUsd(totalUsd)}
              </h1>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 20, backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
                <FireIcon size={11} />
                <span style={{ fontSize: 11, color: "#F97316", fontWeight: 600, letterSpacing: "0.02em" }}>Embris by Vaultfire</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons — Trust Wallet style */}
        <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 24 : 36, position: "relative" }}>
          <ActionBtn icon={<SendIcon size={22} />} label="Send" onClick={() => openSend()} color="#F97316" />
          <ActionBtn icon={<ReceiveIcon size={22} />} label="Receive" onClick={() => setModalView("receive")} color="#22C55E" />
          <ActionBtn icon={<RefreshIcon size={18} />} label="Refresh" onClick={handleRefresh} color="#71717A" />
          <ActionBtn icon={<ShieldIcon size={18} />} label="Security" onClick={() => { setSecurityRevealInput(""); setSecurityRevealed(false); setModalView("security"); }} color="#A78BFA" />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />

      {/* ── Asset List ── */}
      <div style={{ padding: `28px ${px} 0` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.02em" }}>Assets</h3>
          <button
            type="button"
            onClick={() => setModalView("add-token")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "#F97316",
              background: "rgba(249,115,22,0.06)",
              border: "1px solid rgba(249,115,22,0.15)", cursor: "pointer", fontWeight: 600,
              padding: "8px 14px", borderRadius: 12, transition: "all 0.15s ease",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}
          >
            <PlusIcon size={10} /> Add Token
          </button>
        </div>

        {loadingBals ? (
          <div style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20, overflow: "hidden",
          }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.03)" : "none" }} />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <ClockIcon size={24} />
            </div>
            <p style={{ fontSize: 15, color: "#A1A1AA", fontWeight: 600, marginBottom: 8 }}>No assets yet</p>
            <p style={{ fontSize: 13, color: "#52525B", lineHeight: 1.6 }}>
              Send tokens to your address to get started.
            </p>
          </div>
        ) : (
          <div style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20, overflow: "hidden",
          }}>
            {assets.map((asset, idx) => (
              <div
                key={`${asset.chain}-${asset.symbol}-${asset.tokenAddress || "native"}-${idx}`}
                role="button"
                tabIndex={0}
                onClick={() => openSend(asset)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openSend(asset); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: idx < assets.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  transition: "background-color 0.15s ease",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <TokenAvatar item={asset} size={44} />
                    {asset.type === "erc20" && <ChainBadge chain={asset.chain} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", marginBottom: 2, letterSpacing: "-0.01em" }}>{asset.name || asset.symbol}</p>
                    <p style={{ fontSize: 12, color: "#71717A", fontWeight: 500 }}>
                      {asset.symbol}{asset.type !== "native" && <span style={{ color: "#3F3F46" }}> · {asset.chainName}</span>}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: asset.error ? "#EF4444" : "#F4F4F5", ...mono, letterSpacing: "-0.02em", marginBottom: 2 }}>
                    {asset.error ? "Error" : asset.balanceFormatted}
                  </p>
                  <p style={{ fontSize: 13, color: asset.usdValue > 0 ? "#71717A" : "#3F3F46", ...mono, fontWeight: 500 }}>
                    {asset.usdValue > 0 ? formatUsd(asset.usdValue) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Spending Limits ── */}
      <div style={{ padding: `32px ${px} 0` }}>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, overflow: "hidden",
        }}>
        {/* Section header inside card */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.05))", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldIcon size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em", marginBottom: 1 }}>Spending Limits</h3>
              <p style={{ fontSize: 11, color: "#52525B", fontWeight: 400 }}>Optional caps on outgoing payments</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddLimit(!showAddLimit)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "#A78BFA",
              background: "rgba(167,139,250,0.06)",
              border: "1px solid rgba(167,139,250,0.15)", cursor: "pointer", fontWeight: 600,
              padding: "8px 14px", borderRadius: 12, transition: "all 0.15s ease",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}
          >
            <PlusIcon size={10} /> Add Limit
          </button>
        </div>
        {/* Card body */}
        <div style={{ padding: "16px 20px" }}>

        {/* Add limit form */}
        {showAddLimit && (
          <div style={{ padding: 16, backgroundColor: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: 10, color: "#71717A", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Token</label>
                <select value={newLimitToken} onChange={(e) => setNewLimitToken(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F4F4F5", fontSize: 13, outline: "none" }}>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="AVAX">AVAX</option>
                  <option value="ASM">ASM (Assemble AI)</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: 10, color: "#71717A", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Period</label>
                <select value={newLimitPeriod} onChange={(e) => setNewLimitPeriod(e.target.value as LimitPeriod)}
                  style={{ width: "100%", padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F4F4F5", fontSize: 13, outline: "none" }}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: 10, color: "#71717A", fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Max Amount</label>
                <input type="text" value={newLimitAmount} onChange={(e) => setNewLimitAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  style={{ width: "100%", padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#F4F4F5", fontSize: 13, ...mono, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <button type="button" onClick={() => {
              const id = makeLimitId(newLimitToken, newLimitPeriod);
              upsertSpendingLimit({ id, token: newLimitToken, period: newLimitPeriod, maxAmount: newLimitAmount, enabled: true, createdAt: Date.now() });
              setLimitStatuses(getAllLimitStatuses());
              setShowAddLimit(false);
              setNewLimitAmount("100");
            }} style={{
              width: "100%", padding: "10px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 10, color: "#A78BFA", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Save Limit</button>
          </div>
        )}

        {/* Active limits with progress bars */}
        {limitStatuses.length === 0 ? (
          <div style={{ padding: "20px 18px", backgroundColor: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 18, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#A1A1AA", marginBottom: 3 }}>No limits — unlimited spending</p>
              <p style={{ fontSize: 11, color: "#52525B", lineHeight: 1.5 }}>Freedom over control. Tap “Add Limit” to set a cap.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {limitStatuses.map((status) => {
              const barColor = status.exceeded ? "#EF4444" : status.percentUsed > 75 ? "#EAB308" : "#22C55E";
              return (
                <div key={status.config.id} style={{ padding: "14px 16px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5" }}>{status.config.token}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#52525B", backgroundColor: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {getPeriodLabel(status.config.period)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: barColor, fontWeight: 600, ...mono }}>
                        {status.spent.toFixed(2)} / {status.limit.toFixed(2)}
                      </span>
                      <button type="button" onClick={() => {
                        removeSpendingLimit(status.config.id);
                        setLimitStatuses(getAllLimitStatuses());
                      }} style={{ background: "none", border: "none", color: "#3F3F46", cursor: "pointer", padding: 2, display: "flex" }}>
                        <XIcon size={10} />
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: "100%", height: 6, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(status.percentUsed, 100)}%`, height: "100%", backgroundColor: barColor, borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                  <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 4 }}>
                    {status.percentUsed.toFixed(0)}% used this {getPeriodLabel(status.config.period)}
                    {status.exceeded && <span style={{ color: "#EF4444", fontWeight: 700 }}> — LIMIT EXCEEDED</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        </div>{/* end card body */}
        </div>{/* end card wrapper */}
      </div>

      {/* ── Trust Gating ── */}
      <div style={{ padding: `32px ${px} 0` }}>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LockIcon size={16} style={{ color: "#22C55E" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em", marginBottom: 1 }}>Trust Gating</h3>
              <p style={{ fontSize: 11, color: "#52525B", fontWeight: 400 }}>Require minimum bond tier for payments</p>
            </div>
          </div>
          {/* Body */}
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: 12, color: "#71717A", marginBottom: 16, lineHeight: 1.65 }}>Defaults to None — pay anyone freely. Opt in to restrict payments to verified agents.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TRUST_GATE_LEVELS.map(level => {
                const isActive = trustGateLevel === level.value;
                return (
                  <button
                    key={level.value}
                    onClick={() => {
                      setTrustGateLevel(level.value);
                      setTrustGateLevelState(level.value);
                    }}
                    style={{
                      fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 14, cursor: "pointer",
                      background: isActive ? `linear-gradient(135deg, ${level.color}20, ${level.color}08)` : "rgba(255,255,255,0.025)",
                      border: `1.5px solid ${isActive ? `${level.color}50` : "rgba(255,255,255,0.07)"}`,
                      color: isActive ? level.color : "#71717A",
                      transition: "all 0.2s ease",
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                      minHeight: 44,
                      boxShadow: isActive ? `0 4px 16px ${level.color}12` : "none",
                    }}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "#52525B", marginTop: 12, lineHeight: 1.5 }}>
              {TRUST_GATE_LEVELS.find(l => l.value === trustGateLevel)?.description || "No trust requirement set."}
            </p>
            {trustGateLevel !== "none" && (
              <div style={{ marginTop: 12, padding: "10px 14px", backgroundColor: `${TRUST_GATE_LEVELS.find(l => l.value === trustGateLevel)?.color || "#71717A"}08`, border: `1px solid ${TRUST_GATE_LEVELS.find(l => l.value === trustGateLevel)?.color || "#71717A"}20`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldIcon size={14} />
                <span style={{ fontSize: 12, color: TRUST_GATE_LEVELS.find(l => l.value === trustGateLevel)?.color || "#71717A", fontWeight: 600 }}>
                  Active — Payments below {TRUST_GATE_LEVELS.find(l => l.value === trustGateLevel)?.label} tier will show a warning
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction History (x402 payments) ── */}
      <div style={{ padding: `32px ${px} 0` }}>
        <div style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClockIcon size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em", marginBottom: 1 }}>Transactions</h3>
                <p style={{ fontSize: 11, color: "#52525B", fontWeight: 400 }}>x402 protocol payments</p>
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6", backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", padding: "4px 10px", borderRadius: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>x402</span>
          </div>
          {/* Body */}
          <div>
        {txHistory.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <ClockIcon size={24} />
            </div>
            <p style={{ fontSize: 15, color: "#A1A1AA", fontWeight: 600, marginBottom: 8 }}>No transactions yet</p>
            <p style={{ fontSize: 13, color: "#52525B", lineHeight: 1.6 }}>
              Payment history will appear here.
            </p>
          </div>
        ) : (
          <div>
            {txHistory.slice(0, 20).map((tx, txIdx) => {
              const isSent = tx.from.toLowerCase() === addr.toLowerCase();
              const counterparty = isSent ? (tx.recipientVNS || `${tx.payTo.slice(0, 8)}...${tx.payTo.slice(-4)}`) : (tx.senderVNS || `${tx.from.slice(0, 8)}...${tx.from.slice(-4)}`);
              const timeAgo = (() => {
                const diff = Date.now() - tx.timestamp;
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return "Just now";
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                const days = Math.floor(hrs / 24);
                return `${days}d ago`;
              })();
              const statusColor = tx.status === "settled" ? "#22C55E" : tx.status === "failed" ? "#EF4444" : "#EAB308";
              return (
                <div key={tx.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: txIdx < Math.min(txHistory.length, 20) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: isSent ? "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.04))" : "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))", border: `1px solid ${isSent ? "rgba(249,115,22,0.15)" : "rgba(34,197,94,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isSent ? "#F97316" : "#22C55E", flexShrink: 0 }}>
                      {isSent ? <SendIcon size={16} /> : <ReceiveIcon size={16} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5", marginBottom: 2 }}>
                        {isSent ? "Sent to" : "Received from"}{" "}
                        <span style={{ color: "#F97316" }}>{counterparty}</span>
                      </p>
                      <p style={{ fontSize: 11, color: "#52525B" }}>
                        {timeAgo} · <span style={{ color: statusColor }}>{tx.status}</span>
                        {tx.network && <> · {tx.network}</>}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: isSent ? "#F4F4F5" : "#22C55E", ...mono, letterSpacing: "-0.02em", marginBottom: 2 }}>{isSent ? "-" : "+"}{tx.amountFormatted} USDC</p>
                    {tx.txHash && (
                      <p style={{ fontSize: 10, color: "#3F3F46", ...mono }}>{tx.txHash.slice(0, 8)}...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>{/* end body */}
        </div>{/* end card wrapper */}
      </div>

      {/* ── Alpha Notice ── */}
      <div style={{ padding: `28px ${px} 0` }}>
        <div style={{ padding: "14px 18px", backgroundColor: "rgba(249,115,22,0.03)", border: "1px solid rgba(249,115,22,0.08)", borderRadius: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(249,115,22,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
            <AlertTriangleIcon size={13} />
          </div>
          <p style={{ fontSize: 12, color: "#71717A", lineHeight: 1.65 }}>
            <strong style={{ color: "#A1A1AA" }}>Alpha Software.</strong> Store funds at your own risk. You are solely responsible for your seed phrase and private keys.
          </p>
        </div>
      </div>

      {/* ── MODALS (rendered via Portal — outside any stacking context) ── */}

      {/* Security Modal */}
      {modalView === "security" && (
        <WalletModal onClose={() => { setModalView("none"); setSecurityRevealed(false); setSecurityRevealInput(""); }} title="Security & Settings">
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* VNS Section */}
            <div style={{ padding: "18px", backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)", borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F97316" }}>
                  <UserIcon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em" }}>Embris Name System (VNS)</p>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#22C55E", backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>FREE</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#52525B" }}>e.g. ghostkey316.vns · Only pay gas</p>
                </div>
              </div>
              {vnsEditing ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={vnsInput}
                    onChange={(e) => setVnsInput(e.target.value)}
                    placeholder="ghostkey316.vns"
                    autoFocus
                    style={{ flex: 1, padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 10, color: "#F4F4F5", fontSize: 14, outline: "none", ...mono }}
                    onKeyDown={(e) => { if (e.key === "Enter") saveVNS(); if (e.key === "Escape") { setVnsEditing(false); setVnsInput(""); } }}
                  />
                  <button type="button" onClick={saveVNS} style={{ padding: "10px 16px", backgroundColor: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 10, color: "#F97316", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                  <button type="button" onClick={() => { setVnsEditing(false); setVnsInput(""); }} style={{ padding: "10px 12px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#71717A", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: vnsName ? "#F97316" : "#52525B", ...mono, fontWeight: vnsName ? 600 : 400 }}>{vnsName || "Not set"}</span>
                  <button type="button" onClick={() => { setVnsEditing(true); setVnsInput(vnsName); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#A1A1AA", fontSize: 12, cursor: "pointer" }}>
                    <EditIcon size={11} /> {vnsName ? "Edit" : "Set Name"}
                  </button>
                </div>
              )}
            </div>

            {/* Companion Name Section */}
            <div style={{ padding: "18px", backgroundColor: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FireIcon size={16} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em" }}>Companion Name</p>
                  <p style={{ fontSize: 11, color: "#52525B" }}>What do you call your AI companion?</p>
                </div>
              </div>
              {companionNameEditing ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={companionNameInput}
                    onChange={(e) => setCompanionNameInput(e.target.value)}
                    placeholder="Embris, Phoenix, Nova..."
                    autoFocus
                    style={{ flex: 1, padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, color: "#F4F4F5", fontSize: 14, outline: "none" }}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCompanionName(); if (e.key === "Escape") { setCompanionNameEditing(false); setCompanionNameInput(""); } }}
                  />
                  <button type="button" onClick={saveCompanionName} style={{ padding: "10px 16px", backgroundColor: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 10, color: "#A78BFA", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
                  <button type="button" onClick={() => { setCompanionNameEditing(false); setCompanionNameInput(""); }} style={{ padding: "10px 12px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#71717A", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "#C4B5FD", fontWeight: 600 }}>{companionName}</span>
                  <button type="button" onClick={() => { setCompanionNameEditing(true); setCompanionNameInput(companionName); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#A1A1AA", fontSize: 12, cursor: "pointer" }}>
                    <EditIcon size={11} /> Rename
                  </button>
                </div>
              )}
            </div>

            {/* Recovery Phrase Section */}
            <div style={{ padding: "20px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldIcon size={16} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.01em" }}>Recovery Phrase</p>
                  <p style={{ fontSize: 11, color: "#52525B" }}>Your 12-word seed phrase</p>
                </div>
              </div>
              {!securityRevealed ? (
                <div>
                  <div style={{ padding: "12px 14px", backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 10, marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: "#EF4444", lineHeight: 1.6 }}>
                      <strong>Never share your seed phrase.</strong> Anyone with this phrase has full access to your wallet.
                    </p>
                  </div>
                  <p style={{ fontSize: 12, color: "#71717A", marginBottom: 8 }}>Type <strong style={{ color: "#A1A1AA" }}>reveal</strong> to unlock:</p>
                  <input
                    type="text"
                    value={securityRevealInput}
                    onChange={(e) => setSecurityRevealInput(e.target.value)}
                    placeholder='Type "reveal" to continue'
                    style={{
                      width: "100%", padding: "12px 14px",
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: securityRevealInput === "reveal" ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, color: "#F4F4F5", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10,
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && securityRevealInput === "reveal") setSecurityRevealed(true); }}
                  />
                  <button
                    type="button"
                    onClick={() => { if (securityRevealInput === "reveal") setSecurityRevealed(true); }}
                    disabled={securityRevealInput !== "reveal"}
                    style={{
                      width: "100%", padding: "12px",
                      background: securityRevealInput === "reveal" ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.02)",
                      border: securityRevealInput === "reveal" ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10, color: securityRevealInput === "reveal" ? "#A78BFA" : "#3F3F46",
                      fontSize: 13, fontWeight: 600, cursor: securityRevealInput === "reveal" ? "pointer" : "default",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Reveal Seed Phrase
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ padding: "14px 16px", backgroundColor: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: 10, marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: "#C4B5FD", ...mono, wordBreak: "break-all", lineHeight: 1.8 }}>{walletData?.mnemonic}</p>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(walletData?.mnemonic || "", "sec-mnemonic")} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", padding: "10px",
                    backgroundColor: copied === "sec-mnemonic" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                    border: copied === "sec-mnemonic" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, color: copied === "sec-mnemonic" ? "#22C55E" : "#71717A",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    {copied === "sec-mnemonic" ? <><CheckIcon size={11} /> Copied!</> : <><CopyIcon size={11} /> Copy Phrase</>}
                  </button>
                  <button type="button" onClick={() => setSecurityRevealed(false)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", padding: "8px", marginTop: 6,
                    backgroundColor: "transparent", border: "none",
                    color: "#52525B", fontSize: 11, cursor: "pointer",
                  }}>
                    <EyeOffIcon size={10} /> &nbsp;Hide
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div style={{ padding: "16px", backgroundColor: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>Danger Zone</p>
              <button type="button" onClick={() => { setModalView("none"); handleDelete(); }} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", width: "100%",
                backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 10, color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
              }}>
                <TrashIcon size={12} /> Delete Wallet
              </button>
            </div>
          </div>
        </WalletModal>
      )}

      {/* Receive Modal */}
      {modalView === "receive" && (
        <WalletModal onClose={() => setModalView("none")} title="Receive">
          <div style={{ padding: "24px 24px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <p style={{ fontSize: 13, color: "#71717A", textAlign: "center", lineHeight: 1.6 }}>
              Share your address to receive ETH, AVAX, or any ERC-20 token. Make sure the sender uses the correct network.
            </p>
            <QRCodeDisplay value={addr} />
            <div style={{ width: "100%", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, ...mono, fontSize: 12, color: "#A1A1AA", wordBreak: "break-all", textAlign: "center" }}>
              {vnsName && <div style={{ fontSize: 14, color: "#F97316", fontWeight: 700, marginBottom: 6 }}>{vnsName}</div>}
              {addr}
            </div>
            <button type="button" onClick={() => copyToClipboard(addr, "receive-addr")} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "14px",
              background: copied === "receive-addr" ? "rgba(34,197,94,0.1)" : "linear-gradient(135deg, #F97316, #EA580C)",
              border: copied === "receive-addr" ? "1px solid rgba(34,197,94,0.2)" : "none",
              borderRadius: 14, color: copied === "receive-addr" ? "#22C55E" : "#fff",
              fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}>
              {copied === "receive-addr" ? <><CheckIcon size={14} /> Address Copied!</> : <><CopyIcon size={14} /> Copy Address</>}
            </button>
            <div style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.08)", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ color: "#F97316", flexShrink: 0, marginTop: 1 }}><AlertTriangleIcon size={12} /></div>
              <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.6 }}>
                This address works on Ethereum, Base, and Avalanche C-Chain. Always verify the network before sending.
              </p>
            </div>
          </div>
        </WalletModal>
      )}

      {/* Send Modal */}
      {modalView === "send" && (
        <WalletModal onClose={() => setModalView("none")} title="Send">
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Token selector */}
            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Asset</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", padding: 4 }}>
                {assets.length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#52525B" }}>No assets to send. Fund your wallet first.</p>
                  </div>
                )}
                {assets.map((a, i) => (
                  <button key={i} type="button" onClick={() => setSendState(s => ({ ...s, token: a, gas: null }))} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    backgroundColor: sendState.token === a ? "rgba(249,115,22,0.08)" : "transparent",
                    border: sendState.token === a ? "1px solid rgba(249,115,22,0.2)" : "1px solid transparent",
                    borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left",
                    transition: "all 0.1s ease", WebkitTapHighlightColor: "transparent",
                  }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <TokenAvatar item={a} size={32} />
                      {a.type === "erc20" && <ChainBadge chain={a.chain} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#F4F4F5" }}>{a.symbol}</p>
                      <p style={{ fontSize: 10, color: "#52525B" }}>{a.chainName}</p>
                    </div>
                    <p style={{ fontSize: 12, color: "#A1A1AA", ...mono, flexShrink: 0 }}>{a.balanceFormatted}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Recipient Address</label>
              <input
                type="text"
                value={sendState.toAddress}
                onChange={(e) => setSendState(s => ({ ...s, toAddress: e.target.value, gas: null }))}
                placeholder="0x..."
                style={{
                  width: "100%", padding: "14px 16px", boxSizing: "border-box",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: sendState.toAddress && !isValidAddress(sendState.toAddress) ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, color: "#F4F4F5", fontSize: 14, ...mono, outline: "none",
                }}
              />
              {sendState.toAddress && !isValidAddress(sendState.toAddress) && (
                <p style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>Invalid address format</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500 }}>Amount</label>
                {sendState.token && (
                  <button type="button" onClick={() => setSendState(s => ({ ...s, amount: s.token?.balanceFormatted || "", gas: null }))}
                    style={{ fontSize: 11, color: "#F97316", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Max
                  </button>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sendState.amount}
                  onChange={(e) => setSendState(s => ({ ...s, amount: e.target.value, gas: null }))}
                  placeholder="0.0"
                  style={{
                    width: "100%", padding: "14px 70px 14px 16px", boxSizing: "border-box",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14, color: "#F4F4F5", fontSize: 18, fontWeight: 600, ...mono, outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#52525B", fontWeight: 600 }}>
                  {sendState.token?.symbol || ""}
                </span>
              </div>
              {sendState.token && sendState.amount && sendState.token.pricePerToken > 0 && (
                <p style={{ fontSize: 12, color: "#52525B", marginTop: 4, ...mono }}>
                  ≈ {formatUsd(parseFloat(sendState.amount || "0") * sendState.token.pricePerToken)}
                </p>
              )}
            </div>

            {/* Estimate gas button */}
            <button
              type="button"
              onClick={() => estimateGasForSend(sendState)}
              disabled={!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.gasLoading}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "11px", width: "100%",
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, color: "#A1A1AA", fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s ease", WebkitTapHighlightColor: "transparent",
              }}
            >
              {sendState.gasLoading ? (
                <><div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#A1A1AA", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Estimating gas...</>
              ) : sendState.gas ? (
                <><GasIcon size={12} /> Gas: ~{sendState.gas.estimatedFeeFormatted}</>
              ) : (
                <><GasIcon size={12} /> Estimate Gas</>
              )}
            </button>

            {sendState.error && (
              <div style={{ padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }}><AlertTriangleIcon size={12} /></div>
                <p style={{ fontSize: 12, color: "#EF4444", lineHeight: 1.5 }}>{sendState.error}</p>
              </div>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={handleSendConfirm}
              disabled={!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.sending}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "15px", width: "100%",
                background: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.sending)
                  ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)",
                border: "none", borderRadius: 14,
                color: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.sending) ? "#3F3F46" : "#fff",
                fontSize: 15, fontWeight: 600,
                cursor: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.sending) ? "default" : "pointer",
                boxShadow: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || sendState.sending) ? "none" : "0 4px 20px rgba(249,115,22,0.25)",
                transition: "all 0.15s ease", WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              {sendState.sending ? (
                <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Sending...</>
              ) : (
                <><SendIcon size={16} /> Send {sendState.token?.symbol || ""}</>
              )}
            </button>
          </div>
        </WalletModal>
      )}

      {/* Send Success Modal */}
      {modalView === "send-success" && (
        <WalletModal onClose={() => setModalView("none")} title="Transaction Sent">
          <div style={{ padding: "24px 24px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              backgroundColor: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckIcon size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>Transaction Submitted!</h3>
              <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6 }}>
                Your transaction has been broadcast to the network. It may take a few minutes to confirm.
              </p>
            </div>
            {sendState.txHash && (
              <div style={{ width: "100%", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <p style={{ fontSize: 11, color: "#52525B", marginBottom: 6 }}>Transaction Hash</p>
                <p style={{ fontSize: 12, color: "#A1A1AA", ...mono, wordBreak: "break-all" }}>{sendState.txHash}</p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              {sendState.txExplorerUrl && (
                <a
                  href={sendState.txExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "12px", backgroundColor: "rgba(249,115,22,0.08)",
                    border: "1px solid rgba(249,115,22,0.2)", borderRadius: 12,
                    color: "#F97316", fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  <ExternalLinkIcon size={12} /> View on Explorer
                </a>
              )}
              <button type="button" onClick={() => setModalView("none")} style={{
                flex: 1, padding: "12px",
                backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, color: "#A1A1AA", fontSize: 13, fontWeight: 600, cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}>
                Done
              </button>
            </div>
          </div>
        </WalletModal>
      )}

      {/* Add Token Modal */}
      {modalView === "add-token" && (
        <WalletModal onClose={() => { setModalView("none"); setAddTokenAddress(""); setAddTokenInfo(null); setAddTokenError(""); }} title="Add Token">
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Network</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["base", "ethereum", "avalanche"] as SupportedChain[]).map((chain) => (
                  <button key={chain} type="button" onClick={() => setAddTokenChain(chain)} style={{
                    flex: 1, padding: "10px 8px",
                    backgroundColor: addTokenChain === chain ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.03)",
                    border: addTokenChain === chain ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, color: addTokenChain === chain ? "#F97316" : "#71717A",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
                    textTransform: "capitalize", WebkitTapHighlightColor: "transparent",
                  }}>
                    {chain === "avalanche" ? "Avalanche" : chain === "base" ? "Base" : "Ethereum"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Contract Address</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={addTokenAddress}
                  onChange={(e) => { setAddTokenAddress(e.target.value); setAddTokenInfo(null); setAddTokenError(""); }}
                  placeholder="0x..."
                  style={{ flex: 1, padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, color: "#F4F4F5", fontSize: 14, ...mono, outline: "none" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLookupToken(); }}
                />
                <button type="button" onClick={handleLookupToken} disabled={addTokenLoading || !addTokenAddress}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: addTokenLoading || !addTokenAddress ? "rgba(255,255,255,0.02)" : "rgba(249,115,22,0.1)",
                    border: addTokenLoading || !addTokenAddress ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(249,115,22,0.25)",
                    borderRadius: 12, color: addTokenLoading || !addTokenAddress ? "#3F3F46" : "#F97316",
                    fontSize: 13, fontWeight: 600, cursor: addTokenLoading || !addTokenAddress ? "default" : "pointer",
                    whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent",
                  }}>
                  {addTokenLoading ? "..." : "Lookup"}
                </button>
              </div>
            </div>

            {addTokenError && (
              <div style={{ padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#EF4444" }}>{addTokenError}</p>
              </div>
            )}

            {addTokenInfo && (
              <div style={{ padding: "16px", backgroundColor: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  {addTokenInfo.logoUrl ? (
                    <img src={addTokenInfo.logoUrl} alt={addTokenInfo.symbol} style={{ width: 40, height: 40, borderRadius: "50%" }} />
                  ) : (
                    <TokenLetter symbol={addTokenInfo.symbol} color="#22C55E" size={40} />
                  )}
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#F4F4F5" }}>{addTokenInfo.symbol}</p>
                    <p style={{ fontSize: 12, color: "#71717A" }}>{addTokenInfo.name}</p>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "#52525B" }}>Decimals</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#A1A1AA" }}>{addTokenInfo.decimals}</p>
                  </div>
                </div>
                <button type="button" onClick={handleAddToken} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: "100%", padding: "12px",
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  border: "none", borderRadius: 12, color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(34,197,94,0.2)",
                  WebkitTapHighlightColor: "transparent",
                }}>
                  <PlusIcon size={14} /> Add {addTokenInfo.symbol}
                </button>
              </div>
            )}
          </div>
        </WalletModal>
      )}
    </div>
  );
}
