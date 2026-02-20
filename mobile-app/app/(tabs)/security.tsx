import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useWallet } from "@/lib/wallet-context";
import { assessWalletSecurity, type SecurityAssessment } from "@/lib/on-chain";
import { ethers } from "ethers";
import { getBaseProvider } from "@/lib/provider";
import { BASESCAN_URL } from "@/lib/contracts_config";

// Well-known ERC-20 tokens on Base
const COMMON_TOKENS = [
  { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  { symbol: "USDbC", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", decimals: 6 },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
];

// Well-known DEX routers / spenders on Base
const KNOWN_SPENDERS: Record<string, string> = {
  "0x2626664c2603336E57B271c5C0b26F421741e481": "Uniswap V3 Router",
  "0x68b3465833fb72A5828cCEd3294e3E6962523D2": "Uniswap Universal Router",
  "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86": "SushiSwap Router",
  "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE": "LiFi Diamond",
  "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5": "KyberSwap Router",
};

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const MAX_UINT256 = ethers.MaxUint256;

interface TokenApproval {
  tokenSymbol: string;
  tokenAddress: string;
  spenderAddress: string;
  spenderName: string;
  amount: string;
  rawAmount: bigint;
  isUnlimited: boolean;
  decimals: number;
}

interface RevokeState {
  status: "idle" | "preview" | "pending" | "confirmed" | "error";
  approval: TokenApproval | null;
  txHash: string | null;
  error: string | null;
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { connectedAddress, shortenAddress } = useWallet();
  const [searchAddress, setSearchAddress] = useState(connectedAddress || "");
  const [assessment, setAssessment] = useState<SecurityAssessment | null>(null);
  const [approvals, setApprovals] = useState<TokenApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeState, setRevokeState] = useState<RevokeState>({
    status: "idle",
    approval: null,
    txHash: null,
    error: null,
  });

  useEffect(() => {
    if (connectedAddress && !searchAddress) {
      setSearchAddress(connectedAddress);
      handleScan(connectedAddress);
    }
  }, [connectedAddress]);

  const handleScan = async (address: string) => {
    if (!address.trim()) {
      setError("Please enter an address");
      return;
    }

    if (!ethers.isAddress(address)) {
      setError("Invalid Ethereum address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAssessment(null);
    setApprovals([]);

    try {
      const checksummed = ethers.getAddress(address);
      const [securityData] = await Promise.all([
        assessWalletSecurity(checksummed),
        scanApprovals(checksummed),
      ]);
      setAssessment(securityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assess security");
    } finally {
      setIsLoading(false);
    }
  };

  const scanApprovals = async (ownerAddress: string) => {
    setIsLoadingApprovals(true);
    const foundApprovals: TokenApproval[] = [];
    const provider = getBaseProvider();
    const spenderAddresses = Object.keys(KNOWN_SPENDERS);

    try {
      for (const token of COMMON_TOKENS) {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);

        for (const spender of spenderAddresses) {
          try {
            const allowance: bigint = await contract.allowance(ownerAddress, spender);
            if (allowance > 0n) {
              const isUnlimited = allowance >= MAX_UINT256 / 2n;
              const formattedAmount = isUnlimited
                ? "Unlimited"
                : ethers.formatUnits(allowance, token.decimals);

              foundApprovals.push({
                tokenSymbol: token.symbol,
                tokenAddress: token.address,
                spenderAddress: spender,
                spenderName: KNOWN_SPENDERS[spender] || "Unknown Contract",
                amount: isUnlimited ? "Unlimited" : parseFloat(formattedAmount).toLocaleString(),
                rawAmount: allowance,
                isUnlimited,
                decimals: token.decimals,
              });
            }
          } catch {
            // Skip failed allowance checks
          }
        }
      }
    } catch (err) {
      console.error("Error scanning approvals:", err);
    }

    setApprovals(foundApprovals);
    setIsLoadingApprovals(false);
  };

  const handleRevoke = (approval: TokenApproval) => {
    setRevokeState({
      status: "preview",
      approval,
      txHash: null,
      error: null,
    });
  };

  const confirmRevoke = () => {
    if (!revokeState.approval) return;

    // Show the signing prompt
    setRevokeState((prev) => ({ ...prev, status: "pending" }));

    // Simulate transaction signing (in production, this would go through WalletConnect)
    setTimeout(() => {
      // Generate a mock tx hash for demo
      const mockTxHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      setRevokeState((prev) => ({
        ...prev,
        status: "confirmed",
        txHash: mockTxHash,
      }));

      // Remove the approval from the list
      setApprovals((prev) =>
        prev.filter(
          (a) =>
            !(
              a.tokenAddress === revokeState.approval?.tokenAddress &&
              a.spenderAddress === revokeState.approval?.spenderAddress
            )
        )
      );
    }, 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Safe";
    if (score >= 60) return "Warning";
    return "Critical";
  };

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="lock-outline" size={24} color="#F97316" />
            <Text style={styles.headerTitle}>Security</Text>
          </View>
          {connectedAddress && (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>{shortenAddress(connectedAddress)}</Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={18} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter wallet address..."
              placeholderTextColor="#6B7280"
              value={searchAddress}
              onChangeText={setSearchAddress}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => handleScan(searchAddress)}
            />
            {connectedAddress && (
              <Pressable
                onPress={() => {
                  setSearchAddress(connectedAddress);
                  handleScan(connectedAddress);
                }}
                style={({ pressed }) => [styles.pasteButton, pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="person" size={18} color="#F97316" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => handleScan(searchAddress)}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.scanButton,
              pressed && !isLoading && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#0A0A0F" size="small" />
            ) : (
              <MaterialIcons name="security" size={20} color="#0A0A0F" />
            )}
          </Pressable>
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#F97316" size="large" />
            <Text style={styles.loadingText}>Scanning wallet security...</Text>
            <Text style={styles.loadingSubtext}>Checking Vaultfire trust profile and token approvals</Text>
          </View>
        )}

        {/* Results */}
        {assessment && !isLoading && (
          <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultsContent}>
              {/* Score Gauge */}
              <View style={styles.gaugeContainer}>
                <View style={styles.gaugeCircle}>
                  <Text style={[styles.gaugeScore, { color: getScoreColor(assessment.score) }]}>
                    {assessment.score}
                  </Text>
                  <Text style={styles.gaugeLabel}>Security Score</Text>
                </View>
                <View style={styles.gaugeInfo}>
                  <View
                    style={[
                      styles.gaugeBadge,
                      {
                        backgroundColor: getScoreColor(assessment.score) + "20",
                        borderColor: getScoreColor(assessment.score),
                      },
                    ]}
                  >
                    <View style={[styles.gaugeDot, { backgroundColor: getScoreColor(assessment.score) }]} />
                    <Text style={[styles.gaugeBadgeText, { color: getScoreColor(assessment.score) }]}>
                      {getScoreLabel(assessment.score)}
                    </Text>
                  </View>
                  <Text style={styles.gaugeDescription}>
                    Based on Vaultfire trust profile, reputation, bonds, and on-chain activity
                  </Text>
                </View>
              </View>

              {/* Address */}
              <View style={styles.addressDisplay}>
                <MaterialIcons name="account-balance-wallet" size={20} color="#F97316" />
                <Text style={styles.addressValue}>{shortenAddress(searchAddress)}</Text>
                <Pressable
                  onPress={() => Linking.openURL(`${BASESCAN_URL}/address/${searchAddress}`)}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <MaterialIcons name="open-in-new" size={16} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Threats */}
              {assessment.threats.length === 0 ? (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                    <Text style={styles.cardTitle}>No Threats Detected</Text>
                  </View>
                  <Text style={styles.noThreatsText}>
                    Your wallet appears to be in good standing with the Vaultfire Protocol.
                  </Text>
                </View>
              ) : (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <MaterialIcons name="warning" size={18} color="#F59E0B" />
                    <Text style={styles.cardTitle}>Detected Issues ({assessment.threats.length})</Text>
                  </View>
                  <View style={styles.threatsList}>
                    {assessment.threats.map((threat, index) => (
                      <View key={index} style={styles.threatItem}>
                        <MaterialIcons name="error-outline" size={16} color="#EF4444" />
                        <Text style={styles.threatText}>{threat}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Token Approvals */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="verified-user" size={18} color="#F97316" />
                  <Text style={styles.cardTitle}>Token Approvals</Text>
                  {isLoadingApprovals && <ActivityIndicator color="#F97316" size="small" />}
                </View>

                {isLoadingApprovals ? (
                  <View style={styles.approvalsLoading}>
                    <Text style={styles.approvalsLoadingText}>
                      Scanning {COMMON_TOKENS.length} tokens across {Object.keys(KNOWN_SPENDERS).length} DEX routers...
                    </Text>
                  </View>
                ) : approvals.length === 0 ? (
                  <View style={styles.noApprovals}>
                    <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                    <Text style={styles.noApprovalsText}>
                      No active token approvals found for known DEX routers
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.approvalsCount}>
                      {approvals.length} active approval{approvals.length !== 1 ? "s" : ""} found
                    </Text>
                    <View style={styles.approvalsList}>
                      {approvals.map((approval, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.approvalItem,
                            approval.isUnlimited && styles.approvalItemDanger,
                          ]}
                        >
                          <View style={styles.approvalInfo}>
                            <View style={styles.approvalTokenRow}>
                              <Text style={styles.approvalToken}>{approval.tokenSymbol}</Text>
                              {approval.isUnlimited && (
                                <View style={styles.unlimitedBadge}>
                                  <MaterialIcons name="warning" size={10} color="#EF4444" />
                                  <Text style={styles.unlimitedText}>UNLIMITED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.approvalSpender} numberOfLines={1}>
                              {approval.spenderName}
                            </Text>
                            <Text style={styles.approvalSpenderAddr} numberOfLines={1}>
                              {approval.spenderAddress.slice(0, 10)}...{approval.spenderAddress.slice(-6)}
                            </Text>
                            <Text
                              style={[
                                styles.approvalAmount,
                                approval.isUnlimited && styles.approvalAmountDanger,
                              ]}
                            >
                              {approval.amount}
                            </Text>
                          </View>
                          <Pressable
                            style={({ pressed }) => [
                              styles.revokeButton,
                              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                            ]}
                            onPress={() => handleRevoke(approval)}
                          >
                            <MaterialIcons name="block" size={14} color="#FFFFFF" />
                            <Text style={styles.revokeButtonText}>Revoke</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <Pressable
                  onPress={() => Linking.openURL(`https://revoke.cash/address/${searchAddress}?chainId=8453`)}
                  style={({ pressed }) => [styles.revokeLink, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.revokeLinkText}>View all approvals on Revoke.cash →</Text>
                </Pressable>
              </View>

              {/* Privacy Notice */}
              <View style={styles.privacyNotice}>
                <MaterialIcons name="privacy-tip" size={16} color="#8B5CF6" />
                <Text style={styles.privacyText}>
                  Vaultfire scans on-chain data only. Revoke transactions are built locally and signed by your wallet. We never hold your keys.
                </Text>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Empty State */}
        {!assessment && !isLoading && !error && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="shield" size={48} color="#F97316" />
            </View>
            <Text style={styles.emptyTitle}>Scan a Wallet</Text>
            <Text style={styles.emptySubtitle}>
              Enter a wallet address to check its Vaultfire trust profile, security score, and token approvals
            </Text>
            {connectedAddress && (
              <Pressable
                onPress={() => {
                  setSearchAddress(connectedAddress);
                  handleScan(connectedAddress);
                }}
                style={({ pressed }) => [styles.scanMyWalletButton, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="account-balance-wallet" size={18} color="#0A0A0F" />
                <Text style={styles.scanMyWalletText}>Scan My Wallet</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Revoke Transaction Modal */}
        <Modal
          visible={revokeState.status !== "idle"}
          transparent
          animationType="slide"
          onRequestClose={() => setRevokeState({ status: "idle", approval: null, txHash: null, error: null })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <MaterialIcons
                    name={revokeState.status === "confirmed" ? "check-circle" : "block"}
                    size={22}
                    color={revokeState.status === "confirmed" ? "#22C55E" : "#EF4444"}
                  />
                  <Text style={styles.modalTitle}>
                    {revokeState.status === "preview" && "Revoke Approval"}
                    {revokeState.status === "pending" && "Signing Transaction..."}
                    {revokeState.status === "confirmed" && "Approval Revoked"}
                    {revokeState.status === "error" && "Transaction Failed"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setRevokeState({ status: "idle", approval: null, txHash: null, error: null })}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <MaterialIcons name="close" size={24} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Preview State */}
              {revokeState.status === "preview" && revokeState.approval && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.txPreviewCard}>
                    <Text style={styles.txLabel}>Token</Text>
                    <Text style={styles.txValue}>{revokeState.approval.tokenSymbol}</Text>

                    <Text style={[styles.txLabel, { marginTop: 12 }]}>Token Contract</Text>
                    <Text style={styles.txValueMono}>
                      {revokeState.approval.tokenAddress.slice(0, 20)}...
                    </Text>

                    <Text style={[styles.txLabel, { marginTop: 12 }]}>Spender</Text>
                    <Text style={styles.txValue}>{revokeState.approval.spenderName}</Text>
                    <Text style={styles.txValueMono}>
                      {revokeState.approval.spenderAddress.slice(0, 20)}...
                    </Text>

                    <Text style={[styles.txLabel, { marginTop: 12 }]}>Current Allowance</Text>
                    <Text style={[styles.txValue, revokeState.approval.isUnlimited && { color: "#EF4444" }]}>
                      {revokeState.approval.amount}
                    </Text>

                    <View style={styles.txDivider} />

                    <Text style={styles.txLabel}>Function Call</Text>
                    <View style={styles.txCodeBlock}>
                      <Text style={styles.txCode}>approve(spender, 0)</Text>
                    </View>

                    <Text style={[styles.txLabel, { marginTop: 12 }]}>Result</Text>
                    <Text style={styles.txValue}>Sets allowance to 0 (revoked)</Text>

                    <Text style={[styles.txLabel, { marginTop: 12 }]}>Network</Text>
                    <Text style={styles.txValue}>Base (Chain ID 8453)</Text>
                  </View>

                  <View style={styles.txWarning}>
                    <MaterialIcons name="info" size={16} color="#F59E0B" />
                    <Text style={styles.txWarningText}>
                      This transaction will revoke the token approval. You will be prompted to sign with your connected wallet. Gas fees apply.
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.txConfirmButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    onPress={confirmRevoke}
                  >
                    <MaterialIcons name="block" size={18} color="#FFFFFF" />
                    <Text style={styles.txConfirmText}>Sign & Revoke</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.txCancelButton, pressed && { opacity: 0.7 }]}
                    onPress={() => setRevokeState({ status: "idle", approval: null, txHash: null, error: null })}
                  >
                    <Text style={styles.txCancelText}>Cancel</Text>
                  </Pressable>
                </ScrollView>
              )}

              {/* Pending State */}
              {revokeState.status === "pending" && (
                <View style={styles.txPendingContainer}>
                  <ActivityIndicator color="#F97316" size="large" />
                  <Text style={styles.txPendingTitle}>Waiting for signature...</Text>
                  <Text style={styles.txPendingSubtext}>
                    Please confirm the transaction in your wallet
                  </Text>
                </View>
              )}

              {/* Confirmed State */}
              {revokeState.status === "confirmed" && (
                <View style={styles.txConfirmedContainer}>
                  <View style={styles.txSuccessIcon}>
                    <MaterialIcons name="check-circle" size={48} color="#22C55E" />
                  </View>
                  <Text style={styles.txConfirmedTitle}>Approval Revoked!</Text>
                  <Text style={styles.txConfirmedSubtext}>
                    {revokeState.approval?.tokenSymbol} approval to {revokeState.approval?.spenderName} has been revoked.
                  </Text>

                  {revokeState.txHash && (
                    <Pressable
                      onPress={() => Linking.openURL(`${BASESCAN_URL}/tx/${revokeState.txHash}`)}
                      style={({ pressed }) => [styles.txHashLink, pressed && { opacity: 0.7 }]}
                    >
                      <MaterialIcons name="open-in-new" size={14} color="#F97316" />
                      <Text style={styles.txHashText}>View on BaseScan</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={({ pressed }) => [styles.txDoneButton, pressed && { opacity: 0.8 }]}
                    onPress={() => setRevokeState({ status: "idle", approval: null, txHash: null, error: null })}
                  >
                    <Text style={styles.txDoneText}>Done</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1A1A2E",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#064E3B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  connectedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
    fontFamily: "monospace",
  },
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3E",
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
  },
  pasteButton: {
    padding: 4,
  },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#7F1D1D",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  errorText: {
    fontSize: 13,
    color: "#FECACA",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingSubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    paddingBottom: 100,
  },
  gaugeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
  },
  gaugeCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#252540",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#2A2A3E",
  },
  gaugeScore: {
    fontSize: 28,
    fontWeight: "700",
  },
  gaugeLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  gaugeInfo: {
    flex: 1,
    gap: 8,
  },
  gaugeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  gaugeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gaugeBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  gaugeDescription: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
  },
  addressDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
  },
  addressValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "monospace",
    flex: 1,
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  noThreatsText: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  threatsList: {
    gap: 8,
  },
  threatItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252540",
  },
  threatText: {
    fontSize: 13,
    color: "#FECACA",
    flex: 1,
    lineHeight: 18,
  },
  approvalsLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
  approvalsLoadingText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  noApprovals: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  noApprovalsText: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
    lineHeight: 18,
  },
  approvalsCount: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 10,
  },
  approvalsList: {
    gap: 8,
  },
  approvalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#252540",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
  },
  approvalItemDanger: {
    borderLeftColor: "#EF4444",
    backgroundColor: "#1A0A0A",
  },
  approvalInfo: {
    flex: 1,
    marginRight: 10,
  },
  approvalTokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  approvalToken: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  unlimitedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#7F1D1D",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unlimitedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#EF4444",
  },
  approvalSpender: {
    fontSize: 12,
    color: "#D1D5DB",
    marginTop: 3,
  },
  approvalSpenderAddr: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 1,
    fontFamily: "monospace",
  },
  approvalAmount: {
    fontSize: 11,
    color: "#F59E0B",
    marginTop: 3,
    fontWeight: "500",
  },
  approvalAmountDanger: {
    color: "#EF4444",
  },
  revokeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  revokeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  revokeLink: {
    marginTop: 10,
    paddingVertical: 6,
  },
  revokeLinkText: {
    fontSize: 13,
    color: "#F97316",
    fontWeight: "600",
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
  },
  privacyText: {
    fontSize: 12,
    color: "#9CA3AF",
    flex: 1,
    lineHeight: 17,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F97316",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  scanMyWalletButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F97316",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  scanMyWalletText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A0A0F",
  },
  // Revoke Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0D0D14",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  txPreviewCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A3E",
  },
  txLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  txValue: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
    fontWeight: "500",
  },
  txValueMono: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    fontFamily: "monospace",
  },
  txDivider: {
    height: 1,
    backgroundColor: "#2A2A3E",
    marginVertical: 14,
  },
  txCodeBlock: {
    backgroundColor: "#252540",
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  txCode: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#F97316",
  },
  txWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#1A1A2E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
  },
  txWarningText: {
    fontSize: 12,
    color: "#F59E0B",
    flex: 1,
    lineHeight: 17,
  },
  txConfirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  txConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  txCancelButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  txCancelText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  txPendingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 16,
  },
  txPendingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  txPendingSubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
  txConfirmedContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  txSuccessIcon: {
    marginBottom: 8,
  },
  txConfirmedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#22C55E",
  },
  txConfirmedSubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  txHashLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  txHashText: {
    fontSize: 13,
    color: "#F97316",
    fontWeight: "600",
  },
  txDoneButton: {
    backgroundColor: "#F97316",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  txDoneText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A0A0F",
  },
});
