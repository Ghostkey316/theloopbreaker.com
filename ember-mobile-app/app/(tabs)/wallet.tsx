import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

interface EmbrisMessage {
  text: string;
  isEmbris: boolean;
}

// ─── Chain Icon Component ───────────────────────────────────────────

function ChainIcon({ name, size = 36 }: { name: string; size?: number }) {
  const colors = useColors();
  const iconMap: Record<string, { bg: string; letter: string; color: string }> = {
    Ethereum: { bg: "#627EEA", letter: "Ξ", color: "#FFFFFF" },
    Base: { bg: "#0052FF", letter: "B", color: "#FFFFFF" },
    Avalanche: { bg: "#E84142", letter: "A", color: "#FFFFFF" },
  };
  const config = iconMap[name] || { bg: colors.muted, letter: "?", color: "#FFFFFF" };
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: config.bg,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <Text style={{
        color: config.color,
        fontSize: size * 0.45,
        fontWeight: "700",
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      }}>
        {config.letter}
      </Text>
    </View>
  );
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
  const [embrisMessages, setEmbrisMessages] = useState<EmbrisMessage[]>([]);
  const [showFullAddress, setShowFullAddress] = useState(false);

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
    setEmbrisMessages([
      { text: "Welcome! Let's set up your Vaultfire wallet together. This will be your key to the Vaultfire ecosystem.", isEmbris: true },
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
        { text: "Now I need you to back up your recovery phrase. This is the ONLY way to recover your wallet. Write these 12 words down somewhere safe.", isEmbris: true },
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
      { text: "Great! Now let's verify you wrote them down correctly. Please enter the following words from your recovery phrase:", isEmbris: true },
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
      setEmbrisMessages([
        { text: "Your wallet is secured! I'll always be here to help you manage it. Welcome to the Vaultfire ecosystem.", isEmbris: true },
      ]);
      setMnemonic(null);
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

  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

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
            {/* Premium shield icon */}
            <View style={[s.logoCircle, { backgroundColor: `${colors.primary}15` }]}>
              <IconSymbol name="lock.shield.fill" size={40} color={colors.primary} />
            </View>

            <Text style={[s.title, { color: colors.foreground }]}>
              Vaultfire Wallet
            </Text>
            <Text style={[s.subtitle, { color: colors.muted }]}>
              Your gateway to the Vaultfire ecosystem.{"\n"}
              Secured on-device. Private key never leaves your phone.
            </Text>

            {/* Embris intro message */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name="wallet.pass.fill" size={18} color="#FAFAFA" />
                  <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Create New Wallet</Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Import Button */}
            <Animated.View entering={FadeInDown.delay(500).duration(400)} style={s.fullWidth}>
              <Pressable
                onPress={() => setPhase("import")}
                style={({ pressed }) => [
                  s.secondaryButton,
                  { borderColor: `${colors.foreground}15`, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.secondaryButtonText, { color: colors.foreground }]}>
                  Import Existing Wallet
                </Text>
              </Pressable>
            </Animated.View>

            {/* Security note */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)} style={{ width: "100%" }}>
              <View style={[s.securityCard, { backgroundColor: `${colors.success}08`, borderColor: `${colors.success}20` }]}>
                <IconSymbol name="lock.shield.fill" size={16} color={colors.success} />
                <Text style={[s.securityNote, { color: colors.muted }]}>
                  Your private key is encrypted and stored only on this device.
                  No cloud backup. No server storage. You are in control.
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── Render: Creating (Embris conversational) ──────────────────────

  if (phase === "creating") {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.chatContainer}>
            {embrisMessages.map((msg, idx) => (
              <Animated.View
                key={idx}
                entering={FadeInDown.delay(idx * 300).duration(400)}
                style={[
                  s.embrisBubble,
                  { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                  <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
                </View>
                <Text style={[s.embrisText, { color: colors.foreground }]}>{msg.text}</Text>
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
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
                Write these words down in order. Embris can't recover them for you. This is your only backup.
              </Text>
            </Animated.View>

            {/* Seed phrase grid */}
            <View style={[s.seedContainer, { backgroundColor: colors.surface, borderColor: `${colors.foreground}08` }]}>
              <View style={s.seedGrid}>
                {mnemonicWords.map((word, idx) => (
                  <Animated.View
                    key={idx}
                    entering={FadeInDown.delay(150 + idx * 50).duration(300)}
                    style={[s.seedWord, { backgroundColor: colors.background, borderColor: `${colors.foreground}06` }]}
                  >
                    <Text style={[s.seedIndex, { color: colors.muted }]}>{idx + 1}</Text>
                    <Text style={[s.seedText, { color: colors.foreground }]}>{word}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>

            {/* Warning */}
            <View style={[s.warningBox, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />
                <Text style={[s.warningText, { color: colors.warning, flex: 1 }]}>
                  Never share your recovery phrase. Anyone with these words can access your wallet.
                </Text>
              </View>
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
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>
              Verify Your Backup
            </Text>

            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[s.embrisBubble, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}20` }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <IconSymbol name="flame.fill" size={14} color={colors.primary} />
                <Text style={[s.embrisLabel, { color: colors.primary, marginBottom: 0 }]}>Embris</Text>
              </View>
              <Text style={[s.embrisText, { color: colors.foreground }]}>
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
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>
              Import Wallet
            </Text>

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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name="arrow.down.circle.fill" size={18} color="#FAFAFA" />
                  <Text style={[s.primaryButtonText, { color: "#FAFAFA" }]}>Import Wallet</Text>
                </View>
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
        {/* Balance Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={[s.balanceHero, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
          <Text style={[s.balanceLabel, { color: colors.muted }]}>Total Balance</Text>
          <Text style={[s.balanceValue, { color: colors.foreground }]}>
            {totalValue}
          </Text>
          <Text style={[s.balanceUnit, { color: colors.muted }]}>ETH equivalent</Text>

          {/* Address Row */}
          <Pressable
            onPress={() => setShowFullAddress(!showFullAddress)}
            style={[s.addressPill, { backgroundColor: `${colors.foreground}06` }]}
          >
            <Text style={[s.addressText, { color: colors.muted }]}>
              {address ? (showFullAddress ? address : truncateAddr(address)) : ""}
            </Text>
            <Pressable
              onPress={handleCopyAddress}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol
                name={copied ? "checkmark.seal.fill" : "doc.on.doc.fill"}
                size={14}
                color={copied ? colors.success : colors.muted}
              />
            </Pressable>
          </Pressable>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.actionRow}>
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
              { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[s.actionIconCircle, { backgroundColor: `${colors.primary}15` }]}>
              <IconSymbol name="arrow.up.circle.fill" size={22} color={colors.primary} />
            </View>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>Send</Text>
          </Pressable>

          <Pressable
            onPress={handleCopyAddress}
            style={({ pressed }) => [
              s.actionButton,
              { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[s.actionIconCircle, { backgroundColor: `${colors.success}15` }]}>
              <IconSymbol name="arrow.down.circle.fill" size={22} color={colors.success} />
            </View>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>Receive</Text>
          </Pressable>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              s.actionButton,
              { backgroundColor: colors.surface, borderColor: `${colors.foreground}06`, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[s.actionIconCircle, { backgroundColor: `${colors.muted}15` }]}>
              <IconSymbol name="arrow.clockwise" size={22} color={colors.muted} />
            </View>
            <Text style={[s.actionLabel, { color: colors.foreground }]}>Refresh</Text>
          </Pressable>
        </Animated.View>

        {/* Token List */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Assets</Text>
        </Animated.View>

        {balances.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            {/* Skeleton loading */}
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
        ) : (
          balances.map((balance, idx) => (
            <Animated.View
              key={balance.chain.chainId}
              entering={FadeInDown.delay(300 + idx * 80).duration(400)}
              style={[s.tokenCard, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}
            >
              <View style={s.tokenCardLeft}>
                <ChainIcon name={balance.chain.name} size={40} />
                <View>
                  <Text style={[s.tokenName, { color: colors.foreground }]}>{balance.chain.name}</Text>
                  <Text style={[s.tokenSymbol, { color: colors.muted }]}>
                    {balance.chain.symbol}
                  </Text>
                </View>
              </View>
              <View style={s.tokenCardRight}>
                <Text style={[s.tokenBalance, { color: balance.error ? colors.error : colors.foreground }]}>
                  {balance.error ? "Error" : balance.balanceFormatted}
                </Text>
                <Text style={[s.tokenChain, { color: colors.muted }]}>
                  {balance.chain.name}
                </Text>
              </View>
            </Animated.View>
          ))
        )}

        {/* Transaction History */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)} style={{ marginTop: 24 }}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>
            Recent Activity
          </Text>
          <View style={[s.emptyState, { backgroundColor: colors.surface, borderColor: `${colors.foreground}06` }]}>
            <IconSymbol name="clock.fill" size={28} color={`${colors.muted}60`} />
            <Text style={[s.emptyTitle, { color: colors.muted }]}>No transactions yet</Text>
            <Text style={[s.emptySubtitle, { color: `${colors.muted}80` }]}>
              Your transaction history will appear here
            </Text>
          </View>
        </Animated.View>

        {/* Alpha Warning */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ marginTop: 20 }}>
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

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(800).duration(400)} style={s.dangerZone}>
          <View style={[s.dangerCard, { backgroundColor: `${colors.error}06`, borderColor: `${colors.error}15` }]}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 8, letterSpacing: 0.5 }}>DANGER ZONE</Text>
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
  // Ready / Main wallet — Balance Hero
  balanceHero: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 4,
  },
  balanceUnit: {
    fontSize: 13,
    fontWeight: "400",
    marginBottom: 8,
  },
  addressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  addressText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 13,
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
  tokenSymbol: {
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
  tokenChain: {
    fontSize: 11,
    marginTop: 2,
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
  // Danger zone
  dangerZone: {
    marginTop: 16,
    marginBottom: 20,
  },
  dangerCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
