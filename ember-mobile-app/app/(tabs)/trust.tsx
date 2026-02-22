import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  CHAINS,
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  ALL_CONTRACTS,
} from "@/constants/contracts";
import { checkAllChains, type RPCResult } from "@/lib/blockchain";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function TrustScoreScreen() {
  const colors = useColors();
  const [chainStatus, setChainStatus] = useState<Record<string, RPCResult>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [score, setScore] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await checkAllChains();
      setChainStatus(results);

      // Calculate trust score
      let s = 40; // Base score for 28 verified contracts
      if (results.base?.success) s += 25;
      if (results.avalanche?.success) s += 25;
      s += 10; // Protocol uptime bonus
      setScore(Math.min(100, s));
    } catch {
      setScore(40);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getScoreColor = () => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  const metrics = [
    {
      label: "Verified Contracts",
      value: ALL_CONTRACTS.length.toString(),
      icon: "shield.checkered" as const,
    },
    {
      label: "Active Chains",
      value: Object.values(chainStatus).filter((r) => r.success).length.toString() + " / 2",
      icon: "link" as const,
    },
    {
      label: "Base Contracts",
      value: BASE_CONTRACTS.length.toString(),
      icon: "flame.fill" as const,
    },
    {
      label: "Avalanche Contracts",
      value: AVALANCHE_CONTRACTS.length.toString(),
      icon: "flame.fill" as const,
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Trust Score</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Vaultfire Protocol Health
          </Text>
        </Animated.View>

        {/* Score Circle */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          style={styles.scoreContainer}
        >
          <View
            style={[
              styles.scoreCircle,
              {
                borderColor: getScoreColor(),
                backgroundColor: `${getScoreColor()}10`,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
                  {score}
                </Text>
                <Text style={[styles.scoreLabel, { color: colors.muted }]}>/ 100</Text>
              </>
            )}
          </View>
          <Text style={[styles.scoreDescription, { color: colors.muted }]}>
            {score >= 80
              ? "Excellent — All systems operational"
              : score >= 60
                ? "Good — Minor issues detected"
                : "Needs attention"}
          </Text>
        </Animated.View>

        {/* Metrics Grid */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Protocol Metrics
          </Text>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, idx) => (
              <View
                key={idx}
                style={[
                  styles.metricCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <IconSymbol name={metric.icon} size={20} color={colors.primary} />
                <Text style={[styles.metricValue, { color: colors.foreground }]}>
                  {metric.value}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.muted }]}>
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Chain Status */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Chain Status
          </Text>
          {(["base", "avalanche"] as const).map((chain) => {
            const result = chainStatus[chain];
            const isConnected = result?.success;
            return (
              <View
                key={chain}
                style={[
                  styles.chainCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isConnected ? colors.success : loading ? colors.border : colors.error,
                  },
                ]}
              >
                <View style={styles.chainHeader}>
                  <Text style={[styles.chainName, { color: colors.foreground }]}>
                    {chain === "base" ? "Base" : "Avalanche"}
                  </Text>
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
                        color: loading
                          ? colors.warning
                          : isConnected
                            ? colors.success
                            : colors.error,
                        fontSize: 11,
                        fontWeight: "600",
                      }}
                    >
                      {loading ? "Checking" : isConnected ? "Connected" : "Offline"}
                    </Text>
                  </View>
                </View>
                {isConnected && result && (
                  <View style={styles.chainStats}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Block #{result.blockNumber?.toLocaleString()} • {result.latency}ms
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { alignItems: "center", gap: 4, paddingVertical: 16 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14 },
  scoreContainer: { alignItems: "center", gap: 12, marginVertical: 20 },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreValue: { fontSize: 48, fontWeight: "800" },
  scoreLabel: { fontSize: 14, marginTop: -4 },
  scoreDescription: { fontSize: 13, textAlign: "center" },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, letterSpacing: -0.2 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    width: "47%",
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
  },
  metricValue: { fontSize: 20, fontWeight: "800" },
  metricLabel: { fontSize: 11, textAlign: "center" },
  chainCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chainName: { fontSize: 15, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  chainStats: { marginTop: 8 },
});
