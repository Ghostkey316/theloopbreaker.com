import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Linking,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  CHAINS,
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  CORE_VALUES,
  VAULTFIRE_WEBSITE,
} from "@/constants/contracts";
import { checkChainConnectivity, type RPCResult } from "@/lib/blockchain";
import Animated, { FadeInDown } from "react-native-reanimated";

function NetworkCard({
  label,
  chainId,
  result,
  loading,
  contractCount,
  delay,
}: {
  label: string;
  chainId: number;
  result: RPCResult | null;
  loading: boolean;
  contractCount: number;
  delay: number;
}) {
  const colors = useColors();
  const isConnected = !loading && result?.success;
  const borderColor = loading ? colors.border : isConnected ? colors.success : colors.error;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor, borderLeftWidth: 3 }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.cardMeta, { color: colors.muted }]}>Chain ID: {chainId}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: loading
                  ? `${colors.warning}20`
                  : isConnected
                    ? `${colors.success}20`
                    : `${colors.error}20`,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.success : colors.error },
                ]}
              />
            )}
            <Text
              style={{
                color: loading ? colors.warning : isConnected ? colors.success : colors.error,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {loading ? "Checking" : isConnected ? "Connected" : "Offline"}
            </Text>
          </View>
        </View>
        {isConnected && result && (
          <View style={styles.cardStats}>
            <View style={styles.cardStat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                #{result.blockNumber?.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Block</Text>
            </View>
            <View style={[styles.cardStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.cardStat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{result.latency}ms</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Latency</Text>
            </View>
            <View style={[styles.cardStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.cardStat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{contractCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Contracts</Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [baseResult, setBaseResult] = useState<RPCResult | null>(null);
  const [avaxResult, setAvaxResult] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkNetworks = useCallback(async () => {
    setLoading(true);
    try {
      const [base, avax] = await Promise.all([
        checkChainConnectivity("base"),
        checkChainConnectivity("avalanche"),
      ]);
      setBaseResult(base);
      setAvaxResult(avax);
    } catch (error) {
      console.error("Network check failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkNetworks();
  }, [checkNetworks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    checkNetworks();
  }, [checkNetworks]);

  const quickActions = [
    { icon: "bubble.left.fill" as const, label: "Chat with Ember", route: "/chat" as const },
    { icon: "shield.checkered" as const, label: "Trust Verification", route: "/verify" as const },
    { icon: "arrow.left.arrow.right" as const, label: "Cross-Chain Bridge", route: "/bridge" as const },
    { icon: "chart.bar.fill" as const, label: "Dashboard", route: "/dashboard" as const },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.heroSection}>
          <View style={[styles.heroIconBg, { backgroundColor: `${colors.primary}15` }]}>
            <IconSymbol name="flame.fill" size={44} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Vaultfire Protocol</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>Powered by Ember AI</Text>
          <Text style={[styles.coreValues, { color: colors.muted }]}>{CORE_VALUES}</Text>
        </Animated.View>

        {/* Network Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Network Status</Text>
          <NetworkCard
            label="Base"
            chainId={CHAINS.base.chainId}
            result={baseResult}
            loading={loading}
            contractCount={BASE_CONTRACTS.length}
            delay={150}
          />
          <View style={{ height: 10 }} />
          <NetworkCard
            label="Avalanche"
            chainId={CHAINS.avalanche.chainId}
            result={avaxResult}
            loading={loading}
            contractCount={AVALANCHE_CONTRACTS.length}
            delay={250}
          />
        </View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.delay(350).duration(300)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Protocol Overview</Text>
          <View style={styles.statsRow}>
            {[
              { value: "28", label: "Contracts" },
              { value: "2", label: "Chains" },
              { value: "ERC-8004", label: "Standard" },
            ].map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statCardValue, { color: colors.primary }]}>{stat.value}</Text>
                <Text style={[styles.statCardLabel, { color: colors.muted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(450).duration(300)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, idx) => (
              <Pressable
                key={idx}
                onPress={() => router.push(action.route)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: pressed ? colors.primary : colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <IconSymbol name={action.icon} size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Website Link */}
        <Animated.View entering={FadeInDown.delay(550).duration(300)}>
          <Pressable
            onPress={() => Linking.openURL(VAULTFIRE_WEBSITE)}
            style={({ pressed }) => [
              styles.websiteLink,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.websiteLinkText, { color: colors.primary }]}>theloopbreaker.com</Text>
            <IconSymbol name="chevron.right" size={14} color={colors.primary} />
          </Pressable>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  heroSection: { alignItems: "center", gap: 8, paddingVertical: 20 },
  heroIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: "600" },
  coreValues: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
    fontStyle: "italic",
    paddingHorizontal: 16,
  },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, letterSpacing: -0.2 },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  cardStats: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  cardStat: { flex: 1, alignItems: "center" },
  cardStatDivider: { width: 0.5, height: "100%" },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  statCardValue: { fontSize: 18, fontWeight: "800" },
  statCardLabel: { fontSize: 10, marginTop: 4 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    width: "48%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    flexGrow: 1,
    flexBasis: "45%",
  },
  actionLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  websiteLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 20,
    paddingVertical: 12,
  },
  websiteLinkText: { fontSize: 14, fontWeight: "600" },
});
