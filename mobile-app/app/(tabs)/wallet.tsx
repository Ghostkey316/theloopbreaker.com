import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  SectionList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useWallet } from "@/lib/wallet-context";
import { getPopularTokens, formatTokenAmount, type TokenMetadata } from "@/lib/token-list";
import { ethers } from "ethers";
import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";

const BASE_RPC_URL = "https://mainnet.base.org";
const AVAX_RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
const BASESCAN_URL = "https://basescan.org";
const SNOWTRACE_URL = "https://snowscan.xyz";

interface TokenBalance extends TokenMetadata {
  balance: string;
  balanceFormatted: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  functionName: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: string;
}

type TabView = "tokens" | "history";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { connectedAddress } = useWallet();
  const [activeChain, setActiveChain] = useState<"base" | "avalanche">("base");
  const [activeTab, setActiveTab] = useState<TabView>("tokens");
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [ethBalance, setEthBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sendRecipient, setSendRecipient] = useState("");
  const [trustScore, setTrustScore] = useState<{ score: number; level: string; color: string } | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  useEffect(() => {
    if (connectedAddress) {
      loadBalances();
      loadTrustScore();
      if (activeChain === "base") {
        loadTransactions();
      } else {
        setTransactions([]);
      }
    }
  }, [connectedAddress, activeChain]);

  const loadTrustScore = async () => {
    if (!connectedAddress) return;
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/trpc/trustScore.get?input=${encodeURIComponent(JSON.stringify({ address: connectedAddress }))}`);
      const json = await res.json();
      if (json?.result?.data) {
        setTrustScore(json.result.data);
      }
    } catch {}
  };

  const resolveRecipient = async (input: string) => {
    setSendRecipient(input);
    setResolvedName(null);
    if (input.endsWith(".eth") || input.endsWith(".base") || input.endsWith(".base.eth")) {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/trpc/resolveAddress.resolve?input=${encodeURIComponent(JSON.stringify({ input }))}`);
        const json = await res.json();
        if (json?.result?.data?.address) {
          setResolvedName(input);
          setSendRecipient(json.result.data.address);
        }
      } catch {}
    }
  };

  const loadBalances = async () => {
    if (!connectedAddress) return;
    setIsLoading(true);
    try {
      const rpcUrl = activeChain === "base" ? BASE_RPC_URL : AVAX_RPC_URL;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const ethBal = await provider.getBalance(connectedAddress);
      setEthBalance(ethers.formatEther(ethBal));

      const popularTokens = getPopularTokens(activeChain);
      const erc20ABI = ["function balanceOf(address) view returns (uint256)"];
      const tokenBalances: TokenBalance[] = [];

      for (const token of popularTokens) {
        try {
          const contract = new ethers.Contract(token.address, erc20ABI, provider);
          const balance = await contract.balanceOf(connectedAddress);
          const balanceNum = parseFloat(ethers.formatUnits(balance, token.decimals));
          if (balanceNum > 0) {
            tokenBalances.push({
              ...token,
              balance: balance.toString(),
              balanceFormatted: formatTokenAmount(balance.toString(), token.decimals),
            });
          }
        } catch (error) {
          // Skip tokens that fail
        }
      }
      setTokens(tokenBalances);
    } catch (error) {
      console.error("Failed to load balances:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!connectedAddress) return;
    setIsLoadingTxs(true);
    try {
      const data = await fetch(
        `${getApiBaseUrl()}/api/trpc/basescan.transactions?input=${encodeURIComponent(
          JSON.stringify({ json: { address: connectedAddress, chain: activeChain, page: 1, offset: 25 } })
        )}`,
        { credentials: "include" }
      ).then((r) => r.json());

      const result = data?.result?.data?.json;
      if (result?.status === "1" && Array.isArray(result?.result)) {
        setTransactions(result.result);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
      setTransactions([]);
    } finally {
      setIsLoadingTxs(false);
    }
  };

  const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTxDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const mins = Math.floor(diff / (1000 * 60));
        return `${mins}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTxValue = (value: string) => {
    const eth = parseFloat(ethers.formatEther(value));
    if (eth === 0) return "0 ETH";
    if (eth < 0.0001) return "< 0.0001 ETH";
    if (eth < 1) return `${eth.toFixed(4)} ETH`;
    return `${eth.toFixed(2)} ETH`;
  };

  const openTxOnExplorer = (hash: string) => {
    const explorerUrl = activeChain === "base"
      ? `${BASESCAN_URL}/tx/${hash}`
      : `${SNOWTRACE_URL}/tx/${hash}`;
    Linking.openURL(explorerUrl);
  };

  const handleSend = () => {
    if (!selectedToken || !sendAmount || !sendRecipient) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!ethers.isAddress(sendRecipient)) {
      Alert.alert("Error", "Invalid recipient address");
      return;
    }
    Alert.alert(
      "Send Transaction",
      `Send ${sendAmount} ${selectedToken.symbol} to ${sendRecipient.slice(0, 10)}...?\n\nIn a real wallet, you would sign this transaction now.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => {
            Alert.alert("Success", "Transaction would be sent (demo mode)");
            setShowSendModal(false);
            setSendAmount("");
            setSendRecipient("");
            setSelectedToken(null);
          },
        },
      ]
    );
  };

  const renderTokenItem = ({ item }: { item: TokenBalance }) => (
    <Pressable
      onPress={() => {
        setSelectedToken(item);
        setShowSendModal(true);
      }}
      style={({ pressed }) => [styles.tokenItem, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.tokenIcon}>
        <MaterialIcons name="account-balance-wallet" size={24} color="#F97316" />
      </View>
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenSymbol}>{item.symbol}</Text>
        <Text style={styles.tokenName}>{item.name}</Text>
      </View>
      <View style={styles.tokenBalance}>
        <Text style={styles.balanceAmount}>{item.balanceFormatted}</Text>
        <Text style={styles.balanceSymbol}>{item.symbol}</Text>
      </View>
    </Pressable>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isOutgoing = item.from.toLowerCase() === connectedAddress?.toLowerCase();
    const isSuccess = item.isError === "0";
    const counterparty = isOutgoing ? item.to : item.from;
    const fnName = item.functionName ? item.functionName.split("(")[0] : "";

    return (
      <Pressable
        onPress={() => openTxOnExplorer(item.hash)}
        style={({ pressed }) => [styles.txItem, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.txIconContainer, !isSuccess && styles.txIconFailed]}>
          <MaterialIcons
            name={isOutgoing ? "call-made" : "call-received"}
            size={18}
            color={isSuccess ? (isOutgoing ? "#F97316" : "#22C55E") : "#EF4444"}
          />
        </View>
        <View style={styles.txInfo}>
          <View style={styles.txTopRow}>
            <Text style={styles.txType}>
              {fnName || (isOutgoing ? "Sent" : "Received")}
            </Text>
            <Text style={[
              styles.txAmount,
              isOutgoing ? styles.txAmountOut : styles.txAmountIn,
              !isSuccess && styles.txAmountFailed,
            ]}>
              {isOutgoing ? "-" : "+"}{formatTxValue(item.value)}
            </Text>
          </View>
          <View style={styles.txBottomRow}>
            <Text style={styles.txAddress}>
              {isOutgoing ? "To: " : "From: "}{shortenAddr(counterparty)}
            </Text>
            <Text style={styles.txTime}>{formatTxDate(item.timeStamp)}</Text>
          </View>
          {!isSuccess && (
            <View style={styles.txFailedBadge}>
              <MaterialIcons name="error-outline" size={12} color="#EF4444" />
              <Text style={styles.txFailedText}>Failed</Text>
            </View>
          )}
        </View>
        <MaterialIcons name="open-in-new" size={14} color="#52525B" style={{ marginLeft: 4 }} />
      </Pressable>
    );
  };

  if (!connectedAddress) {
    return (
      <ScreenContainer className="items-center justify-center">
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <MaterialIcons name="account-balance-wallet" size={48} color="#F97316" />
          </View>
          <Text style={styles.emptyTitle}>No Wallet Connected</Text>
          <Text style={styles.emptySubtitle}>
            Connect your wallet in the Chat tab to view balances and transaction history
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Trust Score Badge */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Connected Wallet</Text>
            <Text style={styles.headerAddress}>
              {connectedAddress.slice(0, 10)}...{connectedAddress.slice(-8)}
            </Text>
          </View>
          {trustScore && (
            <View style={[styles.trustBadge, { borderColor: trustScore.color }]}>
              <Text style={[styles.trustBadgeScore, { color: trustScore.color }]}>
                {trustScore.score}
              </Text>
              <Text style={[styles.trustBadgeLabel, { color: trustScore.color }]}>
                {trustScore.level}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => { loadBalances(); loadTrustScore(); if (activeChain === "base") loadTransactions(); }}
            style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="refresh" size={20} color="#F97316" />
          </Pressable>
        </View>

        {/* Chain Selector */}
        <View style={styles.chainSelector}>
          <Pressable
            onPress={() => setActiveChain("base")}
            style={[styles.chainButton, activeChain === "base" && styles.chainButtonActive]}
          >
            <Text style={[styles.chainButtonText, activeChain === "base" && styles.chainButtonTextActive]}>
              Base
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveChain("avalanche")}
            style={[styles.chainButton, activeChain === "avalanche" && styles.chainButtonActive]}
          >
            <Text style={[styles.chainButtonText, activeChain === "avalanche" && styles.chainButtonTextActive]}>
              Avalanche
            </Text>
          </Pressable>
        </View>

        {/* ETH Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardHeader}>
            <Text style={styles.balanceCardLabel}>
              {activeChain === "base" ? "ETH" : "AVAX"} Balance
            </Text>
            <MaterialIcons name="trending-up" size={20} color="#22C55E" />
          </View>
          <Text style={styles.balanceCardAmount}>
            {parseFloat(ethBalance).toFixed(4)} {activeChain === "base" ? "ETH" : "AVAX"}
          </Text>
          <Text style={styles.balanceCardSubtext}>
            {activeChain === "base" ? "Ethereum Layer 2" : "Avalanche C-Chain"}
          </Text>
        </View>

        {/* Tab Switcher: Tokens / History */}
        <View style={styles.tabSwitcher}>
          <Pressable
            onPress={() => setActiveTab("tokens")}
            style={[styles.tabButton, activeTab === "tokens" && styles.tabButtonActive]}
          >
            <MaterialIcons
              name="account-balance-wallet"
              size={16}
              color={activeTab === "tokens" ? "#F97316" : "#52525B"}
            />
            <Text style={[styles.tabButtonText, activeTab === "tokens" && styles.tabButtonTextActive]}>
              Tokens
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setActiveTab("history"); if (activeChain === "base" && transactions.length === 0) loadTransactions(); }}
            style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
          >
            <MaterialIcons
              name="history"
              size={16}
              color={activeTab === "history" ? "#F97316" : "#52525B"}
            />
            <Text style={[styles.tabButtonText, activeTab === "history" && styles.tabButtonTextActive]}>
              History
            </Text>
          </Pressable>
        </View>

        {/* Tokens View */}
        {activeTab === "tokens" && (
          <>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#F97316" size="large" />
                <Text style={styles.loadingText}>Loading balances...</Text>
              </View>
            ) : tokens.length > 0 ? (
              <View style={styles.tokenList}>
                {tokens.map((token) => (
                  <View key={token.address}>
                    {renderTokenItem({ item: token })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTokens}>
                <MaterialIcons name="info" size={32} color="#52525B" />
                <Text style={styles.emptyTokensText}>
                  No token balances on {activeChain === "base" ? "Base" : "Avalanche"}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Transaction History View */}
        {activeTab === "history" && (
          <>
            {activeChain !== "base" ? (
              <View style={styles.emptyTokens}>
                <MaterialIcons name="info" size={32} color="#52525B" />
                <Text style={styles.emptyTokensText}>
                  Transaction history is available for Base chain only
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(`${SNOWTRACE_URL}/address/${connectedAddress}`)}
                  style={({ pressed }) => [styles.explorerLink, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.explorerLinkText}>View on Snowtrace</Text>
                  <MaterialIcons name="open-in-new" size={14} color="#F97316" />
                </Pressable>
              </View>
            ) : isLoadingTxs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#F97316" size="large" />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : transactions.length > 0 ? (
              <View style={styles.txList}>
                <View style={styles.txListHeader}>
                  <Text style={styles.txListTitle}>Recent Transactions</Text>
                  <Text style={styles.txListCount}>{transactions.length} txs</Text>
                </View>
                {transactions.map((tx) => (
                  <View key={tx.hash}>
                    {renderTransactionItem({ item: tx })}
                  </View>
                ))}
                <Pressable
                  onPress={() => Linking.openURL(`${BASESCAN_URL}/address/${connectedAddress}`)}
                  style={({ pressed }) => [styles.viewAllButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.viewAllText}>View All on BaseScan</Text>
                  <MaterialIcons name="open-in-new" size={14} color="#F97316" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyTokens}>
                <MaterialIcons name="receipt-long" size={32} color="#52525B" />
                <Text style={styles.emptyTokensText}>No transactions found</Text>
                <Pressable
                  onPress={() => Linking.openURL(`${BASESCAN_URL}/address/${connectedAddress}`)}
                  style={({ pressed }) => [styles.explorerLink, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.explorerLinkText}>View on BaseScan</Text>
                  <MaterialIcons name="open-in-new" size={14} color="#F97316" />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Send Modal */}
      <Modal
        visible={showSendModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send {selectedToken?.symbol}</Text>
              <Pressable onPress={() => setShowSendModal(false)}>
                <MaterialIcons name="close" size={24} color="#A1A1AA" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Recipient Address or ENS Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0x... or name.eth / name.base"
                  placeholderTextColor="#52525B"
                  value={resolvedName || sendRecipient}
                  onChangeText={(text) => {
                    if (text.endsWith(".eth") || text.endsWith(".base")) {
                      resolveRecipient(text);
                    } else {
                      setResolvedName(null);
                      setSendRecipient(text);
                    }
                  }}
                  autoCapitalize="none"
                />
                {resolvedName && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                    <MaterialIcons name="check-circle" size={14} color="#22C55E" />
                    <Text style={{ color: "#22C55E", fontSize: 12, marginLeft: 4 }}>
                      Resolved: {sendRecipient.slice(0, 10)}...{sendRecipient.slice(-6)}
                    </Text>
                  </View>
                )}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>Amount</Text>
                <View style={styles.amountInput}>
                  <TextInput
                    style={styles.amountField}
                    placeholder="0.0"
                    placeholderTextColor="#52525B"
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.amountSymbol}>{selectedToken?.symbol}</Text>
                </View>
                <Text style={styles.balanceHint}>
                  Available: {selectedToken?.balanceFormatted} {selectedToken?.symbol}
                </Text>
                <Pressable
                  onPress={() => setSendAmount(selectedToken?.balanceFormatted || "")}
                  style={styles.maxButton}
                >
                  <Text style={styles.maxButtonText}>Use Max</Text>
                </Pressable>
                <Pressable
                  onPress={handleSend}
                  style={({ pressed }) => [styles.sendButton, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.sendButtonText}>Review & Send</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111113",
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 12,
    color: "#A1A1AA",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerAddress: {
    fontSize: 14,
    color: "#F97316",
    fontFamily: "monospace",
    marginTop: 4,
  },
  trustBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "rgba(10, 10, 15, 0.8)",
    marginRight: 8,
  },
  trustBadgeScore: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  trustBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chainSelector: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chainButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  chainButtonActive: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  chainButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  chainButtonTextActive: {
    color: "#09090B",
  },
  balanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#111113",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  balanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceCardLabel: {
    fontSize: 12,
    color: "#A1A1AA",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceCardAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FAFAFA",
    marginBottom: 4,
  },
  balanceCardSubtext: {
    fontSize: 12,
    color: "#52525B",
  },
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#09090B",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: "#111113",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#111113",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52525B",
  },
  tabButtonTextActive: {
    color: "#F97316",
  },
  tokenList: {
    paddingHorizontal: 16,
  },
  tokenItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  tokenName: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 2,
  },
  tokenBalance: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  balanceSymbol: {
    fontSize: 11,
    color: "#A1A1AA",
    marginTop: 2,
  },
  // Transaction History Styles
  txList: {
    paddingHorizontal: 16,
  },
  txListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  txListTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  txListCount: {
    fontSize: 12,
    color: "#52525B",
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  txIconFailed: {
    borderColor: "#EF4444",
    backgroundColor: "#1A0A0A",
  },
  txInfo: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  txType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FAFAFA",
    flex: 1,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  txAmountOut: {
    color: "#F97316",
  },
  txAmountIn: {
    color: "#22C55E",
  },
  txAmountFailed: {
    color: "#EF4444",
    textDecorationLine: "line-through",
  },
  txBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  txAddress: {
    fontSize: 12,
    color: "#52525B",
    fontFamily: "monospace",
  },
  txTime: {
    fontSize: 11,
    color: "#52525B",
    marginLeft: 8,
  },
  txFailedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: "#1A0A0A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  txFailedText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F97316",
  },
  explorerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  explorerLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F97316",
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#A1A1AA",
  },
  emptyTokens: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyTokensText: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F97316",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FAFAFA",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#09090B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FAFAFA",
  },
  modalBody: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FAFAFA",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FAFAFA",
    fontSize: 15,
  },
  amountInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountField: {
    flex: 1,
    color: "#FAFAFA",
    fontSize: 15,
  },
  amountSymbol: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F97316",
    marginLeft: 8,
  },
  balanceHint: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 8,
  },
  maxButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F97316",
  },
  sendButton: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#09090B",
  },
});
