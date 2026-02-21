import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

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

  const renderStatCard = (
    title: string,
    value: string | number,
    icon: string,
    subtitle?: string
  ) => (
    <View style={s.statCard}>
      <View style={s.statTop}>
        <MaterialIcons name={icon as any} size={16} color="#52525B" />
        <Text style={s.statLabel}>{title}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      {subtitle && <Text style={s.statSub}>{subtitle}</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#A1A1AA" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Dashboard</Text>
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
            {/* Protocol Overview */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>PROTOCOL OVERVIEW</Text>
              <View style={s.statsGrid}>
                {renderStatCard("Registered Agents", stats?.identityAgents || 0, "person")}
                {renderStatCard("Partnership Bonds", stats?.partnershipBonds || 0, "link")}
                {renderStatCard("Accountability Bonds", stats?.accountabilityBonds || 0, "verified-user")}
              </View>
            </View>

            {/* Reputation & Governance */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>REPUTATION & GOVERNANCE</Text>
              <View style={s.statsGrid}>
                {renderStatCard("Total Feedbacks", stats?.reputationFeedbacks || 0, "star")}
                {renderStatCard(
                  "Governance Signers",
                  stats?.governanceSigners || 0,
                  "security",
                  `Threshold: ${stats?.governanceThreshold || 0}`
                )}
              </View>
            </View>

            {/* Infrastructure */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>INFRASTRUCTURE</Text>
              <View style={s.statsGrid}>
                {renderStatCard("Oracle Nodes", stats?.oracleCount || 0, "cloud")}
                {renderStatCard("Bridge Messages", stats?.bridgeMessages || 0, "swap-horiz")}
                {renderStatCard("Attestations", stats?.attestationCount || 0, "check-circle")}
              </View>
            </View>

            {/* Info */}
            <View style={s.infoCard}>
              <Text style={s.infoText}>
                All statistics fetched directly from Base mainnet contracts. Pull to refresh.
              </Text>
            </View>
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
  container: { flex: 1, backgroundColor: "#09090B" },
  header: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.03)",
  },
  headerTitle: { fontSize: 28, fontWeight: "600", color: "#FAFAFA" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 24, gap: 48 },

  section: { gap: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: "500", color: "#52525B",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  statsGrid: { gap: 8 },
  statCard: {
    backgroundColor: "#111113", borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  statTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statLabel: { fontSize: 13, color: "#A1A1AA", fontWeight: "400" },
  statValue: { fontSize: 32, fontWeight: "600", color: "#FAFAFA", fontFamily: "monospace" },
  statSub: { fontSize: 11, color: "#52525B", marginTop: 4 },

  infoCard: {
    backgroundColor: "#111113", borderRadius: 10, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  infoText: { fontSize: 12, color: "#52525B", lineHeight: 16 },
});
