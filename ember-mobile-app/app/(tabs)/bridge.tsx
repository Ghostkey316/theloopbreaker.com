import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";
import { getTeleporterBridgeStats } from "@/lib/contract-reader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Animated, { FadeInDown } from "react-native-reanimated";

interface BridgeStatus {
  chain: "base" | "avalanche";
  chainName: string;
  chainId: number;
  isAlive: boolean;
  messageCount: number | null;
  nonce: number | null;
  paused: boolean | null;
  loading: boolean;
}

export default function BridgeScreen() {
  const colors = useColors();
  const [baseStatus, setBaseStatus] = useState<BridgeStatus | null>(null);
  const [avaxStatus, setAvaxStatus] = useState<BridgeStatus | null>(null);
  const [selectedChain, setSelectedChain] = useState<"base" | "avalanche">("base");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const baseBridge = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
  const avaxBridge = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");

  const loadBridgeStatus = useCallback(async () => {
    try {
      setLoading(true);
      const initBase: BridgeStatus = { chain: "base", chainName: "Base", chainId: 8453, isAlive: false, messageCount: null, nonce: null, paused: null, loading: true };
      const initAvax: BridgeStatus = { chain: "avalanche", chainName: "Avalanche", chainId: 43114, isAlive: false, messageCount: null, nonce: null, paused: null, loading: true };
      setBaseStatus(initBase);
      setAvaxStatus(initAvax);

      if (baseBridge && avaxBridge) {
        const [baseStats, avaxStats] = await Promise.all([
          getTeleporterBridgeStats("base", baseBridge.address),
          getTeleporterBridgeStats("avalanche", avaxBridge.address),
        ]);
        setBaseStatus({ ...initBase, isAlive: baseStats.isAlive, messageCount: baseStats.messageCount, nonce: baseStats.nonce, paused: baseStats.paused, loading: false });
        setAvaxStatus({ ...initAvax, isAlive: avaxStats.isAlive, messageCount: avaxStats.messageCount, nonce: avaxStats.nonce, paused: avaxStats.paused, loading: false });
      }
    } catch (error) {
      console.error("Bridge status check failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseBridge, avaxBridge]);

  useEffect(() => { loadBridgeStatus(); }, [loadBridgeStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBridgeStatus();
  };

  const currentStatus = selectedChain === "base" ? baseStatus : avaxStatus;

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View style={styles.headerSection}>
            <IconSymbol name="arrow.left.arrow.right" size={28} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Cross-Chain Bridge</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Vaultfire Teleporter Bridge Status
            </Text>
          </View>
        </Animated.View>

        {/* Chain Selector */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View style={[styles.chainSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(["base", "avalanche"] as const).map((chain) => (
              <Pressable
                key={chain}
                onPress={() => setSelectedChain(chain)}
                style={({ pressed }) => [
                  styles.chainTab,
                  {
                    backgroundColor: selectedChain === chain ? colors.primary : "transparent",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedChain === chain ? "#FFFFFF" : colors.muted,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  {chain === "base" ? "Base" : "Avalanche"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Bridge Status */}
        {loading && !currentStatus ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.muted, marginTop: 12, fontSize: 13 }}>
              Checking bridge status...
            </Text>
          </View>
        ) : currentStatus ? (
          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <View
              style={[
                styles.mainCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: currentStatus.isAlive ? colors.success : colors.error,
                },
              ]}
            >
              {/* Status Header */}
              <View style={styles.mainCardHeader}>
                <View>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Bridge Status
                  </Text>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                    {currentStatus.chainName} Bridge
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusCircle,
                    { backgroundColor: currentStatus.isAlive ? colors.success : colors.error },
                  ]}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>
                    {currentStatus.isAlive ? "✓" : "✗"}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}>
                    {currentStatus.messageCount !== null ? currentStatus.messageCount.toLocaleString() : "—"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>Messages</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}>
                    {currentStatus.paused !== null ? (currentStatus.paused ? "Paused" : "Active") : "—"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>Status</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}>
                    {currentStatus.chainId}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>Chain ID</Text>
                </View>
              </View>

              {/* Status Indicator */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDotSmall,
                    { backgroundColor: currentStatus.isAlive ? colors.success : colors.error },
                  ]}
                />
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {currentStatus.isAlive
                    ? "Bridge is operational and relaying messages"
                    : "Bridge is currently offline"}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* Network Overview */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)} style={styles.overviewSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Network Overview</Text>
          {[baseStatus, avaxStatus].map(
            (status) =>
              status && (
                <View
                  key={status.chain}
                  style={[
                    styles.miniCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.miniCardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                        {status.chainName}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {status.loading ? "Checking..." : status.messageCount !== null ? `${status.messageCount.toLocaleString()} messages relayed` : status.isAlive ? "Deployed & operational" : "Offline"}
                      </Text>
                    </View>
                    {status.loading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: status.isAlive ? `${colors.success}20` : `${colors.error}20` },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDotTiny,
                            { backgroundColor: status.isAlive ? colors.success : colors.error },
                          ]}
                        />
                        <Text
                          style={{
                            color: status.isAlive ? colors.success : colors.error,
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {status.isAlive ? "Online" : "Offline"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )
          )}
        </Animated.View>

        {/* Bridge Diagram */}
        <Animated.View entering={FadeInDown.delay(500).duration(300)} style={{ marginTop: 20 }}>
          <View style={[styles.diagramCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.diagramRow}>
              <View style={styles.diagramNode}>
                <View style={[styles.diagramCircle, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={{ fontSize: 16 }}>🔵</Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "600", marginTop: 4 }}>Base</Text>
              </View>
              <View style={styles.diagramArrow}>
                <View style={[styles.diagramLine, { backgroundColor: colors.primary }]} />
                <IconSymbol name="arrow.left.arrow.right" size={16} color={colors.primary} />
                <View style={[styles.diagramLine, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.diagramNode}>
                <View style={[styles.diagramCircle, { backgroundColor: `${colors.error}20` }]}>
                  <Text style={{ fontSize: 16 }}>🔺</Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "600", marginTop: 4 }}>Avalanche</Text>
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 16 }}>
              Teleporter Bridge enables secure cross-chain messaging between Base and Avalanche networks.
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  headerSection: { alignItems: "center", gap: 6, paddingVertical: 16 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 13 },
  chainSelector: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    marginBottom: 16,
  },
  chainTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  mainCard: { padding: 16, borderRadius: 14, borderWidth: 2 },
  mainCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statusCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", paddingTop: 14, borderTopWidth: 0.5, marginBottom: 14 },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 0.5, height: "100%" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4 },
  overviewSection: { marginTop: 24, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4, letterSpacing: -0.2 },
  miniCard: { padding: 14, borderRadius: 10, borderWidth: 1 },
  miniCardRow: { flexDirection: "row", alignItems: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDotTiny: { width: 6, height: 6, borderRadius: 3 },
  diagramCard: { padding: 20, borderRadius: 14, borderWidth: 1 },
  diagramRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  diagramNode: { alignItems: "center" },
  diagramCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  diagramArrow: { flexDirection: "row", alignItems: "center", gap: 4, marginHorizontal: 12 },
  diagramLine: { width: 24, height: 2, borderRadius: 1 },
});
