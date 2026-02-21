import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
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

function NetworkCard({
  chain,
  label,
  chainId,
  result,
  loading,
  contractCount,
}: {
  chain: string;
  label: string;
  chainId: number;
  result: RPCResult | null;
  loading: boolean;
  contractCount: number;
}) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <IconSymbol name="link" size={18} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{label}</Text>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: loading
                ? colors.warning
                : result?.success
                  ? colors.success
                  : colors.error,
            },
          ]}
        />
      </View>
      <Text style={[styles.cardSubtext, { color: colors.muted }]}>Chain ID: {chainId}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
      ) : result?.success ? (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.cardSubtext, { color: colors.success }]}>
            Connected — Block #{result.blockNumber?.toLocaleString()}
          </Text>
          <Text style={[styles.cardSubtext, { color: colors.muted }]}>
            Latency: {result.latency}ms
          </Text>
        </View>
      ) : (
        <Text style={[styles.cardSubtext, { color: colors.error, marginTop: 8 }]}>
          {result?.error || "Not connected"}
        </Text>
      )}
      <Text style={[styles.cardSubtext, { color: colors.muted, marginTop: 4 }]}>
        {contractCount} contracts deployed
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [baseResult, setBaseResult] = useState<RPCResult | null>(null);
  const [avaxResult, setAvaxResult] = useState<RPCResult | null>(null);
  const [loading, setLoading] = useState(true);

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
    }
  }, []);

  useEffect(() => {
    checkNetworks();
  }, [checkNetworks]);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <IconSymbol name="flame.fill" size={48} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Vaultfire Protocol</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>Powered by Ember AI</Text>
          <Text style={[styles.coreValues, { color: colors.muted }]}>{CORE_VALUES}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Network Status</Text>
          <NetworkCard
            chain="base"
            label="Base"
            chainId={CHAINS.base.chainId}
            result={baseResult}
            loading={loading}
            contractCount={BASE_CONTRACTS.length}
          />
          <NetworkCard
            chain="avalanche"
            label="Avalanche"
            chainId={CHAINS.avalanche.chainId}
            result={avaxResult}
            loading={loading}
            contractCount={AVALANCHE_CONTRACTS.length}
          />
          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.border }]}
            onPress={checkNetworks}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Refresh Networks</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>28</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total Contracts</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>2</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Active Chains</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>ERC-8004</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Standard</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/chat")}
            >
              <IconSymbol name="bubble.left.fill" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Chat with Ember</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/verify")}
            >
              <IconSymbol name="shield.checkered" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Verify Contracts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/bridge")}
            >
              <IconSymbol name="arrow.left.arrow.right" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Cross-Chain Bridge</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push("/dashboard")}
            >
              <IconSymbol name="chart.bar.fill" size={24} color={colors.primary} />
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.websiteLink}
          onPress={() => Linking.openURL(VAULTFIRE_WEBSITE)}
        >
          <Text style={[styles.websiteLinkText, { color: colors.primary }]}>
            theloopbreaker.com
          </Text>
          <IconSymbol name="chevron.right" size={16} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  heroSection: { alignItems: "center", gap: 8, paddingVertical: 24 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 16, fontWeight: "600" },
  coreValues: { fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 8, fontStyle: "italic" },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardSubtext: { fontSize: 13, marginTop: 2 },
  refreshBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  statNumber: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: "center" },
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
  actionLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  websiteLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 24,
    paddingVertical: 12,
  },
  websiteLinkText: { fontSize: 15, fontWeight: "600" },
});
