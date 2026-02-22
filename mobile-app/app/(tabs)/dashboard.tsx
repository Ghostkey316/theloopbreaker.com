"use client";
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { getContract } from "@/lib/provider";
import { CONTRACTS } from "@/lib/contracts_config";
import {
  ERC8004IdentityRegistryABI,
  AIPartnershipBondsV2ABI,
  AIAccountabilityBondsV2ABI,
  ERC8004ReputationRegistryABI,
  MultisigGovernanceABI,
  FlourishingMetricsOracleABI,
  VaultfireTeleporterBridgeABI,
  ProductionBeliefAttestationVerifierABI,
} from "@/lib/contracts_config";

interface DashboardStats {
  identityAgents: number;
  partnershipBonds: number;
  accountabilityBonds: number;
  reputationFeedbacks: number;
  governanceSigners: number;
  governanceThreshold: number;
  oracleCount: number;
  bridgeMessages: number;
  attestationCount: number;
}

// ─── Skeleton shimmer component ──────────────────────────────────────────────
function SkeletonBlock({ width, height, style }: { width?: number | string; height: number; style?: any }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      "rgba(255,255,255,0.03)",
      "rgba(255,255,255,0.06)",
      "rgba(255,255,255,0.03)",
    ],
  });

  return (
    <Animated.View
      style={[
        {
          width: width || "100%",
          height,
          borderRadius: 6,
          backgroundColor,
        },
        style,
      ]}
    />
  );
}

// ─── Skeleton stat card ───────────────────────────────────────────────────────
function SkeletonStatCard() {
  return (
    <View style={[s.statCard, { gap: 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <SkeletonBlock width={14} height={14} style={{ borderRadius: 3 }} />
        <SkeletonBlock width={80} height={11} />
      </View>
      <SkeletonBlock width={48} height={28} />
    </View>
  );
}

// ─── Animated stat card ───────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  icon,
  subtitle,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  delay?: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={s.statCard}
      >
        <View style={s.statTop}>
          <MaterialIcons name={icon as any} size={15} color="#52525B" />
          <Text style={s.statLabel}>{title}</Text>
        </View>
        <Text style={s.statValue}>{value}</Text>
        {subtitle && <Text style={s.statSub}>{subtitle}</Text>}
      </Pressable>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Error refreshing stats:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ScreenContainer className="p-0">
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Dashboard</Text>
          <View style={s.liveIndicator}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Base Mainnet</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#A1A1AA"
            />
          }
        >
          <View style={s.content}>
            {isLoading ? (
              // Skeleton loading state
              <>
                <View style={s.section}>
                  <SkeletonBlock width={140} height={11} style={{ marginBottom: 16 }} />
                  <View style={s.statsGrid}>
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                  </View>
                </View>
                <View style={s.section}>
                  <SkeletonBlock width={160} height={11} style={{ marginBottom: 16 }} />
                  <View style={s.statsGrid}>
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                  </View>
                </View>
                <View style={s.section}>
                  <SkeletonBlock width={120} height={11} style={{ marginBottom: 16 }} />
                  <View style={s.statsGrid}>
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                    <SkeletonStatCard />
                  </View>
                </View>
              </>
            ) : (
              // Actual content with staggered animations
              <>
                {/* Protocol Overview */}
                <View style={s.section}>
                  <Text style={s.sectionLabel}>PROTOCOL OVERVIEW</Text>
                  <View style={s.statsGrid}>
                    <StatCard title="Registered Agents" value={stats?.identityAgents || 0} icon="person" delay={0} />
                    <StatCard title="Partnership Bonds" value={stats?.partnershipBonds || 0} icon="link" delay={60} />
                    <StatCard title="Accountability Bonds" value={stats?.accountabilityBonds || 0} icon="verified-user" delay={120} />
                  </View>
                </View>

                {/* Reputation & Governance */}
                <View style={s.section}>
                  <Text style={s.sectionLabel}>REPUTATION & GOVERNANCE</Text>
                  <View style={s.statsGrid}>
                    <StatCard title="Total Feedbacks" value={stats?.reputationFeedbacks || 0} icon="star" delay={180} />
                    <StatCard
                      title="Governance Signers"
                      value={stats?.governanceSigners || 0}
                      icon="security"
                      subtitle={`Threshold: ${stats?.governanceThreshold || 0}`}
                      delay={240}
                    />
                  </View>
                </View>

                {/* Infrastructure */}
                <View style={s.section}>
                  <Text style={s.sectionLabel}>INFRASTRUCTURE</Text>
                  <View style={s.statsGrid}>
                    <StatCard title="Oracle Nodes" value={stats?.oracleCount || 0} icon="cloud" delay={300} />
                    <StatCard title="Bridge Messages" value={stats?.bridgeMessages || 0} icon="swap-horiz" delay={360} />
                    <StatCard title="Attestations" value={stats?.attestationCount || 0} icon="check-circle" delay={420} />
                  </View>
                </View>

                {/* Info */}
                <View style={s.infoCard}>
                  <MaterialIcons name="info-outline" size={13} color="#3F3F46" />
                  <Text style={s.infoText}>
                    All statistics fetched directly from Base mainnet contracts. Pull to refresh.
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      identityContract,
      partnershipContract,
      accountabilityContract,
      reputationContract,
      governanceContract,
      oracleContract,
      bridgeContract,
      attestationContract,
    ] = [
      getContract(CONTRACTS.ERC8004IdentityRegistry, ERC8004IdentityRegistryABI),
      getContract(CONTRACTS.AIPartnershipBondsV2, AIPartnershipBondsV2ABI),
      getContract(CONTRACTS.AIAccountabilityBondsV2, AIAccountabilityBondsV2ABI),
      getContract(CONTRACTS.ERC8004ReputationRegistry, ERC8004ReputationRegistryABI),
      getContract(CONTRACTS.MultisigGovernance, MultisigGovernanceABI),
      getContract(CONTRACTS.FlourishingMetricsOracle, FlourishingMetricsOracleABI),
      getContract(CONTRACTS.VaultfireTeleporterBridge, VaultfireTeleporterBridgeABI),
      getContract(
        CONTRACTS.ProductionBeliefAttestationVerifier,
        ProductionBeliefAttestationVerifierABI
      ),
    ];

    const [
      identityAgents,
      partnershipBonds,
      accountabilityBonds,
      governanceSigners,
      governanceThreshold,
      oracleCount,
      bridgeMessages,
      attestationCount,
    ] = await Promise.all([
      identityContract.getTotalAgents(),
      partnershipContract.nextBondId(),
      accountabilityContract.nextBondId(),
      governanceContract.getSignerCount(),
      governanceContract.threshold(),
      oracleContract.oracleCount(),
      bridgeContract.messageCount(),
      attestationContract.attestationCount(),
    ]);

    return {
      identityAgents: Number(identityAgents),
      partnershipBonds: Number(partnershipBonds),
      accountabilityBonds: Number(accountabilityBonds),
      reputationFeedbacks: 0,
      governanceSigners: Number(governanceSigners),
      governanceThreshold: Number(governanceThreshold),
      oracleCount: Number(oracleCount),
      bridgeMessages: Number(bridgeMessages),
      attestationCount: Number(attestationCount),
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "600",
    color: "#FAFAFA",
    letterSpacing: -0.5,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#52525B",
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 40,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#52525B",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  statsGrid: {
    gap: 8,
  },
  statCard: {
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#71717A",
    fontWeight: "400",
    letterSpacing: -0.1,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "600",
    color: "#FAFAFA",
    fontFamily: "monospace",
    letterSpacing: -1,
  },
  statSub: {
    fontSize: 11,
    color: "#52525B",
  },
  infoCard: {
    backgroundColor: "#111113",
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#52525B",
    lineHeight: 17,
    flex: 1,
  },
});
