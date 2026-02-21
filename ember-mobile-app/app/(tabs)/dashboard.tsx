import {
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Linking,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  CORE_VALUES,
  VAULTFIRE_WEBSITE,
} from "@/constants/contracts";
import { getMultipleContractStatus } from "@/lib/contract-reader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Pressable } from "react-native";

interface ChainHealth {
  chain: "base" | "avalanche";
  chainName: string;
  chainId: number;
  totalContracts: number;
  aliveContracts: number;
  healthPercentage: number;
  loading: boolean;
}

export default function DashboardScreen() {
  const colors = useColors();
  const [baseHealth, setBaseHealth] = useState<ChainHealth | null>(null);
  const [avaxHealth, setAvaxHealth] = useState<ChainHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setBaseHealth({ chain: "base", chainName: "Base", chainId: 8453, totalContracts: BASE_CONTRACTS.length, aliveContracts: 0, healthPercentage: 0, loading: true });
      setAvaxHealth({ chain: "avalanche", chainName: "Avalanche", chainId: 43114, totalContracts: AVALANCHE_CONTRACTS.length, aliveContracts: 0, healthPercentage: 0, loading: true });

      const baseAddresses = BASE_CONTRACTS.map((c) => c.address);
      const baseStatus = await getMultipleContractStatus("base", baseAddresses);
      const baseAlive = Object.values(baseStatus).filter(Boolean).length;
      setBaseHealth({ chain: "base", chainName: "Base", chainId: 8453, totalContracts: BASE_CONTRACTS.length, aliveContracts: baseAlive, healthPercentage: Math.round((baseAlive / BASE_CONTRACTS.length) * 100), loading: false });

      const avaxAddresses = AVALANCHE_CONTRACTS.map((c) => c.address);
      const avaxStatus = await getMultipleContractStatus("avalanche", avaxAddresses);
      const avaxAlive = Object.values(avaxStatus).filter(Boolean).length;
      setAvaxHealth({ chain: "avalanche", chainName: "Avalanche", chainId: 43114, totalContracts: AVALANCHE_CONTRACTS.length, aliveContracts: avaxAlive, healthPercentage: Math.round((avaxAlive / AVALANCHE_CONTRACTS.length) * 100), loading: false });
    } catch (error) {
      console.error("Dashboard load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const overallAlive = (baseHealth?.aliveContracts ?? 0) + (avaxHealth?.aliveContracts ?? 0);
  const overallTotal = (baseHealth?.totalContracts ?? 0) + (avaxHealth?.totalContracts ?? 0);
  const overallHealth = overallTotal > 0 ? Math.round((overallAlive / overallTotal) * 100) : 0;

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
            <IconSymbol name="chart.bar.fill" size={28} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Vaultfire Protocol Network Health
            </Text>
          </View>
        </Animated.View>

        {/* Overall Health Card */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <View style={[styles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.healthRow}>
              <View>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Network Health
                </Text>
                <Text style={{ color: colors.primary, fontSize: 36, fontWeight: "800", marginTop: 4 }}>
                  {overallHealth}%
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {overallAlive}/{overallTotal} contracts online
                </Text>
              </View>
              <View style={[styles.healthCircle, { backgroundColor: overallHealth > 80 ? colors.success : overallHealth > 50 ? colors.warning : colors.error }]}>
                <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700" }}>
                  {overallHealth > 80 ? "✓" : overallHealth > 50 ? "⚠" : "✗"}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${overallHealth}%`,
                    backgroundColor: overallHealth > 80 ? colors.success : overallHealth > 50 ? colors.warning : colors.error,
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Chain Health Cards */}
        <View style={styles.chainSection}>
          {[baseHealth, avaxHealth].map(
            (health, idx) =>
              health && (
                <Animated.View key={health.chain} entering={FadeInDown.delay(250 + idx * 100).duration(300)}>
                  <View style={[styles.chainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.chainCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                          {health.chainName}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                          Chain ID: {health.chainId}
                        </Text>
                      </View>
                      {health.loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <View
                          style={[
                            styles.healthBadge,
                            { backgroundColor: health.healthPercentage > 80 ? colors.success : colors.warning },
                          ]}
                        >
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                            {health.healthPercentage}%
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.progressTrack, { backgroundColor: colors.border, marginTop: 12 }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${health.healthPercentage}%`,
                            backgroundColor: health.healthPercentage > 80 ? colors.success : health.healthPercentage > 50 ? colors.warning : colors.error,
                          },
                        ]}
                      />
                    </View>

                    {/* Stats */}
                    <View style={[styles.chainStats, { borderTopColor: colors.border }]}>
                      <View style={styles.chainStatItem}>
                        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>
                          {health.aliveContracts}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>Online</Text>
                      </View>
                      <View style={[styles.chainStatDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.chainStatItem}>
                        <Text style={{ color: colors.error, fontSize: 18, fontWeight: "800" }}>
                          {health.totalContracts - health.aliveContracts}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>Offline</Text>
                      </View>
                      <View style={[styles.chainStatDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.chainStatItem}>
                        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>
                          {health.totalContracts}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>Total</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              )
          )}
        </View>

        {/* Core Values */}
        <Animated.View entering={FadeInDown.delay(500).duration(300)} style={{ marginTop: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Core Values</Text>
          <View style={[styles.valuesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.valuesIconBg, { backgroundColor: `${colors.primary}15` }]}>
              <IconSymbol name="flame.fill" size={20} color={colors.primary} />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", lineHeight: 21, flex: 1 }}>
              {CORE_VALUES}
            </Text>
          </View>
        </Animated.View>

        {/* Protocol Info */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)} style={{ marginTop: 16 }}>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              The Vaultfire Protocol is deployed across {BASE_CONTRACTS.length} contracts on Base and {AVALANCHE_CONTRACTS.length} contracts on Avalanche, implementing the ERC-8004 standard for ethical AI governance. All contract health data is fetched live via JSON-RPC.
            </Text>
          </View>
        </Animated.View>

        {/* Website */}
        <Animated.View entering={FadeInDown.delay(700).duration(300)}>
          <Pressable
            onPress={() => Linking.openURL(VAULTFIRE_WEBSITE)}
            style={({ pressed }) => [styles.websiteLink, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>theloopbreaker.com</Text>
            <IconSymbol name="chevron.right" size={12} color={colors.primary} />
          </Pressable>
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
  healthCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  healthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  healthCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  chainSection: { marginTop: 20, gap: 12 },
  chainCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  chainCardHeader: { flexDirection: "row", alignItems: "center" },
  healthBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chainStats: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 0.5 },
  chainStatItem: { flex: 1, alignItems: "center" },
  chainStatDivider: { width: 0.5, height: "100%" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, letterSpacing: -0.2 },
  valuesCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  valuesIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  infoCard: { padding: 12, borderRadius: 10, borderWidth: 1 },
  websiteLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 16, paddingVertical: 12 },
});
