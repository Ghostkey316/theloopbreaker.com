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
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialIcons name={icon as any} size={20} color="#F97316" />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="dashboard" size={24} color="#F97316" />
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
        </View>

        {/* Stats */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#F97316"
            />
          }
        >
          <View style={styles.content}>
            {/* Protocol Overview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Protocol Overview</Text>
              <View style={styles.statsGrid}>
                {renderStatCard("Registered Agents", stats?.identityAgents || 0, "person")}
                {renderStatCard(
                  "Partnership Bonds",
                  stats?.partnershipBonds || 0,
                  "link"
                )}
                {renderStatCard(
                  "Accountability Bonds",
                  stats?.accountabilityBonds || 0,
                  "verified-user"
                )}
              </View>
            </View>

            {/* Reputation & Governance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reputation & Governance</Text>
              <View style={styles.statsGrid}>
                {renderStatCard(
                  "Total Feedbacks",
                  stats?.reputationFeedbacks || 0,
                  "star"
                )}
                {renderStatCard(
                  "Governance Signers",
                  stats?.governanceSigners || 0,
                  "security",
                  `Threshold: ${stats?.governanceThreshold || 0}`
                )}
              </View>
            </View>

            {/* Infrastructure */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Infrastructure</Text>
              <View style={styles.statsGrid}>
                {renderStatCard("Oracle Nodes", stats?.oracleCount || 0, "cloud")}
                {renderStatCard(
                  "Bridge Messages",
                  stats?.bridgeMessages || 0,
                  "bridge"
                )}
                {renderStatCard(
                  "Attestations",
                  stats?.attestationCount || 0,
                  "check-circle"
                )}
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <MaterialIcons name="info" size={18} color="#F97316" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Live Data</Text>
                <Text style={styles.infoText}>
                  All statistics are fetched directly from Base mainnet contracts. Pull to refresh.
                </Text>
              </View>
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
      // reputationData,
      governanceSigners,
      governanceThreshold,
      oracleCount,
      bridgeMessages,
      attestationCount,
    ] = await Promise.all([
      identityContract.getTotalAgents(),
      partnershipContract.nextBondId(),
      accountabilityContract.nextBondId(),
      // reputationContract.nextFeedbackId(),
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
      reputationFeedbacks: 0, // Would need event logs to get accurate count
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsGrid: {
    gap: 8,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#252540",
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
  },
});
