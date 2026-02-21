import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import * as Clipboard from "expo-clipboard";
import {
  ChainBalance,
  SUPPORTED_CHAINS,
  calculateTotalValue,
  createWallet,
  deleteWallet,
  formatWei,
  getAllBalances,
  getWalletAddress,
  importFromMnemonic,
  importFromPrivateKey,
  isWalletCreated,
} from "@/lib/wallet-core";
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

interface EmberMessage {
  text: string;
  isEmber: boolean;
}

// ─── Wallet Screen ──────────────────────────────────────────────────

export default function WalletScreen() {
  const colors = useColors();
  const [phase, setPhase] = useState<WalletPhase>("loading");
  const [address, setAddress] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<string[]>(["", "", ""]);
  const [verifyError, setVerifyError] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [emberMessages, setEmberMessages] = useState<EmberMessage[]>([]);

  // ─── Init ──────────────────────────────────────────────────────────

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = useCallback(async () => {
    try {
      const created = await isWalletCreated();
      if (created) {
        const addr = await getWalletAddress();
        if (addr) {
          setAddress(addr);
          setPhase("ready");
          fetchBalances(addr);
          return;
        }
      }
      setPhase("onboarding");
    } catch {
      setPhase("onboarding");
    }
  }, []);

  // ─── Balance Fetching ──────────────────────────────────────────────

  const fetchBalances = useCallback(async (addr: string) => {
    try {
      const results = await getAllBalances(addr);
      setBalances(results);
    } catch {
      // Keep existing balances on error
    }
  }, []);

  const onRefresh = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    await fetchBalances(address);
    setRefreshing(false);
  }, [address, fetchBalances]);

  // ─── Wallet Creation ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setPhase("creating");
    setEmberMessages([
      { text: "Welcome! Let's set up your Vaultfire wallet together. This will be your key to the Vaultfire ecosystem.", isEmber: true },
    ]);

    // Small delay for the conversational feel
    await new Promise((r) => setTimeout(r, 1200));
    setEmberMessages((prev) => [
      ...prev,
      { text: "Generating your unique keypair now... This uses cryptographically secure randomness.", isEmber: true },
    ]);

    try {
      const wallet = await createWallet();
      setAddress(wallet.address);
      setMnemonic(wallet.mnemonic);

      await new Promise((r) => setTimeout(r, 800));
      setEmberMessages((prev) => [
        ...prev,
        { text: `Your wallet is ready! Address: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`, isEmber: true },
        { text: "Now I need you to back up your recovery phrase. This is the ONLY way to recover your wallet. Write these 12 words down somewhere safe.", isEmber: true },
      ]);

      await new Promise((r) => setTimeout(r, 600));

      // Pick 3 random indices for verification
      const indices: number[] = [];
      while (indices.length < 3) {
        const idx = Math.floor(Math.random() * 12);
        if (!indices.includes(idx)) indices.push(idx);
      }
      setVerifyIndices(indices.sort((a, b) => a - b));
      setPhase("backup");
    } catch (err: any) {
      setEmberMessages((prev) => [
        ...prev,
        { text: `Something went wrong: ${err.message}. Let's try again.`, isEmber: true },
      ]);
      setPhase("onboarding");
    }
  }, []);

  const handleBackupConfirm = useCallback(() => {
    setEmberMessages([
      { text: "Great! Now let's verify you wrote them down correctly. Please enter the following words from your recovery phrase:", isEmber: true },
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
      setEmberMessages([
        { text: "Your wallet is secured! I'll always be here to help you manage it. Welcome to the Vaultfire ecosystem. 🔥", isEmber: true },
      ]);
      setMnemonic(null); // Clear mnemonic from memory
      setPhase("ready");
      if (address) fetchBalances(address);
    } else {
      setVerifyError(true);
      setVerifyInputs(["", "", ""]);
      setTimeout(() => setVerifyError(false), 2000);
    }
  }, [mnemonic, verifyIndices, verifyInputs, address, fetchBalances]);

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
      fetchBalances(wallet.address);
    } catch (err: any) {
      setImportError(err.message || "Invalid input");
    } finally {
      setImportLoading(false);
    }
  }, [importText, fetchBalances]);

  // ─── Delete Wallet ─────────────────────────────────────────────────

  const handleDeleteWallet = useCallback(() => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete your wallet? This cannot be undone without your recovery phrase.")) {
        deleteWallet().then(() => {
          setAddress(null);
          setBalances([]);
          setPhase("onboarding");
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
              setPhase("onboarding");
            },
          },
        ]
      );
    }
  }, []);

  // ─── Copy Address ──────────────────────────────────────────────────

  const [copied, setCopied] = useState(false);
  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  // ─── Computed Values ───────────────────────────────────────────────

  const totalValue = useMemo(() => calculateTotalValue(balances), [balances]);
  const mnemonicWords = useMemo(() => mnemonic?.split(" ") ?? [], [mnemonic]);

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
            {/* Shield+Flame */}
            <View style={[s.logoCircle, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={s.logoEmoji}>🔥</Text>
            </View>

            <Text style={[s.title, { color: colors.foreground }]}>
              Create Your Vaultfire Wallet
            </Text>
            <Text style={[s.subtitle, { color: colors.muted }]}>
              Your gateway to the Vaultfire ecosystem.{"\n"}
              Secured on-device. Private key never leaves your phone.
            </Text>

            {/* Ember intro message */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={[s.emberBubble, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
            >
              <Text style={[s.emberLabel, { color: colors.primary }]}>🔥 Ember</Text>
              <Text style={[s.emberText, { color: colors.foreground }]}>
                Welcome! I'll guide you through setting up your wallet. It only takes a minute.
              </Text>
            </Animated.View>

            {/* Create Button */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={s.fullWidth}>
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [
                  s.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[s.primaryButtonText, { color: "#FFFFFF" }]}>Create New Wallet</Text>
              </Pressable>
            </Animated.View>

            {/* Import Button */}
            <Animated.View entering={FadeInDown.delay(500).duration(400)} style={s.fullWidth}>
              <Pressable
                onPress={() => setPhase("import")}
                style={({ pressed }) => [
                  s.secondaryButton,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.secondaryButtonText, { color: colors.foreground }]}>
                  Import Existing Wallet
                </Text>
              </Pressable>
            </Animated.View>

            {/* Security note */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
              <Text style={[s.securityNote, { color: colors.muted }]}>
                🔒 Your private key is encrypted and stored only on this device.
                {"\n"}No cloud backup. No server storage. You are in control.
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Creating (Ember conversational) ──────────────────────

  if (phase === "creating") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.chatContainer}>
            {emberMessages.map((msg, idx) => (
              <Animated.View
                key={idx}
                entering={FadeInDown.delay(idx * 300).duration(400)}
                style={[
                  s.emberBubble,
                  { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` },
                ]}
              >
                <Text style={[s.emberLabel, { color: colors.primary }]}>🔥 Ember</Text>
                <Text style={[s.emberText, { color: colors.foreground }]}>{msg.text}</Text>
              </Animated.View>
            ))}
            <ActivityIndicator size="small" color={colors.primary} style={s.loadingDot} />
          </View>
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
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>
              Recovery Phrase
            </Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.emberBubble, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
            >
              <Text style={[s.emberLabel, { color: colors.primary }]}>🔥 Ember</Text>
              <Text style={[s.emberText, { color: colors.foreground }]}>
                Write these words down in order. Ember can't recover them for you. This is your only backup.
              </Text>
            </Animated.View>

            {/* Seed phrase grid */}
            <View style={s.seedGrid}>
              {mnemonicWords.map((word, idx) => (
                <Animated.View
                  key={idx}
                  entering={FadeInDown.delay(150 + idx * 50).duration(300)}
                  style={[s.seedWord, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[s.seedIndex, { color: colors.muted }]}>{idx + 1}</Text>
                  <Text style={[s.seedText, { color: colors.foreground }]}>{word}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Warning */}
            <View style={[s.warningBox, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}40` }]}>
              <Text style={[s.warningText, { color: colors.warning }]}>
                ⚠️ Never share your recovery phrase. Anyone with these words can access your wallet.
              </Text>
            </View>

            <Pressable
              onPress={handleBackupConfirm}
              style={({ pressed }) => [
                s.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.primaryButtonText, { color: "#FFFFFF" }]}>I've Written It Down</Text>
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
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>
              Verify Your Backup
            </Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.emberBubble, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
            >
              <Text style={[s.emberLabel, { color: colors.primary }]}>🔥 Ember</Text>
              <Text style={[s.emberText, { color: colors.foreground }]}>
                Enter the following words from your recovery phrase to confirm you saved it correctly.
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
                <Text style={[s.verifyLabel, { color: colors.muted }]}>
                  Word #{wordIdx + 1}
                </Text>
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
                      borderColor: verifyError ? colors.error : colors.border,
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
              <Text style={[s.primaryButtonText, { color: "#FFFFFF" }]}>Verify & Complete</Text>
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
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>
              Import Wallet
            </Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.emberBubble, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
            >
              <Text style={[s.emberLabel, { color: colors.primary }]}>🔥 Ember</Text>
              <Text style={[s.emberText, { color: colors.foreground }]}>
                Paste your 12-word seed phrase or private key below. Your key will be encrypted and stored only on this device.
              </Text>
            </Animated.View>

            {importError && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={[s.errorText, { color: colors.error }]}>{importError}</Text>
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
                  borderColor: importError ? colors.error : colors.border,
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
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[s.primaryButtonText, { color: "#FFFFFF" }]}>Import Wallet</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setPhase("onboarding");
                setImportText("");
                setImportError(null);
              }}
              style={({ pressed }) => [
                s.secondaryButton,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.secondaryButtonText, { color: colors.muted }]}>Back</Text>
            </Pressable>
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
        {/* Portfolio Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.portfolioHeader}>
          <Text style={[s.portfolioLabel, { color: colors.muted }]}>Total Portfolio</Text>
          <Text style={[s.portfolioValue, { color: colors.foreground }]}>
            {totalValue} <Text style={[s.portfolioUnit, { color: colors.muted }]}>ETH equiv.</Text>
          </Text>
          <View style={s.addressRow}>
            <Text style={[s.addressText, { color: colors.muted }]}>
              {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ""}
            </Text>
            <Pressable
              onPress={handleCopyAddress}
              style={({ pressed }) => [
                s.copyButton,
                { backgroundColor: `${colors.primary}20`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.copyButtonText, { color: colors.primary }]}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.actionRow}>
          <Pressable
            onPress={handleCopyAddress}
            style={({ pressed }) => [
              s.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={s.actionIcon}>📥</Text>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>Receive</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (Platform.OS === "web") {
                alert("Send functionality coming soon!");
              } else {
                Alert.alert("Coming Soon", "Send functionality will be available in a future update.");
              }
            }}
            style={({ pressed }) => [
              s.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={s.actionIcon}>📤</Text>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>Send</Text>
          </Pressable>
        </Animated.View>

        {/* Chain Balance Cards */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Balances</Text>
        </Animated.View>

        {balances.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.loadingBalances}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[s.loadingText, { color: colors.muted }]}>Fetching balances...</Text>
          </Animated.View>
        ) : (
          balances.map((balance, idx) => (
            <Animated.View
              key={balance.chain.chainId}
              entering={FadeInDown.delay(300 + idx * 100).duration(400)}
              style={[s.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={s.balanceCardLeft}>
                <View style={[s.chainDot, { backgroundColor: balance.chain.color }]}>
                  <Text style={s.chainLogo}>{balance.chain.logo}</Text>
                </View>
                <View>
                  <Text style={[s.chainName, { color: colors.foreground }]}>{balance.chain.name}</Text>
                  <Text style={[s.chainId, { color: colors.muted }]}>
                    Chain ID: {balance.chain.chainId}
                  </Text>
                </View>
              </View>
              <View style={s.balanceCardRight}>
                <Text style={[s.balanceAmount, { color: colors.foreground }]}>
                  {balance.error ? "Error" : balance.balanceFormatted}
                </Text>
                <Text style={[s.balanceSymbol, { color: colors.muted }]}>
                  {balance.chain.symbol}
                </Text>
              </View>
            </Animated.View>
          ))
        )}

        {/* Transaction History Placeholder */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <Text style={[s.sectionLabel, { color: colors.foreground, marginTop: 24 }]}>
            Recent Activity
          </Text>
          <View style={[s.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={[s.emptyTitle, { color: colors.muted }]}>No transactions yet</Text>
            <Text style={[s.emptySubtitle, { color: `${colors.muted}80` }]}>
              Your transaction history will appear here
            </Text>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={s.dangerZone}>
          <Pressable
            onPress={handleDeleteWallet}
            style={({ pressed }) => [
              s.deleteButton,
              { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[s.deleteButtonText, { color: colors.error }]}>Delete Wallet</Text>
          </Pressable>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 40,
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
  // Ember bubble
  emberBubble: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 4,
  },
  emberLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  emberText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Buttons
  primaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
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
  securityNote: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 10,
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
  seedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
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
    fontSize: 12,
    fontWeight: "600",
    minWidth: 18,
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
  // Ready / Main wallet
  portfolioHeader: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 4,
  },
  portfolioLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  portfolioValue: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  portfolioUnit: {
    fontSize: 16,
    fontWeight: "400",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  addressText: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  // Balance cards
  sectionLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  balanceCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chainDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chainLogo: {
    fontSize: 18,
  },
  chainName: {
    fontSize: 16,
    fontWeight: "600",
  },
  chainId: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceCardRight: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  balanceSymbol: {
    fontSize: 12,
    marginTop: 2,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  // Loading
  loadingBalances: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  // Danger zone
  dangerZone: {
    marginTop: 32,
    alignItems: "center",
  },
  deleteButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
