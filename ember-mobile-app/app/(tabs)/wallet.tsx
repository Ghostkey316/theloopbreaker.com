import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ChainBalance,
  SUPPORTED_CHAINS,
  createWallet,
  deleteWallet,
  formatWei,
  getAllBalances,
  getWalletAddress,
  getWalletMnemonic,
  getWalletPrivateKey,
  importFromMnemonic,
  importFromPrivateKey,
  isWalletCreated,
} from "@/lib/wallet-core";
import {
  type TokenBalance,
  type TokenInfo,
  type SupportedChain,
  FEATURED_TOKENS,
  fetchAllTokenBalances,
  fetchTokenBalance,
  fetchTokenLogo,
  lookupTokenOnCoinGecko,
  fetchTokenInfo,
  formatTokenAmount,
  parseTokenAmount,
} from "@/lib/erc20";
import {
  type TxChainConfig,
  TX_CHAINS,
  estimateNativeSendGas,
  estimateERC20SendGas,
  sendNativeToken,
  sendERC20Token,
  type GasEstimate,
  type TxResult,
} from "@/lib/transactions";
import { Platform, StyleSheet } from "react-native";

// ─── Types ───────────────────────────────────────────────────────────

type WalletPhase =
  | "loading"
  | "onboarding"
  | "creating"
  | "backup"
  | "verify"
  | "import"
  | "ready";

type SubView = "main" | "send" | "receive" | "addToken" | "security" | "sendConfirm" | "sendResult";

interface EmbrisMessage {
  text: string;
  isEmbris: boolean;
}

/** Unified asset item for display */
interface AssetItem {
  type: "native" | "erc20";
  chain: string;
  chainName: string;
  symbol: string;
  name: string;
  balanceFormatted: string;
  balanceRaw: string;
  usdValue: number;
  pricePerToken: number;
  logoUrl?: string;
  logoColor: string;
  decimals: number;
  tokenAddress?: string;
  coingeckoId?: string;
  chainConfig: TxChainConfig;
}

// ─── Price Cache ─────────────────────────────────────────────────────

const PRICE_CACHE_KEY = "vaultfire_price_cache";
const PRICE_TTL = 60_000; // 60 seconds

interface PriceCache {
  prices: Record<string, number>;
  fetchedAt: number;
}

async function fetchPrices(): Promise<Record<string, number>> {
  const cached = await AsyncStorage.getItem(PRICE_CACHE_KEY);
  if (cached) {
    const data: PriceCache = JSON.parse(cached);
    if (Date.now() - data.fetchedAt < PRICE_TTL) return data.prices;
  }
  try {
    const ids = "ethereum,avalanche-2,usd-coin,tether,dai,weth,wrapped-avax,joe,assemble-protocol";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      prices[id] = (val as { usd?: number }).usd ?? 0;
    }
    await AsyncStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ prices, fetchedAt: Date.now() }));
    return prices;
  } catch {
    return {};
  }
}

function getTokenPrice(prices: Record<string, number>, coingeckoId?: string): number {
  if (!coingeckoId) return 0;
  return prices[coingeckoId] ?? 0;
}

// ─── Custom Token Storage ────────────────────────────────────────────

const CUSTOM_TOKENS_KEY = "vaultfire_custom_tokens_mobile";

async function loadCustomTokens(): Promise<TokenInfo[]> {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_TOKENS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

async function saveCustomTokens(tokens: TokenInfo[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

// ─── Token Icon Component ────────────────────────────────────────────

function TokenIcon({ logoUrl, logoColor, symbol, size = 40 }: {
  logoUrl?: string;
  logoColor: string;
  symbol: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  if (logoUrl && !imgError) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        overflow: "hidden", backgroundColor: `${logoColor}20`,
      }}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: logoColor, justifyContent: "center", alignItems: "center",
    }}>
      <Text style={{
        color: "#FFFFFF", fontSize: size * 0.4, fontWeight: "700",
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      }}>
        {symbol.charAt(0)}
      </Text>
    </View>
  );
}

// ─── Wallet Screen ──────────────────────────────────────────────────

export default function WalletScreen() {
  const colors = useColors();

  // ─── Core State ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<WalletPhase>("loading");
  const [subView, setSubView] = useState<SubView>("main");
  const [address, setAddress] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // ─── Onboarding State ───────────────────────────────────────────────
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<string[]>(["", "", ""]);
  const [verifyError, setVerifyError] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [embrisMessages, setEmbrisMessages] = useState<EmbrisMessage[]>([]);

  // ─── UI State ───────────────────────────────────────────────────────
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Send State ─────────────────────────────────────────────────────
  const [sendAsset, setSendAsset] = useState<AssetItem | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendGas, setSendGas] = useState<GasEstimate | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<TxResult | null>(null);

  // ─── Add Token State ────────────────────────────────────────────────
  const [addTokenAddress, setAddTokenAddress] = useState("");
  const [addTokenChain, setAddTokenChain] = useState<SupportedChain>("base");
  const [addTokenLoading, setAddTokenLoading] = useState(false);
  const [addTokenError, setAddTokenError] = useState<string | null>(null);
  const [addTokenPreview, setAddTokenPreview] = useState<TokenInfo | null>(null);

  // ─── Security State ─────────────────────────────────────────────────
  const [securityMnemonic, setSecurityMnemonic] = useState<string | null>(null);
  const [securityRevealed, setSecurityRevealed] = useState(false);
  const [securityConfirmText, setSecurityConfirmText] = useState("");

  // ─── VNS & Companion Name State ────────────────────────────────────
  const [vnsName, setVnsName] = useState("");
  const [vnsInput, setVnsInput] = useState("");
  const [vnsEditing, setVnsEditing] = useState(false);
  const [companionName, setCompanionName] = useState("Embris");
  const [companionInput, setCompanionInput] = useState("");
  const [companionEditing, setCompanionEditing] = useState(false);

  // ─── Init ──────────────────────────────────────────────────────────

  useEffect(() => {
    checkWalletStatus();
    // Load VNS and companion name
    AsyncStorage.getItem('vaultfire_vns_name').then(v => { if (v) { setVnsName(v); setVnsInput(v); } });
    AsyncStorage.getItem('vaultfire_companion_name').then(v => { if (v) { setCompanionName(v); setCompanionInput(v); } });
  }, []);

  const checkWalletStatus = useCallback(async () => {
    try {
      const created = await isWalletCreated();
      if (created) {
        const addr = await getWalletAddress();
        if (addr) {
          setAddress(addr);
          setPhase("ready");
          loadAllAssets(addr);
          return;
        }
      }
      setPhase("onboarding");
    } catch {
      setPhase("onboarding");
    }
  }, []);

  // ─── Asset Loading ─────────────────────────────────────────────────

  const loadAllAssets = useCallback(async (addr: string) => {
    setLoadingAssets(true);
    try {
      // Load everything in parallel
      const [nativeResults, priceData, storedCustom] = await Promise.all([
        getAllBalances(addr),
        fetchPrices(),
        loadCustomTokens(),
      ]);

      setBalances(nativeResults);
      setPrices(priceData);
      setCustomTokens(storedCustom);

      // Fetch ERC-20 balances
      const erc20Results = await fetchAllTokenBalances(addr, storedCustom);
      // Only keep tokens with balance > 0
      const ownedTokens = erc20Results.filter((t) => t.balanceRaw !== "0" && parseFloat(t.balanceFormatted) > 0);
      setTokenBalances(ownedTokens);

      // Fetch logos for tokens that have coingeckoId
      const allTokensWithId = [...nativeResults, ...ownedTokens].filter(
        (t: any) => t.coingeckoId
      );
      const logos: Record<string, string> = {};
      for (const t of allTokensWithId) {
        const id = (t as any).coingeckoId;
        if (id && !tokenLogos[id]) {
          const url = await fetchTokenLogo(id);
          if (url) logos[id] = url;
        }
      }
      if (Object.keys(logos).length > 0) {
        setTokenLogos((prev) => ({ ...prev, ...logos }));
      }
    } catch {
      // Keep existing data on error
    } finally {
      setLoadingAssets(false);
    }
  }, [tokenLogos]);

  const onRefresh = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    await loadAllAssets(address);
    setRefreshing(false);
  }, [address, loadAllAssets]);

  // ─── Build Asset List ──────────────────────────────────────────────

  const assets: AssetItem[] = useMemo(() => {
    const items: AssetItem[] = [];

    // Native tokens (only with balance > 0)
    for (const bal of balances) {
      const amount = parseFloat(bal.balanceFormatted);
      if (amount <= 0 && !bal.error) continue;

      const coingeckoId = bal.chain.symbol === "ETH" ? "ethereum" : "avalanche-2";
      const pricePerToken = getTokenPrice(prices, coingeckoId);
      const chainId = bal.chain.name === "Ethereum" ? "ethereum" : bal.chain.name === "Base" ? "base" : "avalanche";

      items.push({
        type: "native",
        chain: chainId,
        chainName: bal.chain.name,
        symbol: bal.chain.symbol,
        name: `${bal.chain.symbol} on ${bal.chain.name}`,
        balanceFormatted: bal.balanceFormatted,
        balanceRaw: bal.balanceWei,
        usdValue: amount * pricePerToken,
        pricePerToken,
        logoUrl: tokenLogos[coingeckoId],
        logoColor: bal.chain.color,
        decimals: 18,
        coingeckoId,
        chainConfig: TX_CHAINS[chainId],
      });
    }

    // ERC-20 tokens (already filtered to owned only)
    for (const tb of tokenBalances) {
      const amount = parseFloat(tb.balanceFormatted);
      const pricePerToken = getTokenPrice(prices, tb.coingeckoId);
      const chainLabel = { ethereum: "Ethereum", base: "Base", avalanche: "Avalanche" }[tb.chain];

      items.push({
        type: "erc20",
        chain: tb.chain,
        chainName: chainLabel || tb.chain,
        symbol: tb.symbol,
        name: tb.name,
        balanceFormatted: tb.balanceFormatted,
        balanceRaw: tb.balanceRaw,
        usdValue: amount * pricePerToken,
        pricePerToken,
        logoUrl: tb.coingeckoId ? tokenLogos[tb.coingeckoId] : undefined,
        logoColor: tb.logoColor || "#666",
        decimals: tb.decimals,
        tokenAddress: tb.address,
        coingeckoId: tb.coingeckoId,
        chainConfig: TX_CHAINS[tb.chain],
      });
    }

    // Sort: highest USD value first
    items.sort((a, b) => b.usdValue - a.usdValue);
    return items;
  }, [balances, tokenBalances, prices, tokenLogos]);

  const totalUsdValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + a.usdValue, 0);
  }, [assets]);

  // ─── Wallet Creation ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setPhase("creating");
    setEmbrisMessages([
      { text: "Welcome! Let's set up your Vaultfire wallet. This will be your key to the Vaultfire ecosystem.", isEmbris: true },
    ]);

    await new Promise((r) => setTimeout(r, 1200));
    setEmbrisMessages((prev) => [
      ...prev,
      { text: "Generating your unique keypair now... This uses cryptographically secure randomness.", isEmbris: true },
    ]);

    try {
      const wallet = await createWallet();
      setAddress(wallet.address);
      setMnemonic(wallet.mnemonic);

      await new Promise((r) => setTimeout(r, 800));
      setEmbrisMessages((prev) => [
        ...prev,
        { text: `Your wallet is ready! Address: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`, isEmbris: true },
        { text: "Now I need you to back up your recovery phrase. Write these 12 words down somewhere safe — this is the ONLY way to recover your wallet.", isEmbris: true },
      ]);

      await new Promise((r) => setTimeout(r, 600));

      const indices: number[] = [];
      while (indices.length < 3) {
        const idx = Math.floor(Math.random() * 12);
        if (!indices.includes(idx)) indices.push(idx);
      }
      setVerifyIndices(indices.sort((a, b) => a - b));
      setPhase("backup");
    } catch (err: any) {
      setEmbrisMessages((prev) => [
        ...prev,
        { text: `Something went wrong: ${err.message}. Let's try again.`, isEmbris: true },
      ]);
      setPhase("onboarding");
    }
  }, []);

  const handleBackupConfirm = useCallback(() => {
    setEmbrisMessages([
      { text: "Great! Now let's verify you wrote them down correctly. Please enter the following words:", isEmbris: true },
    ]);
    setPhase("verify");
  }, []);

  const handleVerifySubmit = useCallback(() => {
    if (!mnemonic) return;
    const words = mnemonic.split(" ");
    const correct = verifyIndices.every(
      (idx, i) => verifyInputs[i].trim().toLowerCase() === words[idx].toLowerCase()
    );

    if (correct) {
      setMnemonic(null);
      setPhase("ready");
      if (address) loadAllAssets(address);
    } else {
      setVerifyError(true);
      setVerifyInputs(["", "", ""]);
      setTimeout(() => setVerifyError(false), 2000);
    }
  }, [mnemonic, verifyIndices, verifyInputs, address, loadAllAssets]);

  // ─── Import ────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const trimmed = importText.trim();
    if (!trimmed) return;

    setImportLoading(true);
    setImportError(null);

    try {
      const wordCount = trimmed.split(/\s+/).length;
      let wallet;

      if (wordCount >= 12) {
        wallet = await importFromMnemonic(trimmed);
      } else if (trimmed.startsWith("0x") || trimmed.length === 64 || trimmed.length === 66) {
        wallet = await importFromPrivateKey(trimmed);
      } else {
        throw new Error("Please enter a valid 12/24-word seed phrase or private key");
      }

      setAddress(wallet.address);
      setPhase("ready");
      loadAllAssets(wallet.address);
    } catch (err: any) {
      setImportError(err.message || "Invalid input");
    } finally {
      setImportLoading(false);
    }
  }, [importText, loadAllAssets]);

  // ─── Delete Wallet ─────────────────────────────────────────────────

  const handleDeleteWallet = useCallback(() => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete your wallet? This cannot be undone without your recovery phrase.")) {
        deleteWallet().then(() => {
          setAddress(null);
          setBalances([]);
          setTokenBalances([]);
          setPhase("onboarding");
          setSubView("main");
        });
      }
    } else {
      Alert.alert(
        "Delete Wallet",
        "Are you sure? This cannot be undone without your recovery phrase.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteWallet();
              setAddress(null);
              setBalances([]);
              setTokenBalances([]);
              setPhase("onboarding");
              setSubView("main");
            },
          },
        ]
      );
    }
  }, []);

  // ─── Copy Address ──────────────────────────────────────────────────

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  // ─── Send Flow ─────────────────────────────────────────────────────

  const startSend = useCallback((asset: AssetItem) => {
    setSendAsset(asset);
    setSendTo("");
    setSendAmount("");
    setSendGas(null);
    setSendError(null);
    setSendResult(null);
    setSubView("send");
  }, []);

  const handleEstimateGas = useCallback(async () => {
    if (!sendAsset || !sendTo || !sendAmount || !address) return;
    setSendLoading(true);
    setSendError(null);
    try {
      let gas: GasEstimate;
      if (sendAsset.type === "native") {
        gas = await estimateNativeSendGas(sendAsset.chainConfig, address, sendTo, sendAmount);
      } else {
        const amount = parseTokenAmount(sendAmount, sendAsset.decimals);
        gas = await estimateERC20SendGas(sendAsset.chainConfig, address, sendAsset.tokenAddress!, sendTo, amount);
      }
      setSendGas(gas);
      setSubView("sendConfirm");
    } catch (err: any) {
      setSendError(err.message || "Failed to estimate gas");
    } finally {
      setSendLoading(false);
    }
  }, [sendAsset, sendTo, sendAmount, address]);

  const handleSendConfirm = useCallback(async () => {
    if (!sendAsset || !sendTo || !sendAmount || !address) return;
    setSendLoading(true);
    setSendError(null);
    try {
      const pk = await getWalletPrivateKey();
      if (!pk) throw new Error("Private key not found");

      let result: TxResult;
      if (sendAsset.type === "native") {
        result = await sendNativeToken(sendAsset.chainConfig, pk, address, sendTo, sendAmount);
      } else {
        const amount = parseTokenAmount(sendAmount, sendAsset.decimals);
        result = await sendERC20Token(sendAsset.chainConfig, pk, address, sendAsset.tokenAddress!, sendTo, amount);
      }
      setSendResult(result);
      setSubView("sendResult");
      // Refresh balances after send
      loadAllAssets(address);
    } catch (err: any) {
      setSendError(err.message || "Transaction failed");
    } finally {
      setSendLoading(false);
    }
  }, [sendAsset, sendTo, sendAmount, address, loadAllAssets]);

  // ─── Add Custom Token ──────────────────────────────────────────────

  const handleLookupToken = useCallback(async () => {
    if (!addTokenAddress.trim()) return;
    setAddTokenLoading(true);
    setAddTokenError(null);
    setAddTokenPreview(null);
    try {
      const info = await fetchTokenInfo(addTokenChain, addTokenAddress.trim());
      if (!info) throw new Error("Could not read token contract. Check the address and chain.");

      // Try CoinGecko lookup for logo
      const platform = addTokenChain === "base" ? "base" : addTokenChain === "avalanche" ? "avalanche" : "ethereum";
      const cgLookup = await lookupTokenOnCoinGecko(platform, addTokenAddress.trim());

      const token: TokenInfo = {
        ...info,
        coingeckoId: cgLookup?.coingeckoId,
        logoUrl: cgLookup?.logoUrl,
        logoColor: "#666",
      };
      setAddTokenPreview(token);
    } catch (err: any) {
      setAddTokenError(err.message || "Token not found");
    } finally {
      setAddTokenLoading(false);
    }
  }, [addTokenAddress, addTokenChain]);

  const handleAddToken = useCallback(async () => {
    if (!addTokenPreview || !address) return;
    const updated = [...customTokens, addTokenPreview];
    setCustomTokens(updated);
    await saveCustomTokens(updated);
    // Fetch balance for the new token
    const bal = await fetchTokenBalance(addTokenPreview, address);
    if (parseFloat(bal.balanceFormatted) > 0) {
      setTokenBalances((prev) => [...prev, bal]);
    }
    setAddTokenAddress("");
    setAddTokenPreview(null);
    setSubView("main");
  }, [addTokenPreview, customTokens, address]);

  // ─── Security / Seed Phrase ────────────────────────────────────────

  const handleRevealSeedPhrase = useCallback(async () => {
    if (securityConfirmText.toLowerCase() !== "reveal") return;
    const m = await getWalletMnemonic();
    setSecurityMnemonic(m);
    setSecurityRevealed(true);
  }, [securityConfirmText]);

  // ─── Computed Values ───────────────────────────────────────────────

  const mnemonicWords = useMemo(() => mnemonic?.split(" ") ?? [], [mnemonic]);
  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatUsd = (val: number) => {
    if (val < 0.01 && val > 0) return "<$0.01";
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ─── Render: Loading ───────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <ScreenContainer>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  // ─── Render: Onboarding ────────────────────────────────────────────

  if (phase === "onboarding") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.onboardingContainer}>
            <View style={[s.logoCircle, { backgroundColor: `${colors.primary}15` }]}>
              <IconSymbol name="lock.shield.fill" size={40} color={colors.primary} />
            </View>

            <Text style={[s.title, { color: colors.foreground }]}>Vaultfire Wallet</Text>
            <Text style={[s.subtitle, { color: colors.muted }]}>
              Your self-custody wallet for the Vaultfire ecosystem. Secured by cryptography, governed by protocol.
            </Text>

            {/* Vaultfire branding */}
            <View style={[s.vaultfireBadge, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}15` }]}>
              <IconSymbol name="flame.fill" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Powered by Vaultfire Protocol</Text>
            </View>

            <View style={s.fullWidth}>
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [
                  s.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Create New Wallet</Text>
              </Pressable>

              <Pressable
                onPress={() => setPhase("import")}
                style={({ pressed }) => [
                  s.secondaryButton,
                  { borderColor: `${colors.foreground}10`, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.secondaryButtonText, { color: colors.muted }]}>Import Existing Wallet</Text>
              </Pressable>
            </View>

            <View style={[s.securityCard, { backgroundColor: `${colors.warning}08`, borderColor: `${colors.warning}20` }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.warning} />
              <Text style={[s.securityNote, { color: `${colors.warning}CC` }]}>
                Alpha software — store funds at your own risk. Always back up your recovery phrase.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Creating ──────────────────────────────────────────────

  if (phase === "creating") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.chatContainer}>
            {embrisMessages.map((msg, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 200).duration(300)}
                style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                  <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
                </View>
                <Text style={[s.embrisText, { color: colors.foreground }]}>{msg.text}</Text>
              </Animated.View>
            ))}
            <ActivityIndicator style={s.loadingDot} size="small" color={colors.primary} />
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Backup ────────────────────────────────────────────────

  if (phase === "backup") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.backupContainer}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recovery Phrase</Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
                Write these 12 words down in order. Store them somewhere safe — never share them with anyone.
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={[s.seedContainer, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}
            >
              <View style={s.seedGrid}>
                {mnemonicWords.map((word, idx) => (
                  <View key={idx} style={[s.seedWord, { backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}06` }]}>
                    <Text style={[s.seedIndex, { color: colors.muted }]}>{idx + 1}</Text>
                    <Text style={[s.seedText, { color: colors.foreground }]}>{word}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            <View style={[s.warningBox, { backgroundColor: `${colors.error}08`, borderColor: `${colors.error}20` }]}>
              <Text style={[s.warningText, { color: colors.error }]}>
                If you lose this phrase, you lose access to your wallet forever. There is no recovery.
              </Text>
            </View>

            <Pressable
              onPress={handleBackupConfirm}
              style={({ pressed }) => [
                s.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>I've Written It Down</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Verify ────────────────────────────────────────────────

  if (phase === "verify") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.backupContainer}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Verify Backup</Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
                Enter the following words from your recovery phrase to verify your backup.
              </Text>
            </Animated.View>

            {verifyError && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={[s.errorText, { color: colors.error }]}>
                  Incorrect words. Please check your backup and try again.
                </Text>
              </Animated.View>
            )}

            {verifyIndices.map((wordIdx, i) => (
              <Animated.View
                key={wordIdx}
                entering={FadeInDown.delay(200 + i * 100).duration(300)}
                style={s.verifyRow}
              >
                <Text style={[s.verifyLabel, { color: colors.muted }]}>Word #{wordIdx + 1}</Text>
                <TextInput
                  value={verifyInputs[i]}
                  onChangeText={(text) => {
                    const next = [...verifyInputs];
                    next[i] = text;
                    setVerifyInputs(next);
                  }}
                  placeholder={`Enter word #${wordIdx + 1}`}
                  placeholderTextColor={`${colors.muted}80`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={i === 2 ? "done" : "next"}
                  onSubmitEditing={i === 2 ? handleVerifySubmit : undefined}
                  style={[
                    s.verifyInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.surface,
                      borderColor: verifyError ? colors.error : `${colors.foreground}08`,
                    },
                  ]}
                />
              </Animated.View>
            ))}

            <Pressable
              onPress={handleVerifySubmit}
              style={({ pressed }) => [
                s.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: verifyInputs.every((v) => v.trim()) ? (pressed ? 0.85 : 1) : 0.5,
                },
              ]}
              disabled={!verifyInputs.every((v) => v.trim())}
            >
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Verify & Complete</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Import ────────────────────────────────────────────────

  if (phase === "import") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Animated.View entering={FadeInDown.duration(400)} style={s.backupContainer}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Import Wallet</Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
                Paste your 12-word seed phrase or private key below. Your key will be encrypted and stored only on this device.
              </Text>
            </Animated.View>

            {importError && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={[s.errorCard, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30` }]}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
                  <Text style={[s.errorText, { color: colors.error, flex: 1, textAlign: "left", marginVertical: 0 }]}>{importError}</Text>
                </View>
              </Animated.View>
            )}

            <TextInput
              value={importText}
              onChangeText={setImportText}
              placeholder="Enter seed phrase or private key..."
              placeholderTextColor={`${colors.muted}80`}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                s.importInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                  borderColor: importError ? colors.error : `${colors.foreground}08`,
                },
              ]}
            />

            <Pressable
              onPress={handleImport}
              disabled={importLoading || !importText.trim()}
              style={({ pressed }) => [
                s.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: importText.trim() ? (pressed ? 0.85 : 1) : 0.5,
                },
              ]}
            >
              {importLoading ? (
                <ActivityIndicator size="small" color="#FAFAFA" />
              ) : (
                <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Import Wallet</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => { setPhase("onboarding"); setImportText(""); setImportError(null); }}
              style={({ pressed }) => [
                s.secondaryButton,
                { borderColor: `${colors.foreground}10`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.secondaryButtonText, { color: colors.muted }]}>Back</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Send Flow ─────────────────────────────────────────────

  if (subView === "send" && sendAsset) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          {/* Header */}
          <View style={s.subViewHeader}>
            <Pressable onPress={() => setSubView("main")} hitSlop={12}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
            </Pressable>
            <Text style={[s.subViewTitle, { color: colors.foreground }]}>Send {sendAsset.symbol}</Text>
            <View style={{ width: 20 }} />
          </View>

          {/* Token info */}
          <Animated.View entering={FadeInDown.duration(300)} style={[s.sendTokenInfo, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
            <TokenIcon logoUrl={sendAsset.logoUrl} logoColor={sendAsset.logoColor} symbol={sendAsset.symbol} size={44} />
            <View>
              <Text style={[s.sendTokenName, { color: colors.foreground }]}>{sendAsset.symbol}</Text>
              <Text style={[s.sendTokenBalance, { color: colors.muted }]}>
                Balance: {sendAsset.balanceFormatted} ({formatUsd(sendAsset.usdValue)})
              </Text>
            </View>
          </Animated.View>

          {/* Recipient */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Text style={[s.inputLabel, { color: colors.muted }]}>Recipient Address</Text>
            <TextInput
              value={sendTo}
              onChangeText={setSendTo}
              placeholder="0x..."
              placeholderTextColor={`${colors.muted}60`}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.textInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: `${colors.foreground}08` }]}
            />
          </Animated.View>

          {/* Amount */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Text style={[s.inputLabel, { color: colors.muted }]}>Amount</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={sendAmount}
                onChangeText={setSendAmount}
                placeholder="0.0"
                placeholderTextColor={`${colors.muted}60`}
                keyboardType="decimal-pad"
                style={[s.textInput, { flex: 1, color: colors.foreground, backgroundColor: colors.surface, borderColor: `${colors.foreground}08` }]}
              />
              <Pressable
                onPress={() => setSendAmount(sendAsset.balanceFormatted)}
                style={({ pressed }) => [s.maxButton, { backgroundColor: `${colors.primary}15`, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>MAX</Text>
              </Pressable>
            </View>
            {sendAmount && sendAsset.pricePerToken > 0 && (
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                ≈ {formatUsd(parseFloat(sendAmount || "0") * sendAsset.pricePerToken)}
              </Text>
            )}
          </Animated.View>

          {sendError && (
            <View style={[s.errorCard, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30` }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{sendError}</Text>
            </View>
          )}

          <Pressable
            onPress={handleEstimateGas}
            disabled={sendLoading || !sendTo || !sendAmount}
            style={({ pressed }) => [
              s.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: (sendTo && sendAmount) ? (pressed ? 0.85 : 1) : 0.5,
                marginTop: 16,
              },
            ]}
          >
            {sendLoading ? (
              <ActivityIndicator size="small" color="#FAFAFA" />
            ) : (
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Review Transaction</Text>
            )}
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Send Confirmation ─────────────────────────────────────

  if (subView === "sendConfirm" && sendAsset && sendGas) {
    const usdAmount = parseFloat(sendAmount || "0") * sendAsset.pricePerToken;
    const gasFeeEth = parseFloat(sendGas.estimatedFeeFormatted);
    const gasUsd = gasFeeEth * getTokenPrice(prices, sendAsset.chain === "avalanche" ? "avalanche-2" : "ethereum");

    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.subViewHeader}>
            <Pressable onPress={() => setSubView("send")} hitSlop={12}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
            </Pressable>
            <Text style={[s.subViewTitle, { color: colors.foreground }]}>Confirm Transaction</Text>
            <View style={{ width: 20 }} />
          </View>

          <Animated.View entering={FadeInDown.duration(300)} style={[s.confirmCard, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
            <View style={s.confirmRow}>
              <Text style={[s.confirmLabel, { color: colors.muted }]}>Sending</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.confirmValue, { color: colors.foreground }]}>{sendAmount} {sendAsset.symbol}</Text>
                {usdAmount > 0 && <Text style={[s.confirmSub, { color: colors.muted }]}>{formatUsd(usdAmount)}</Text>}
              </View>
            </View>

            <View style={[s.confirmDivider, { backgroundColor: `${colors.foreground}06` }]} />

            <View style={s.confirmRow}>
              <Text style={[s.confirmLabel, { color: colors.muted }]}>To</Text>
              <Text style={[s.confirmValueMono, { color: colors.foreground }]}>{truncateAddr(sendTo)}</Text>
            </View>

            <View style={[s.confirmDivider, { backgroundColor: `${colors.foreground}06` }]} />

            <View style={s.confirmRow}>
              <Text style={[s.confirmLabel, { color: colors.muted }]}>Network</Text>
              <Text style={[s.confirmValue, { color: colors.foreground }]}>{sendAsset.chainName}</Text>
            </View>

            <View style={[s.confirmDivider, { backgroundColor: `${colors.foreground}06` }]} />

            <View style={s.confirmRow}>
              <Text style={[s.confirmLabel, { color: colors.muted }]}>Gas Fee</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.confirmValue, { color: colors.foreground }]}>{sendGas.estimatedFeeFormatted} {sendAsset.chainConfig.symbol}</Text>
                {gasUsd > 0 && <Text style={[s.confirmSub, { color: colors.muted }]}>{formatUsd(gasUsd)}</Text>}
              </View>
            </View>
          </Animated.View>

          <View style={[s.warningBox, { backgroundColor: `${colors.warning}08`, borderColor: `${colors.warning}20`, marginTop: 12 }]}>
            <Text style={[s.warningText, { color: `${colors.warning}CC`, fontSize: 13 }]}>
              This transaction is irreversible. Please verify the recipient address carefully.
            </Text>
          </View>

          {sendError && (
            <View style={[s.errorCard, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30`, marginTop: 8 }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{sendError}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSendConfirm}
            disabled={sendLoading}
            style={({ pressed }) => [
              s.primaryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 16 },
            ]}
          >
            {sendLoading ? (
              <ActivityIndicator size="small" color="#FAFAFA" />
            ) : (
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Confirm & Send</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setSubView("send")}
            style={({ pressed }) => [
              s.secondaryButton,
              { borderColor: `${colors.foreground}10`, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[s.secondaryButtonText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Send Result ───────────────────────────────────────────

  if (subView === "sendResult" && sendResult) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={[s.scrollContent, { justifyContent: "center" }]}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center", gap: 16 }}>
            <View style={[s.successCircle, { backgroundColor: `${colors.success}15` }]}>
              <IconSymbol name="checkmark.seal.fill" size={48} color={colors.success} />
            </View>
            <Text style={[s.title, { color: colors.foreground }]}>Transaction Sent</Text>
            <Text style={[s.subtitle, { color: colors.muted }]}>
              Your transaction has been broadcast to the network.
            </Text>

            <View style={[s.txHashCard, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
              <Text style={[s.txHashLabel, { color: colors.muted }]}>Transaction Hash</Text>
              <Text style={[s.txHash, { color: colors.foreground }]} numberOfLines={1}>
                {sendResult.hash}
              </Text>
            </View>

            <Pressable
              onPress={() => Linking.openURL(sendResult.explorerUrl)}
              style={({ pressed }) => [
                s.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>View on Explorer</Text>
            </Pressable>

            <Pressable
              onPress={() => { setSubView("main"); setSendResult(null); }}
              style={({ pressed }) => [
                s.secondaryButton,
                { borderColor: `${colors.foreground}10`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.secondaryButtonText, { color: colors.muted }]}>Back to Wallet</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Receive ───────────────────────────────────────────────

  if (subView === "receive") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.subViewHeader}>
            <Pressable onPress={() => setSubView("main")} hitSlop={12}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
            </Pressable>
            <Text style={[s.subViewTitle, { color: colors.foreground }]}>Receive</Text>
            <View style={{ width: 20 }} />
          </View>

          <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: "center", gap: 20 }}>
            <Text style={[s.subtitle, { color: colors.muted, textAlign: "center" }]}>
              Share your wallet address to receive tokens on any supported chain.
            </Text>

            {/* Address display */}
            <View style={[s.receiveAddressCard, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
              <Text style={[s.receiveAddressLabel, { color: colors.muted }]}>Your Wallet Address</Text>
              <Text style={[s.receiveAddress, { color: colors.foreground }]} selectable>
                {address}
              </Text>
            </View>

            {/* Supported chains */}
            <View style={[s.chainList, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 10 }}>Supported Networks</Text>
              {[
                { name: "Ethereum", color: "#627EEA", symbol: "ETH" },
                { name: "Base", color: "#0052FF", symbol: "ETH" },
                { name: "Avalanche", color: "#E84142", symbol: "AVAX" },
              ].map((chain) => (
                <View key={chain.name} style={s.chainRow}>
                  <View style={[s.chainDot, { backgroundColor: chain.color }]} />
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>{chain.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginLeft: "auto" }}>{chain.symbol}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleCopyAddress}
              style={({ pressed }) => [
                s.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>
                {copied ? "Copied!" : "Copy Address"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Add Token ─────────────────────────────────────────────

  if (subView === "addToken") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.subViewHeader}>
            <Pressable onPress={() => { setSubView("main"); setAddTokenPreview(null); setAddTokenError(null); setAddTokenAddress(""); }} hitSlop={12}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
            </Pressable>
            <Text style={[s.subViewTitle, { color: colors.foreground }]}>Add Token</Text>
            <View style={{ width: 20 }} />
          </View>

          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={[s.inputLabel, { color: colors.muted }]}>Network</Text>
            <View style={s.chainSelector}>
              {(["base", "avalanche", "ethereum"] as SupportedChain[]).map((chain) => (
                <Pressable
                  key={chain}
                  onPress={() => setAddTokenChain(chain)}
                  style={[
                    s.chainSelectorItem,
                    {
                      backgroundColor: addTokenChain === chain ? `${colors.primary}15` : colors.surface,
                      borderColor: addTokenChain === chain ? colors.primary : `${colors.foreground}08`,
                    },
                  ]}
                >
                  <Text style={{
                    color: addTokenChain === chain ? colors.primary : colors.muted,
                    fontSize: 14, fontWeight: "600",
                  }}>
                    {chain === "base" ? "Base" : chain === "avalanche" ? "Avalanche" : "Ethereum"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[s.inputLabel, { color: colors.muted, marginTop: 16 }]}>Contract Address</Text>
            <TextInput
              value={addTokenAddress}
              onChangeText={setAddTokenAddress}
              placeholder="0x..."
              placeholderTextColor={`${colors.muted}60`}
              autoCapitalize="none"
              autoCorrect={false}
              style={[s.textInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: `${colors.foreground}08` }]}
            />

            {addTokenError && (
              <View style={[s.errorCard, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30`, marginTop: 8 }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{addTokenError}</Text>
              </View>
            )}

            {addTokenPreview && (
              <Animated.View entering={FadeIn.duration(200)} style={[s.tokenPreviewCard, { backgroundColor: colors.surface, borderColor: `${colors.primary}20` }]}>
                <TokenIcon logoUrl={addTokenPreview.logoUrl} logoColor={addTokenPreview.logoColor || "#666"} symbol={addTokenPreview.symbol} size={36} />
                <View>
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>{addTokenPreview.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{addTokenPreview.symbol} · {addTokenPreview.decimals} decimals</Text>
                </View>
              </Animated.View>
            )}

            {!addTokenPreview ? (
              <Pressable
                onPress={handleLookupToken}
                disabled={addTokenLoading || !addTokenAddress.trim()}
                style={({ pressed }) => [
                  s.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: addTokenAddress.trim() ? (pressed ? 0.85 : 1) : 0.5,
                    marginTop: 16,
                  },
                ]}
              >
                {addTokenLoading ? (
                  <ActivityIndicator size="small" color="#FAFAFA" />
                ) : (
                  <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Look Up Token</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleAddToken}
                style={({ pressed }) => [
                  s.primaryButton,
                  { backgroundColor: colors.success, opacity: pressed ? 0.85 : 1, marginTop: 16 },
                ]}
              >
                <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Add to Wallet</Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Security / Seed Phrase ────────────────────────────────

  if (subView === "security") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.subViewHeader}>
            <Pressable onPress={() => { setSubView("main"); setSecurityRevealed(false); setSecurityMnemonic(null); setSecurityConfirmText(""); }} hitSlop={12}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
            </Pressable>
            <Text style={[s.subViewTitle, { color: colors.foreground }]}>Security</Text>
            <View style={{ width: 20 }} />
          </View>

          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Seed Phrase Section */}
            <View style={[s.securitySection, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <IconSymbol name="lock.shield.fill" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600" }}>Recovery Phrase</Text>
              </View>

              {!securityRevealed ? (
                <>
                  <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                    Your recovery phrase is the master key to your wallet. Never share it with anyone. Type "reveal" below to view it.
                  </Text>
                  <TextInput
                    value={securityConfirmText}
                    onChangeText={setSecurityConfirmText}
                    placeholder='Type "reveal" to continue'
                    placeholderTextColor={`${colors.muted}60`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[s.textInput, { color: colors.foreground, backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}08` }]}
                  />
                  <Pressable
                    onPress={handleRevealSeedPhrase}
                    disabled={securityConfirmText.toLowerCase() !== "reveal"}
                    style={({ pressed }) => [
                      s.primaryButton,
                      {
                        backgroundColor: colors.error,
                        opacity: securityConfirmText.toLowerCase() === "reveal" ? (pressed ? 0.85 : 1) : 0.4,
                        marginTop: 12,
                      },
                    ]}
                  >
                    <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Reveal Phrase</Text>
                  </Pressable>
                </>
              ) : securityMnemonic ? (
                <>
                  <View style={[s.seedContainer, { backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}06` }]}>
                    <View style={s.seedGrid}>
                      {securityMnemonic.split(" ").map((word, idx) => (
                        <View key={idx} style={[s.seedWord, { backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}06` }]}>
                          <Text style={[s.seedIndex, { color: colors.muted }]}>{idx + 1}</Text>
                          <Text style={[s.seedText, { color: colors.foreground }]}>{word}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={[s.warningBox, { backgroundColor: `${colors.error}08`, borderColor: `${colors.error}20`, marginTop: 12 }]}>
                    <Text style={[s.warningText, { color: colors.error, fontSize: 13 }]}>
                      Anyone with this phrase can access your wallet. Store it securely offline.
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  No recovery phrase available. This wallet may have been imported via private key.
                </Text>
              )}
            </View>

            {/* VNS Name */}
            <View style={[s.securitySection, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, marginTop: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <IconSymbol name="person.text.rectangle" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600" }}>Vaultfire Name (VNS)</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                Register a human-readable name for your wallet. Instead of 0x742d... you can be "ghostkey.vault".
              </Text>
              {vnsEditing ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={vnsInput}
                    onChangeText={setVnsInput}
                    placeholder="yourname.vault"
                    placeholderTextColor={`${colors.muted}60`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[s.textInput, { color: colors.foreground, backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}08` }]}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={async () => {
                        const name = vnsInput.trim();
                        if (name) {
                          const finalName = name.endsWith('.vault') ? name : `${name}.vault`;
                          await AsyncStorage.setItem('vaultfire_vns_name', finalName);
                          setVnsName(finalName);
                          setVnsInput(finalName);
                        }
                        setVnsEditing(false);
                      }}
                      style={({ pressed }) => [s.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, flex: 1 }]}
                    >
                      <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Save</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setVnsEditing(false); setVnsInput(vnsName); }}
                      style={({ pressed }) => [s.primaryButton, { backgroundColor: `${colors.foreground}08`, opacity: pressed ? 0.85 : 1, flex: 1 }]}
                    >
                      <Text style={[s.primaryButtonText, { color: colors.muted }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setVnsEditing(true)}
                  style={({ pressed }) => [s.primaryButton, { backgroundColor: `${colors.primary}15`, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.primaryButtonText, { color: colors.primary }]}>
                    {vnsName ? `${vnsName} — Edit` : "Register VNS Name"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Companion Name */}
            <View style={[s.securitySection, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, marginTop: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <IconSymbol name="flame.fill" size={20} color="#F97316" />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600" }}>Companion Name</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                Give your AI companion a custom name. Instead of "Embris", call it whatever you like.
              </Text>
              {companionEditing ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={companionInput}
                    onChangeText={setCompanionInput}
                    placeholder="Phoenix, Nova, etc."
                    placeholderTextColor={`${colors.muted}60`}
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={[s.textInput, { color: colors.foreground, backgroundColor: `${colors.foreground}04`, borderColor: `${colors.foreground}08` }]}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={async () => {
                        const name = companionInput.trim() || 'Embris';
                        await AsyncStorage.setItem('vaultfire_companion_name', name);
                        setCompanionName(name);
                        setCompanionInput(name);
                        setCompanionEditing(false);
                      }}
                      style={({ pressed }) => [s.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, flex: 1 }]}
                    >
                      <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Save</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setCompanionEditing(false); setCompanionInput(companionName); }}
                      style={({ pressed }) => [s.primaryButton, { backgroundColor: `${colors.foreground}08`, opacity: pressed ? 0.85 : 1, flex: 1 }]}
                    >
                      <Text style={[s.primaryButtonText, { color: colors.muted }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setCompanionEditing(true)}
                  style={({ pressed }) => [s.primaryButton, { backgroundColor: `${colors.primary}15`, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={[s.primaryButtonText, { color: colors.primary }]}>
                    {companionName !== 'Embris' ? `${companionName} — Edit` : "Name Your Companion"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Danger Zone */}
            <View style={[s.securitySection, { backgroundColor: `${colors.error}06`, borderColor: `${colors.error}15`, marginTop: 16 }]}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 12, letterSpacing: 0.5 }}>DANGER ZONE</Text>
              <Pressable
                onPress={handleDeleteWallet}
                style={({ pressed }) => [
                  s.deleteButton,
                  { borderColor: `${colors.error}40`, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
                <Text style={[s.deleteButtonText, { color: colors.error }]}>Delete Wallet</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Ready (Main Wallet View) ──────────────────────────────

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Portfolio Value Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={[s.balanceHero, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
          <Text style={[s.balanceLabel, { color: colors.muted }]}>Portfolio Value</Text>
          <Text style={[s.balanceValue, { color: colors.foreground }]}>
            {formatUsd(totalUsdValue)}
          </Text>

          {/* Address Row */}
          <Pressable
            onPress={() => setShowFullAddress(!showFullAddress)}
            style={[s.addressPill, { backgroundColor: `${colors.foreground}06` }]}
          >
            <Text style={[s.addressText, { color: colors.muted }]}>
              {address ? (showFullAddress ? address : truncateAddr(address)) : ""}
            </Text>
            <Pressable onPress={handleCopyAddress} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <IconSymbol
                name={copied ? "checkmark.seal.fill" : "doc.on.doc.fill"}
                size={14}
                color={copied ? colors.success : colors.muted}
              />
            </Pressable>
          </Pressable>

          {/* Vaultfire badge */}
          <View style={[s.vaultfireBadge, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}15` }]}>
            <IconSymbol name="flame.fill" size={12} color={colors.primary} />
            <Text style={{ color: `${colors.primary}CC`, fontSize: 11, fontWeight: "500" }}>Vaultfire Protocol</Text>
          </View>
        </Animated.View>

        {/* Action Buttons — Coinbase style circular */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.actionRow}>
          <Pressable
            onPress={() => {
              if (assets.length > 0) {
                startSend(assets[0]);
              } else {
                if (Platform.OS === "web") alert("No assets to send");
                else Alert.alert("No Assets", "You need tokens to send.");
              }
            }}
            style={({ pressed }) => [s.circleAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[s.circleActionIcon, { backgroundColor: `${colors.primary}15` }]}>
              <IconSymbol name="arrow.up.circle.fill" size={24} color={colors.primary} />
            </View>
            <Text style={[s.circleActionLabel, { color: colors.foreground }]}>Send</Text>
          </Pressable>

          <Pressable
            onPress={() => setSubView("receive")}
            style={({ pressed }) => [s.circleAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[s.circleActionIcon, { backgroundColor: `${colors.success}15` }]}>
              <IconSymbol name="arrow.down.circle.fill" size={24} color={colors.success} />
            </View>
            <Text style={[s.circleActionLabel, { color: colors.foreground }]}>Receive</Text>
          </Pressable>

          <Pressable
            onPress={() => setSubView("addToken")}
            style={({ pressed }) => [s.circleAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[s.circleActionIcon, { backgroundColor: `${colors.muted}15` }]}>
              <IconSymbol name="link" size={24} color={colors.muted} />
            </View>
            <Text style={[s.circleActionLabel, { color: colors.foreground }]}>Add Token</Text>
          </Pressable>

          <Pressable
            onPress={() => setSubView("security")}
            style={({ pressed }) => [s.circleAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[s.circleActionIcon, { backgroundColor: `${colors.muted}15` }]}>
              <IconSymbol name="gearshape.fill" size={24} color={colors.muted} />
            </View>
            <Text style={[s.circleActionLabel, { color: colors.foreground }]}>Settings</Text>
          </Pressable>
        </Animated.View>

        {/* Assets Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Assets</Text>
        </Animated.View>

        {loadingAssets ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            {[0, 1, 2].map((idx) => (
              <View key={idx} style={[s.tokenCard, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
                <View style={s.tokenCardLeft}>
                  <View style={[s.skeletonCircle, { backgroundColor: `${colors.foreground}08` }]} />
                  <View style={{ gap: 6 }}>
                    <View style={[s.skeletonLine, { width: 80, backgroundColor: `${colors.foreground}08` }]} />
                    <View style={[s.skeletonLine, { width: 50, height: 10, backgroundColor: `${colors.foreground}05` }]} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={[s.skeletonLine, { width: 70, backgroundColor: `${colors.foreground}08` }]} />
                  <View style={[s.skeletonLine, { width: 40, height: 10, backgroundColor: `${colors.foreground}05` }]} />
                </View>
              </View>
            ))}
          </Animated.View>
        ) : assets.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={[s.emptyState, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
              <IconSymbol name="wallet.pass.fill" size={32} color={`${colors.muted}60`} />
              <Text style={[s.emptyTitle, { color: colors.muted }]}>No assets yet</Text>
              <Text style={[s.emptySubtitle, { color: `${colors.muted}80` }]}>
                Receive tokens or add custom tokens to get started.
              </Text>
            </View>
          </Animated.View>
        ) : (
          assets.map((asset, idx) => (
            <Animated.View key={`${asset.chain}-${asset.symbol}-${asset.tokenAddress || "native"}`} entering={FadeInDown.delay(300 + idx * 60).duration(400)}>
              <Pressable
                onPress={() => startSend(asset)}
                style={({ pressed }) => [
                  s.tokenCard,
                  { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={s.tokenCardLeft}>
                  <TokenIcon logoUrl={asset.logoUrl} logoColor={asset.logoColor} symbol={asset.symbol} size={40} />
                  <View>
                    <Text style={[s.tokenName, { color: colors.foreground }]}>{asset.symbol}</Text>
                    <Text style={[s.tokenSubname, { color: colors.muted }]}>{asset.chainName}</Text>
                  </View>
                </View>
                <View style={s.tokenCardRight}>
                  <Text style={[s.tokenBalance, { color: colors.foreground }]}>{asset.balanceFormatted}</Text>
                  {asset.usdValue > 0 && (
                    <Text style={[s.tokenUsd, { color: colors.muted }]}>{formatUsd(asset.usdValue)}</Text>
                  )}
                  {asset.pricePerToken > 0 && (
                    <Text style={[s.tokenPrice, { color: `${colors.muted}80` }]}>{formatUsd(asset.pricePerToken)}/token</Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}

        {/* Transaction History */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)} style={{ marginTop: 24 }}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Recent Activity</Text>
          <View style={[s.emptyState, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
            <IconSymbol name="clock.fill" size={28} color={`${colors.muted}60`} />
            <Text style={[s.emptyTitle, { color: colors.muted }]}>No transactions yet</Text>
            <Text style={[s.emptySubtitle, { color: `${colors.muted}80` }]}>
              Your transaction history will appear here
            </Text>
          </View>
        </Animated.View>

        {/* Alpha Warning */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ marginTop: 20, marginBottom: 20 }}>
          <View style={[s.alphaNotice, { backgroundColor: `${colors.warning}08`, borderColor: `${colors.warning}20` }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.warning} />
              <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>Alpha Software</Text>
            </View>
            <Text style={{ color: `${colors.warning}CC`, fontSize: 12, lineHeight: 18 }}>
              This wallet is in alpha. Store funds at your own risk. Always keep your recovery phrase backed up securely.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  // Onboarding
  onboardingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 40,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  fullWidth: {
    width: "100%",
  },
  vaultfireBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  // Embris bubble
  embrisBubble: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 4,
  },
  embrisLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  embrisText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Buttons
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  securityNote: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  // Chat container
  chatContainer: {
    flex: 1,
    gap: 12,
    paddingTop: 20,
  },
  loadingDot: {
    marginTop: 12,
  },
  // Backup
  backupContainer: {
    flex: 1,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  seedContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  seedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  seedWord: {
    width: "30%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  seedIndex: {
    fontSize: 11,
    fontWeight: "700",
    minWidth: 18,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  seedText: {
    fontSize: 14,
    fontWeight: "500",
  },
  warningBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginVertical: 4,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Verify
  verifyRow: {
    gap: 6,
    marginBottom: 4,
  },
  verifyLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  verifyInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginVertical: 4,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  // Import
  importInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  // Balance Hero
  balanceHero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 6,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
    marginTop: 2,
  },
  addressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  addressText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  // Action buttons — Coinbase circular style
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  circleAction: {
    alignItems: "center",
    gap: 8,
  },
  circleActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  circleActionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Token list
  sectionLabel: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  tokenCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  tokenCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: "600",
  },
  tokenSubname: {
    fontSize: 12,
    marginTop: 2,
  },
  tokenCardRight: {
    alignItems: "flex-end",
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  tokenUsd: {
    fontSize: 13,
    marginTop: 2,
  },
  tokenPrice: {
    fontSize: 11,
    marginTop: 1,
  },
  // Skeleton
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  // Alpha notice
  alphaNotice: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  // Sub-view header
  subViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  subViewTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  // Send flow
  sendTokenInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sendTokenName: {
    fontSize: 18,
    fontWeight: "700",
  },
  sendTokenBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  maxButton: {
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  // Confirm
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  confirmValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmValueMono: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  confirmSub: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmDivider: {
    height: 1,
    width: "100%",
  },
  // Success
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  txHashCard: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  txHashLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  txHash: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  // Receive
  receiveAddressCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  receiveAddressLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  receiveAddress: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
    lineHeight: 22,
  },
  chainList: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  chainDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Add Token
  chainSelector: {
    flexDirection: "row",
    gap: 8,
  },
  chainSelectorItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  tokenPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  // Security
  securitySection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    width: "100%",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
