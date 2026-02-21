import { ScrollView, Text, View, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";
import { getMultipleContractStatus } from "@/lib/contract-reader";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ContractStatus {
  name: string;
  address: string;
  alive: boolean;
  loading: boolean;
}

export default function VerifyScreen() {
  const colors = useColors();
  const [baseContracts, setBaseContracts] = useState<ContractStatus[]>([]);
  const [avaxContracts, setAvaxContracts] = useState<ContractStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<"base" | "avalanche">("base");
  const [refreshing, setRefreshing] = useState(false);

  const loadContractStatus = async () => {
    try {
      setLoading(true);
      const baseInit = BASE_CONTRACTS.map((c) => ({ name: c.name, address: c.address, alive: false, loading: true }));
      const avaxInit = AVALANCHE_CONTRACTS.map((c) => ({ name: c.name, address: c.address, alive: false, loading: true }));
      setBaseContracts(baseInit);
      setAvaxContracts(avaxInit);

      const baseAddresses = BASE_CONTRACTS.map((c) => c.address);
      const baseStatus = await getMultipleContractStatus("base", baseAddresses);
      setBaseContracts(BASE_CONTRACTS.map((c) => ({ name: c.name, address: c.address, alive: baseStatus[c.address] ?? false, loading: false })));

      const avaxAddresses = AVALANCHE_CONTRACTS.map((c) => c.address);
      const avaxStatus = await getMultipleContractStatus("avalanche", avaxAddresses);
      setAvaxContracts(AVALANCHE_CONTRACTS.map((c) => ({ name: c.name, address: c.address, alive: avaxStatus[c.address] ?? false, loading: false })));
    } catch (error) {
      console.error("Failed to load contract status:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadContractStatus(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContractStatus();
  };

  const contracts = selectedChain === "base" ? baseContracts : avaxContracts;
  const aliveCount = contracts.filter((c) => c.alive).length;
  const totalCount = contracts.length;
  const pct = totalCount > 0 ? Math.round((aliveCount / totalCount) * 100) : 0;

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
            <IconSymbol name="shield.checkered" size={28} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Trust Verification</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Live on-chain contract verification
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
                  {chain === "base" ? "Base (8453)" : "Avalanche (43114)"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Summary Card */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Contracts Verified
                </Text>
                <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800", marginTop: 4 }}>
                  {aliveCount}/{totalCount}
                </Text>
              </View>
              <View style={[styles.percentCircle, { backgroundColor: pct === 100 ? colors.success : colors.primary }]}>
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>{pct}%</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Contract List */}
        <View style={styles.contractList}>
          {loading && contracts.every((c) => c.loading) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, marginTop: 12, fontSize: 13 }}>
                Verifying contracts on-chain...
              </Text>
            </View>
          ) : (
            contracts.map((contract, idx) => (
              <Animated.View key={contract.address} entering={FadeInDown.delay(300 + idx * 40).duration(250)}>
                <View
                  style={[
                    styles.contractCard,
                    {
                      backgroundColor: colors.surface,
                      borderLeftColor: contract.loading
                        ? colors.warning
                        : contract.alive
                          ? colors.success
                          : colors.error,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {contract.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3, fontFamily: "monospace" }}>
                      {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
                    </Text>
                  </View>
                  <View style={styles.contractStatus}>
                    {contract.loading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: contract.alive
                              ? `${colors.success}20`
                              : `${colors.error}20`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDotSmall,
                            { backgroundColor: contract.alive ? colors.success : colors.error },
                          ]}
                        />
                        <Text
                          style={{
                            color: contract.alive ? colors.success : colors.error,
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {contract.alive ? "Live" : "Offline"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Animated.View>
            ))
          )}
        </View>

        {/* Footer */}
        <Animated.View entering={FadeInDown.delay(600).duration(300)} style={styles.footer}>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              Verification checks for deployed bytecode at each contract address via JSON-RPC eth_getCode calls. Green status indicates the contract is deployed and callable.
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
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  percentCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  contractList: { gap: 8 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  contractCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  contractStatus: { marginLeft: 8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  footer: { marginTop: 20 },
  infoCard: { padding: 12, borderRadius: 10, borderWidth: 1 },
});
