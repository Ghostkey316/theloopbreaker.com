"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  createWallet, importFromMnemonic, importFromPrivateKey,
  deleteWallet, isWalletCreated, getWalletAddress,
  getWalletMnemonic, getWalletPrivateKey, type WalletData,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenPrices = Record<string, number>;
interface PriceCache { prices: TokenPrices; fetchedAt: number }
type WalletView = "none" | "created" | "import-mnemonic" | "import-pk";
type ModalView = "none" | "send" | "receive" | "add-token" | "send-confirm" | "send-success" | "security";

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

// Unified asset item (native or ERC-20)
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

// ─── Price Fetching ───────────────────────────────────────────────────────────

const PRICE_TTL = 60_000;
let _priceCache: PriceCache | null = null;

const NATIVE_PRICE_IDS = ["ethereum", "avalanche-2"];

async function fetchPrices(): Promise<TokenPrices> {
  const now = Date.now();
  if (_priceCache && now - _priceCache.fetchedAt < PRICE_TTL) return _priceCache.prices;
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
    _priceCache = { prices, fetchedAt: now };
    return prices;
  } catch {
    return _priceCache?.prices || {};
  }
}

function getTokenPrice(prices: TokenPrices, coingeckoId?: string): number {
  if (!coingeckoId) return 0;
  return prices[coingeckoId] || 0;
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
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) || "[]");
  } catch { return []; }
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

// ─── Chain Token Icons ────────────────────────────────────────────────────────

function EthIcon({ size = 40 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16 4v8.87l7.5 3.35L16 4z" fill="#fff" opacity="0.6"/><path d="M16 4L8.5 16.22 16 12.87V4z" fill="#fff"/><path d="M16 21.97v6.03l7.5-10.38L16 21.97z" fill="#fff" opacity="0.6"/><path d="M16 28V21.97l-7.5-4.35L16 28z" fill="#fff"/><path d="M16 20.57l7.5-4.35L16 12.87v7.7z" fill="#fff" opacity="0.2"/><path d="M8.5 16.22l7.5 4.35v-7.7l-7.5 3.35z" fill="#fff" opacity="0.5"/></svg>);
}
function AvaxIcon({ size = 40 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#E84142"/><path d="M11.5 21h-3.2c-.5 0-.7-.3-.5-.7L15.5 8.5c.2-.4.7-.4.9 0l2 3.7c.1.2.1.5 0 .7l-5.4 7.7c-.2.3-.5.4-.8.4h-.7zm9.2 0h-3.5c-.5 0-.7-.3-.5-.7l3.5-5c.2-.4.7-.4.9 0l1.8 5c.2.4-.1.7-.5.7h-1.7z" fill="#fff"/></svg>);
}
function BaseIcon({ size = 40 }: { size?: number }) {
  return (<svg width={size} height={size} viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#0052FF"/><path d="M16 26c5.523 0 10-4.477 10-10S21.523 6 16 6c-5.2 0-9.473 3.97-9.95 9.04h13.1v1.92H6.05C6.527 22.03 10.8 26 16 26z" fill="#fff"/></svg>);
}

function TokenLetter({ symbol, color, size = 40 }: { symbol: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      backgroundColor: color + "18",
      border: `1.5px solid ${color}35`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 800, color, fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
        {symbol.slice(0, 3)}
      </span>
    </div>
  );
}

function TokenAvatar({ item, size = 40 }: { item: AssetItem; size?: number }) {
  // Show real logo if available
  if (item.logoUrl) {
    return (
      <img
        src={item.logoUrl}
        alt={item.symbol}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  // Native token icons
  if (item.type === "native") {
    if (item.chain === "avalanche") return <AvaxIcon size={size} />;
    if (item.chain === "base") return <BaseIcon size={size} />;
    return <EthIcon size={size} />;
  }

  // Fallback to colored letter
  return <TokenLetter symbol={item.symbol} color={item.logoColor || "#71717A"} size={size} />;
}

function ChainBadge({ chain }: { chain: SupportedChain }) {
  const colors: Record<SupportedChain, string> = { ethereum: "#627EEA", base: "#0052FF", avalanche: "#E84142" };
  const labels: Record<SupportedChain, string> = { ethereum: "E", base: "B", avalanche: "A" };
  return (
    <div style={{
      position: "absolute", bottom: -2, right: -2,
      width: 16, height: 16, borderRadius: "50%",
      backgroundColor: colors[chain],
      border: "2px solid #0A0A0A",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 7, color: "#fff", fontWeight: 800 }}>{labels[chain]}</span>
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title?: string }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(8px)",
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 480,
        backgroundColor: "#0F0F0F",
        borderRadius: "24px 24px 0 0",
        border: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "none",
        maxHeight: "92vh",
        overflowY: "auto",
        animation: "slideUp 0.25s ease",
      }}>
        {title && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 24px 0",
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.03em" }}>{title}</h3>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "none", cursor: "pointer", color: "#71717A",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}>
              <XIcon size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── QR Code Component ────────────────────────────────────────────────────────

function QRCodeDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: 200,
        margin: 2,
        color: { dark: "#F4F4F5", light: "#0F0F0F" },
      });
    });
  }, [value]);
  return <canvas ref={canvasRef} />;
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      width: 72, height: 72, borderRadius: 20,
      backgroundColor: `${color}15`,
      border: `1.5px solid ${color}30`,
      cursor: "pointer", transition: "all 0.15s ease",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${color}25`; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${color}15`; }}
    >
      <div style={{ color }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mono = { fontFamily: "'Courier New', monospace" };

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Wallet() {
  const [view, setView] = useState<WalletView>("none");
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
  const [tokenLogos, setTokenLogos] = useState<Record<string, string | null>>({});
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send state
  const [sendState, setSendState] = useState<SendState>({
    token: null, toAddress: "", amount: "", gas: null,
    gasLoading: false, sending: false, error: "", txHash: "", txExplorerUrl: "",
  });

  // Security state
  const [securityRevealInput, setSecurityRevealInput] = useState("");
  const [securityRevealed, setSecurityRevealed] = useState(false);

  // Add custom token state
  const [addTokenChain, setAddTokenChain] = useState<SupportedChain>("base");
  const [addTokenAddress, setAddTokenAddress] = useState("");
  const [addTokenInfo, setAddTokenInfo] = useState<TokenInfo | null>(null);
  const [addTokenLoading, setAddTokenLoading] = useState(false);
  const [addTokenError, setAddTokenError] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setCustomTokens(loadCustomTokens());
    if (isWalletCreated()) {
      const addr = getWalletAddress();
      const mnemonic = getWalletMnemonic();
      if (addr) {
        setWalletData({ address: addr, mnemonic: mnemonic || "", privateKey: getWalletPrivateKey() || "" });
        setView("created");
        loadAllBalances(addr);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "created") {
      const load = async () => {
        setPricesLoading(true);
        const p = await fetchPrices();
        setPrices(p);
        setPricesLoading(false);
      };
      load();
      priceIntervalRef.current = setInterval(load, PRICE_TTL);
    }
    return () => { if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [view]);

  // Fetch logos for all tokens
  useEffect(() => {
    const fetchLogos = async () => {
      const logos: Record<string, string | null> = {};
      const allTokens = [...tokenBalances];
      for (const token of allTokens) {
        if (token.coingeckoId && !tokenLogos[token.coingeckoId]) {
          const url = await fetchTokenLogo(token.coingeckoId);
          logos[token.coingeckoId] = url;
        }
      }
      if (Object.keys(logos).length > 0) {
        setTokenLogos((prev) => ({ ...prev, ...logos }));
      }
    };
    fetchLogos();
  }, [tokenBalances, tokenLogos]);

  const loadAllBalances = async (address: string) => {
    setLoadingBals(true);
    const customs = loadCustomTokens();
    const [native, tokens] = await Promise.all([
      getAllBalances(address),
      fetchAllTokenBalances(address, customs),
    ]);
    setNativeBalances(native);
    setTokenBalances(tokens);
    setLoadingBals(false);
  };

  const handleRefresh = useCallback(async () => {
    if (!walletData) return;
    setLoadingBals(true);
    setPricesLoading(true);
    const customs = loadCustomTokens();
    const [native, tokens, p] = await Promise.all([
      getAllBalances(walletData.address),
      fetchAllTokenBalances(walletData.address, customs),
      fetchPrices(),
    ]);
    setNativeBalances(native);
    setTokenBalances(tokens);
    setPrices(p);
    setLoadingBals(false);
    setPricesLoading(false);
  }, [walletData]);

  // Build unified asset list — ONLY SHOW OWNED TOKENS (balance > 0)
  const buildAssets = useCallback((): AssetItem[] => {
    const items: AssetItem[] = [];

    // Native tokens
    for (const bal of nativeBalances) {
      const amount = parseFloat(bal.balanceFormatted);
      if (amount <= 0) continue; // Skip zero balance

      const chain: SupportedChain = bal.chain.toLowerCase().includes("avalanche") ? "avalanche"
        : bal.chain.toLowerCase().includes("base") ? "base" : "ethereum";
      const chainCfg = TX_CHAINS[chain];
      const priceId = chain === "avalanche" ? "avalanche-2" : "ethereum";
      const pricePerToken = getTokenPrice(prices, priceId);

      items.push({
        type: "native",
        chain,
        chainConfig: chainCfg,
        symbol: bal.symbol,
        name: `${bal.symbol} on ${bal.chain}`,
        chainName: bal.chain,
        decimals: 18,
        balanceFormatted: bal.balanceFormatted,
        balanceRaw: bal.balance,
        usdValue: amount * pricePerToken,
        pricePerToken,
        error: bal.error,
      });
    }

    // ERC-20 tokens — ONLY SHOW IF BALANCE > 0
    for (const tb of tokenBalances) {
      const amount = parseFloat(tb.balanceFormatted);
      if (amount <= 0) continue; // Skip zero balance

      const pricePerToken = getTokenPrice(prices, tb.coingeckoId);
      const chainLabel = { ethereum: "Ethereum", base: "Base", avalanche: "Avalanche" }[tb.chain];
      const logoUrl = tb.coingeckoId ? tokenLogos[tb.coingeckoId] : undefined;

      items.push({
        type: "erc20",
        chain: tb.chain,
        chainConfig: TX_CHAINS[tb.chain],
        symbol: tb.symbol,
        name: tb.name,
        chainName: chainLabel,
        decimals: tb.decimals,
        balanceFormatted: tb.balanceFormatted,
        balanceRaw: tb.balanceRaw,
        usdValue: amount * pricePerToken,
        pricePerToken,
        tokenAddress: tb.address,
        coingeckoId: tb.coingeckoId,
        logoUrl: logoUrl || undefined,
        logoColor: tb.logoColor,
      });
    }

    // Sort: native first, then ERC-20 by USD value desc
    const nativeItems = items.filter((a) => a.type === "native");
    const erc20Items = items.filter((a) => a.type === "erc20").sort((a, b) => b.usdValue - a.usdValue);
    return [...nativeItems, ...erc20Items];
  }, [nativeBalances, tokenBalances, prices, tokenLogos]);

  const assets = buildAssets();
  const totalUsd = assets.reduce((sum, a) => sum + a.usdValue, 0);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await createWallet();
      setWalletData(data);
      setView("created");
      loadAllBalances(data.address);
    } finally { setCreating(false); }
  };

  const handleImportMnemonic = async () => {
    setImportError(""); setImporting(true);
    try {
      const data = await importFromMnemonic(importInput);
      setWalletData(data); setView("created"); setImportInput("");
      loadAllBalances(data.address);
    } catch { setImportError("Invalid mnemonic phrase. Please check and try again."); }
    finally { setImporting(false); }
  };

  const handleImportPK = async () => {
    setImportError(""); setImporting(true);
    try {
      const data = await importFromPrivateKey(importInput);
      setWalletData(data); setView("created"); setImportInput("");
      loadAllBalances(data.address);
    } catch { setImportError("Invalid private key. Please check and try again."); }
    finally { setImporting(false); }
  };

  const handleDelete = () => {
    if (confirm("Delete this wallet? Make sure you have your seed phrase backed up.")) {
      deleteWallet();
      setWalletData(null); setNativeBalances([]); setTokenBalances([]);
      setView("none");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // ── Send flow ────────────────────────────────────────────────────────────────

  const openSend = (token?: AssetItem) => {
    setSendState({
      token: token || null, toAddress: "", amount: "",
      gas: null, gasLoading: false, sending: false,
      error: "", txHash: "", txExplorerUrl: "",
    });
    setModalView("send");
  };

  const estimateGasForSend = useCallback(async (state: SendState) => {
    if (!state.token || !isValidAddress(state.toAddress) || !state.amount || !walletData) return;
    const amount = parseFloat(state.amount);
    if (isNaN(amount) || amount <= 0) return;

    setSendState((s) => ({ ...s, gasLoading: true, gas: null }));
    try {
      let gas: GasEstimate;
      if (state.token.type === "native") {
        gas = await estimateNativeSendGas(
          state.token.chainConfig, walletData.address, state.toAddress, state.amount
        );
      } else {
        const rawAmount = parseTokenAmount(state.amount, state.token.decimals);
        gas = await estimateERC20SendGas(
          state.token.chainConfig, walletData.address,
          state.token.tokenAddress!, state.toAddress, rawAmount
        );
      }
      setSendState((s) => ({ ...s, gas, gasLoading: false }));
    } catch {
      setSendState((s) => ({ ...s, gasLoading: false }));
    }
  }, [walletData]);

  const handleSendConfirm = async () => {
    if (!sendState.token || !walletData) return;
    const pk = getWalletPrivateKey();
    if (!pk) { setSendState((s) => ({ ...s, error: "Private key not found." })); return; }

    setSendState((s) => ({ ...s, sending: true, error: "" }));
    try {
      let result;
      if (sendState.token.type === "native") {
        result = await sendNativeToken(
          sendState.token.chainConfig, pk, walletData.address,
          sendState.toAddress, sendState.amount
        );
      } else {
        const rawAmount = parseTokenAmount(sendState.amount, sendState.token.decimals);
        result = await sendERC20Token(
          sendState.token.chainConfig, pk, walletData.address,
          sendState.token.tokenAddress!, sendState.toAddress, rawAmount
        );
      }
      setSendState((s) => ({ ...s, sending: false, txHash: result.hash, txExplorerUrl: result.explorerUrl }));
      setModalView("send-success");
      setTimeout(() => loadAllBalances(walletData.address), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setSendState((s) => ({ ...s, sending: false, error: msg }));
    }
  };

  // ── Add custom token ─────────────────────────────────────────────────────────

  const handleLookupToken = async () => {
    if (!isValidAddress(addTokenAddress)) {
      setAddTokenError("Invalid contract address"); return;
    }
    setAddTokenLoading(true); setAddTokenError(""); setAddTokenInfo(null);
    
    // Try CoinGecko lookup first
    const cgResult = await lookupTokenOnCoinGecko(addTokenChain, addTokenAddress);
    if (cgResult) {
      const info = await fetchTokenInfo(addTokenChain, addTokenAddress);
      if (info) {
        setAddTokenInfo({
          ...info,
          coingeckoId: cgResult.coingeckoId,
          logoUrl: cgResult.logoUrl,
        });
        setAddTokenLoading(false);
        return;
      }
    }

    // Fallback: just fetch from chain
    const info = await fetchTokenInfo(addTokenChain, addTokenAddress);
    if (!info) {
      setAddTokenError("Token not found on this chain. Check the address and network.");
    } else {
      setAddTokenInfo(info);
    }
    setAddTokenLoading(false);
  };

  const handleAddToken = async () => {
    if (!addTokenInfo || !walletData) return;
    const updated = [...customTokens, addTokenInfo];
    setCustomTokens(updated);
    saveCustomTokens(updated);
    const bal = await fetchTokenBalance(addTokenInfo, walletData.address);
    setTokenBalances((prev) => [...prev, bal]);
    setAddTokenAddress(""); setAddTokenInfo(null); setAddTokenError("");
    setModalView("none");
  };

  // ── Onboarding ────────────────────────────────────────────────────────────────

  if (view === "none") {
    return (
      <div className="page-enter" style={{
        padding: isMobile ? "24px 20px 48px" : "48px 40px",
        maxWidth: 480, margin: "0 auto",
        display: "flex", flexDirection: "column", minHeight: "100%",
      }}>
        <div style={{ textAlign: "center", marginBottom: 40, paddingTop: isMobile ? 20 : 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24,
            background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.04))",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, marginLeft: "auto", marginRight: "auto",
          }}>
            <ShieldIcon size={32} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>Vaultfire Wallet</h1>
          <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.7, marginBottom: 28 }}>
            Secure multi-chain wallet for Ethereum, Base, and Avalanche. Full control of your assets.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {[
            { icon: <PlusIcon size={20} />, label: "Create New Wallet", sub: "Generate a new seed phrase", onClick: handleCreate },
            { icon: <FileTextIcon size={20} />, label: "Import Seed Phrase", sub: "12 or 24 word recovery phrase", onClick: () => setView("import-mnemonic") },
            { icon: <KeyIcon size={20} />, label: "Import Private Key", sub: "Direct private key import", onClick: () => setView("import-pk") },
          ].map((item) => (
            <button key={item.label} onClick={item.onClick} disabled={creating || importing} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px", borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              color: "#F4F4F5", cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; }}
            >
              <div style={{ color: "#F97316" }}>{item.icon}</div>
              <div>
                <div>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: "#71717A", marginTop: 2 }}>{item.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: "14px 16px", backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)", borderRadius: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: "#F97316", marginTop: 1, flexShrink: 0 }}><AlertTriangleIcon size={14} /></div>
          <div>
            <p style={{ fontSize: 12, color: "#F97316", fontWeight: 600, marginBottom: 4 }}>Alpha Software</p>
            <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.65 }}>
              Store funds at your own risk. No recovery possible — you are solely responsible for your seed phrase and private keys. Embris and Vaultfire Protocol are not liable for any losses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Import views ──────────────────────────────────────────────────────────────

  if (view === "import-mnemonic" || view === "import-pk") {
    const isMnemonicView = view === "import-mnemonic";
    return (
      <div className="page-enter" style={{ padding: isMobile ? "24px 20px 48px" : "48px 40px", maxWidth: 480, margin: "0 auto" }}>
        <button onClick={() => { setView("none"); setImportInput(""); setImportError(""); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#71717A", cursor: "pointer", marginBottom: 32, fontSize: 13, padding: 0, fontWeight: 500 }}
        >
          <ArrowLeftIcon size={14} /> Back
        </button>
        <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: "#A1A1AA" }}>
          {isMnemonicView ? <FileTextIcon size={22} /> : <KeyIcon size={22} />}
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.04em" }}>
          {isMnemonicView ? "Import Seed Phrase" : "Import Private Key"}
        </h2>
        <p style={{ fontSize: 14, color: "#71717A", marginBottom: 28, lineHeight: 1.7 }}>
          {isMnemonicView ? "Enter your 12 or 24 word recovery phrase, separated by spaces." : "Enter your private key (with or without 0x prefix)."}
        </p>
        <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: importError ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 2 }}>
          <textarea value={importInput} onChange={(e) => setImportInput(e.target.value)}
            placeholder={isMnemonicView ? "word1 word2 word3 word4 ..." : "0x..."}
            rows={isMnemonicView ? 4 : 2}
            style={{ width: "100%", padding: "14px 16px", background: "transparent", border: "none", borderRadius: 12, color: "#F4F4F5", fontSize: 14, resize: "none", ...mono, outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
          />
        </div>
        {importError && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10 }}>
            <div style={{ color: "#EF4444", flexShrink: 0 }}><AlertTriangleIcon size={12} /></div>
            <p style={{ color: "#EF4444", fontSize: 12 }}>{importError}</p>
          </div>
        )}
        <button onClick={isMnemonicView ? handleImportMnemonic : handleImportPK}
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
          }}>
          {importing && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#3F3F46", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
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
        padding: `${isMobile ? 28 : 40}px ${px} ${isMobile ? 24 : 32}px`,
        background: "linear-gradient(180deg, rgba(249,115,22,0.04) 0%, transparent 100%)",
      }}>
        {/* Address pill */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <button
            onClick={() => setShowFullAddress(!showFullAddress)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#A1A1AA", fontSize: 12, fontWeight: 500,
              cursor: "pointer", ...mono, transition: "all 0.15s ease",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22C55E" }} />
            {showFullAddress ? addr : truncAddr}
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(addr, "addr"); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: copied === "addr" ? "#22C55E" : "#52525B", padding: 0, display: "flex" }}
            >
              {copied === "addr" ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
            </button>
          </button>
        </div>

        {/* Total USD Value — THE MOST PROMINENT THING */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {loadingBals || pricesLoading ? (
            <div className="skeleton" style={{ height: 52, width: 200, borderRadius: 12, margin: "0 auto 8px" }} />
          ) : (
            <h1 style={{
              fontSize: isMobile ? 44 : 52, fontWeight: 800,
              color: "#F4F4F5", letterSpacing: "-0.04em",
              lineHeight: 1.1, marginBottom: 6,
              ...mono,
            }}>
              {formatUsd(totalUsd)}
            </h1>
          )}
          <p style={{ fontSize: 13, color: "#52525B", fontWeight: 500 }}>Total Portfolio Value</p>
        </div>

        {/* Vaultfire Protocol badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            backgroundColor: "rgba(249,115,22,0.06)",
            border: "1px solid rgba(249,115,22,0.15)",
          }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="#F97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            <span style={{ fontSize: 11, color: "#F97316", fontWeight: 600, letterSpacing: "0.02em" }}>Powered by Vaultfire Protocol</span>
          </div>
        </div>

        {/* Action Buttons — Coinbase-style circular */}
        <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 24 : 32 }}>
          <ActionBtn icon={<SendIcon size={22} />} label="Send" onClick={() => openSend()} color="#F97316" />
          <ActionBtn icon={<ReceiveIcon size={22} />} label="Receive" onClick={() => setModalView("receive")} color="#22C55E" />
          <ActionBtn icon={<RefreshIcon size={18} />} label="Refresh" onClick={handleRefresh} color="#71717A" />
          <ActionBtn icon={<ShieldIcon size={18} />} label="Settings" onClick={() => { setSecurityRevealInput(""); setSecurityRevealed(false); setModalView("security"); }} color="#A78BFA" />
        </div>
      </div>

      {/* ── Asset List ── */}
      <div style={{ padding: `0 ${px}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: 8 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#F4F4F5", letterSpacing: "-0.02em" }}>Assets</h3>
          <button onClick={() => setModalView("add-token")} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, color: "#F97316", background: "none",
            border: "1px solid rgba(249,115,22,0.2)", cursor: "pointer", fontWeight: 600,
            padding: "5px 12px", borderRadius: 8, transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <PlusIcon size={10} /> Add Token
          </button>
        </div>

        {loadingBals ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 16, border: "1px solid rgba(255,255,255,0.03)" }} />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            backgroundColor: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 16,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <ClockIcon size={24} />
            </div>
            <p style={{ fontSize: 14, color: "#71717A", marginBottom: 12 }}>No assets yet</p>
            <p style={{ fontSize: 12, color: "#52525B", lineHeight: 1.6 }}>
              Send tokens to your address to get started, or add a custom token to track your holdings.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {assets.map((asset, idx) => (
              <div key={`${asset.chain}-${asset.symbol}-${asset.tokenAddress || "native"}-${idx}`}
                onClick={() => openSend(asset)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 16,
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <TokenAvatar item={asset} size={42} />
                    {asset.type === "erc20" && <ChainBadge chain={asset.chain} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#F4F4F5", marginBottom: 2, letterSpacing: "-0.01em" }}>
                      {asset.symbol}
                    </p>
                    <p style={{ fontSize: 11, color: "#52525B" }}>
                      {asset.type === "native" ? asset.chainName : `${asset.name} · ${asset.chainName}`}
                      {asset.pricePerToken > 0 && (
                        <span style={{ color: "#3F3F46" }}> · {formatPrice(asset.pricePerToken)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: asset.error ? "#EF4444" : "#F4F4F5", ...mono, letterSpacing: "-0.02em", marginBottom: 2 }}>
                    {asset.error ? "Error" : asset.balanceFormatted}
                  </p>
                  <p style={{ fontSize: 12, color: "#52525B", ...mono }}>
                    {asset.usdValue > 0 ? formatUsd(asset.usdValue) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Alpha Notice ── */}
      <div style={{ padding: `24px ${px} 0` }}>
        <div style={{ padding: "12px 16px", backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: "#F97316", flexShrink: 0, marginTop: 1 }}><AlertTriangleIcon size={13} /></div>
          <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.6 }}>
            <strong style={{ color: "#A1A1AA" }}>Alpha Software.</strong> Store funds at your own risk. No recovery possible — you are solely responsible for your seed phrase and private keys. Embris and Vaultfire Protocol are not liable for any losses.
          </p>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Security Modal */}
      {modalView === "security" && (
        <Modal onClose={() => { setModalView("none"); setSecurityRevealed(false); setSecurityRevealInput(""); }} title="Security">
          <div style={{ padding: "24px 24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
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
                      <strong>Never share your seed phrase.</strong> Anyone with this phrase has full access to your wallet. Vaultfire will never ask for it.
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
                      borderRadius: 10, color: "#F4F4F5", fontSize: 14,
                      outline: "none", boxSizing: "border-box", marginBottom: 10,
                    }}
                  />
                  <button
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
                  <button onClick={() => copyToClipboard(walletData?.mnemonic || "", "sec-mnemonic")} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", padding: "10px",
                    backgroundColor: copied === "sec-mnemonic" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                    border: copied === "sec-mnemonic" ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, color: copied === "sec-mnemonic" ? "#22C55E" : "#71717A",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    {copied === "sec-mnemonic" ? <><CheckIcon size={11} /> Copied!</> : <><CopyIcon size={11} /> Copy Phrase</>}
                  </button>
                  <button onClick={() => setSecurityRevealed(false)} style={{
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
              <button onClick={() => { setModalView("none"); handleDelete(); }} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", width: "100%",
                backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 10, color: "#EF4444", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.06)"; }}
              >
                <TrashIcon size={12} /> Delete Wallet
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receive Modal */}
      {modalView === "receive" && (
        <Modal onClose={() => setModalView("none")} title="Receive">
          <div style={{ padding: "24px 24px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <p style={{ fontSize: 13, color: "#71717A", textAlign: "center", lineHeight: 1.6 }}>
              Share your address to receive ETH, AVAX, or any ERC-20 token. Make sure the sender uses the correct network.
            </p>
            <QRCodeDisplay value={addr} />
            <div style={{ width: "100%", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, ...mono, fontSize: 12, color: "#A1A1AA", wordBreak: "break-all", textAlign: "center" }}>
              {addr}
            </div>
            <button onClick={() => copyToClipboard(addr, "receive-addr")} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "14px",
              background: copied === "receive-addr" ? "rgba(34,197,94,0.1)" : "linear-gradient(135deg, #F97316, #EA580C)",
              border: copied === "receive-addr" ? "1px solid rgba(34,197,94,0.2)" : "none",
              borderRadius: 14, color: copied === "receive-addr" ? "#22C55E" : "#fff",
              fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
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
        </Modal>
      )}

      {/* Send Modal */}
      {modalView === "send" && (
        <Modal onClose={() => setModalView("none")} title="Send">
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
                  <button key={i} onClick={() => setSendState((s) => ({ ...s, token: a, gas: null }))} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    backgroundColor: sendState.token === a ? "rgba(249,115,22,0.08)" : "transparent",
                    border: sendState.token === a ? "1px solid rgba(249,115,22,0.2)" : "1px solid transparent",
                    borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left",
                    transition: "all 0.1s ease",
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
                value={sendState.toAddress}
                onChange={(e) => setSendState((s) => ({ ...s, toAddress: e.target.value, gas: null }))}
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
                  <button onClick={() => setSendState((s) => ({ ...s, amount: s.token?.balanceFormatted || "", gas: null }))}
                    style={{ fontSize: 11, color: "#F97316", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Max
                  </button>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  value={sendState.amount}
                  onChange={(e) => setSendState((s) => ({ ...s, amount: e.target.value, gas: null }))}
                  placeholder="0.0"
                  type="text"
                  inputMode="decimal"
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
            {sendState.token && isValidAddress(sendState.toAddress) && sendState.amount && !sendState.gas && (
              <button onClick={() => estimateGasForSend(sendState)} disabled={sendState.gasLoading} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px", width: "100%",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, color: "#A1A1AA", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                {sendState.gasLoading ? (
                  <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#71717A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                ) : null}
                {sendState.gasLoading ? "Estimating gas..." : "Estimate Gas Fee"}
              </button>
            )}

            {/* Gas estimate display */}
            {sendState.gas && (
              <div style={{ padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#71717A" }}>Estimated Gas</span>
                <span style={{ fontSize: 13, color: "#A1A1AA", fontWeight: 600, ...mono }}>
                  ~{sendState.gas.estimatedFeeFormatted} {sendState.token?.chainConfig.symbol}
                </span>
              </div>
            )}

            {sendState.error && (
              <div style={{ padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#EF4444" }}>{sendState.error}</p>
              </div>
            )}

            {/* Review button */}
            <button
              onClick={() => setModalView("send-confirm")}
              disabled={!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || !sendState.gas}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "15px", width: "100%",
                background: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || !sendState.gas) ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)",
                border: "none", borderRadius: 14,
                color: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || !sendState.gas) ? "#3F3F46" : "#fff",
                fontSize: 15, fontWeight: 600,
                cursor: (!sendState.token || !isValidAddress(sendState.toAddress) || !sendState.amount || !sendState.gas) ? "default" : "pointer",
                boxShadow: (sendState.token && isValidAddress(sendState.toAddress) && sendState.amount && sendState.gas) ? "0 4px 20px rgba(249,115,22,0.2)" : "none",
              }}
            >
              Review Transaction
            </button>
          </div>
        </Modal>
      )}

      {/* Send Confirmation Modal */}
      {modalView === "send-confirm" && sendState.token && (
        <Modal onClose={() => setModalView("send")} title="Confirm Transaction">
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <div style={{ position: "relative" }}>
                  <TokenAvatar item={sendState.token} size={56} />
                  {sendState.token.type === "erc20" && <ChainBadge chain={sendState.token.chain} />}
                </div>
              </div>
              <p style={{ fontSize: 36, fontWeight: 800, color: "#F4F4F5", letterSpacing: "-0.03em", ...mono }}>
                {sendState.amount} {sendState.token.symbol}
              </p>
              {sendState.token.pricePerToken > 0 && (
                <p style={{ fontSize: 14, color: "#52525B", marginTop: 4 }}>
                  ≈ {formatUsd(parseFloat(sendState.amount || "0") * sendState.token.pricePerToken)}
                </p>
              )}
            </div>

            <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
              {[
                { label: "To", value: `${sendState.toAddress.slice(0, 6)}...${sendState.toAddress.slice(-4)}`, isMono: true },
                { label: "Gas Fee", value: `~${sendState.gas?.estimatedFeeFormatted} ${sendState.token.chainConfig.symbol}` },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontSize: 13, color: "#71717A" }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: "#F4F4F5", fontWeight: 500, ...(row.isMono ? mono : {}) }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 14px", backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }}><AlertTriangleIcon size={12} /></div>
              <p style={{ fontSize: 11, color: "#71717A", lineHeight: 1.6 }}>
                This transaction is irreversible. Double-check the recipient address and amount before confirming.
              </p>
            </div>

            {sendState.error && (
              <div style={{ padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "#EF4444" }}>{sendState.error}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalView("send")} style={{ flex: 1, padding: "14px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, color: "#A1A1AA", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Back
              </button>
              <button onClick={handleSendConfirm} disabled={sendState.sending} style={{
                flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px",
                background: sendState.sending ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)",
                border: "none", borderRadius: 14,
                color: sendState.sending ? "#3F3F46" : "#fff",
                fontSize: 15, fontWeight: 600, cursor: sendState.sending ? "default" : "pointer",
                boxShadow: sendState.sending ? "none" : "0 4px 20px rgba(249,115,22,0.2)",
              }}>
                {sendState.sending && <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#3F3F46", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                {sendState.sending ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Send Success Modal */}
      {modalView === "send-success" && (
        <Modal onClose={() => setModalView("none")} title="">
          <div style={{ padding: "32px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckIcon size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#F4F4F5", marginBottom: 8, letterSpacing: "-0.03em" }}>Transaction Sent!</h3>
              <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.6 }}>Your transaction has been broadcast to the network.</p>
            </div>
            <div style={{ width: "100%", padding: "12px 16px", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
              <p style={{ fontSize: 11, color: "#52525B", marginBottom: 4 }}>Transaction Hash</p>
              <p style={{ fontSize: 12, color: "#A1A1AA", ...mono, wordBreak: "break-all" }}>{sendState.txHash}</p>
            </div>
            <a href={sendState.txExplorerUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "12px 20px", borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#F97316", fontSize: 13, fontWeight: 600,
              textDecoration: "none", transition: "all 0.15s ease",
            }}>
              View on Explorer <ExternalLinkIcon size={12} />
            </a>
            <button onClick={() => { setModalView("none"); }} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #F97316, #EA580C)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* Add Custom Token Modal */}
      {modalView === "add-token" && (
        <Modal onClose={() => { setModalView("none"); setAddTokenAddress(""); setAddTokenInfo(null); setAddTokenError(""); }} title="Add Custom Token">
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 13, color: "#71717A", lineHeight: 1.6 }}>
              Add any ERC-20 token on Ethereum, Base, or Avalanche C-Chain by pasting its contract address.
            </p>

            {/* Chain selector */}
            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Network</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["ethereum", "base", "avalanche"] as SupportedChain[]).map((c) => {
                  const labels = { ethereum: "Ethereum", base: "Base", avalanche: "Avalanche" };
                  const colors = { ethereum: "#627EEA", base: "#0052FF", avalanche: "#E84142" };
                  return (
                    <button key={c} onClick={() => { setAddTokenChain(c); setAddTokenInfo(null); setAddTokenError(""); }} style={{
                      flex: 1, padding: "10px 8px",
                      backgroundColor: addTokenChain === c ? `${colors[c]}15` : "rgba(255,255,255,0.02)",
                      border: addTokenChain === c ? `1px solid ${colors[c]}40` : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, color: addTokenChain === c ? colors[c] : "#71717A",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
                    }}>
                      {labels[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contract address */}
            <div>
              <label style={{ fontSize: 12, color: "#71717A", fontWeight: 500, display: "block", marginBottom: 8 }}>Contract Address</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={addTokenAddress}
                  onChange={(e) => { setAddTokenAddress(e.target.value); setAddTokenInfo(null); setAddTokenError(""); }}
                  placeholder="0x..."
                  style={{
                    flex: 1, padding: "12px 14px", boxSizing: "border-box",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: addTokenError ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, color: "#F4F4F5", fontSize: 13, ...mono, outline: "none",
                  }}
                />
                <button onClick={handleLookupToken} disabled={addTokenLoading || !isValidAddress(addTokenAddress)} style={{
                  padding: "12px 16px", borderRadius: 12,
                  backgroundColor: isValidAddress(addTokenAddress) ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.02)",
                  border: isValidAddress(addTokenAddress) ? "1px solid rgba(249,115,22,0.2)" : "1px solid rgba(255,255,255,0.06)",
                  color: isValidAddress(addTokenAddress) ? "#F97316" : "#3F3F46",
                  fontSize: 12, fontWeight: 600, cursor: isValidAddress(addTokenAddress) ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}>
                  {addTokenLoading ? "..." : "Look Up"}
                </button>
              </div>
              {addTokenError && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>{addTokenError}</p>}
            </div>

            {/* Token preview */}
            {addTokenInfo && (
              <div style={{ padding: "14px 16px", backgroundColor: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {addTokenInfo.logoUrl ? (
                    <img src={addTokenInfo.logoUrl} alt={addTokenInfo.symbol} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <TokenLetter symbol={addTokenInfo.symbol} color="#71717A" size={40} />
                  )}
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#F4F4F5" }}>{addTokenInfo.name}</p>
                    <p style={{ fontSize: 12, color: "#52525B", ...mono }}>{addTokenInfo.symbol} · {addTokenInfo.decimals} decimals</p>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#22C55E" }}>
                      <CheckIcon size={12} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Found</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleAddToken} disabled={!addTokenInfo} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "15px", width: "100%",
              background: !addTokenInfo ? "rgba(255,255,255,0.03)" : "linear-gradient(135deg, #F97316, #EA580C)",
              border: "none", borderRadius: 14,
              color: !addTokenInfo ? "#3F3F46" : "#fff",
              fontSize: 15, fontWeight: 600,
              cursor: !addTokenInfo ? "default" : "pointer",
              boxShadow: addTokenInfo ? "0 4px 20px rgba(249,115,22,0.2)" : "none",
            }}>
              Add Token
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
