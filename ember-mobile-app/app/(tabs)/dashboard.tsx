import {
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  CORE_VALUES,
} from "@/constants/contracts";
import { getMultipleContractStatus } from "@/lib/contract-reader";
import Animated, { FadeInDown } from "react-native-reanimated";

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

      // Initialize loading states
      setBaseHealth({
        chain: "base",
        chainName: "Base",
        chainId: 8453,
        totalContracts: BASE_CONTRACTS.length,
        aliveContracts: 0,
        healthPercentage: 0,
        loading: true,
      });
      setAvaxHealth({
        chain: "avalanche",
        chainName: "Avalanche",
        chainId: 43114,
        totalContracts: AVALANCHE_CONTRACTS.length,
        aliveContracts: 0,
        healthPercentage: 0,
        loading: true,
      });

      // Check Base contracts
      const baseAddresses = BASE_CONTRACTS.map((c) => c.address);
      const baseStatus = await getMultipleContractStatus("base", baseAddresses);
      const baseAlive = Object.values(baseStatus).filter(Boolean).length;
      setBaseHealth({
        chain: "base",
        chainName: "Base",
        chainId: 8453,
        totalContracts: BASE_CONTRACTS.length,
        aliveContracts: baseAlive,
        healthPercentage: Math.round((baseAlive / BASE_CONTRACTS.length) * 100),
        loading: false,
      });

      // Check Avalanche contracts
      const avaxAddresses = AVALANCHE_CONTRACTS.map((c) => c.address);
      const avaxStatus = await getMultipleContractStatus("avalanche", avaxAddresses);
      const avaxAlive = Object.values(avaxStatus).filter(Boolean).length;
      setAvaxHealth({
        chain: "avalanche",
        chainName: "Avalanche",
        chainId: 43114,
        totalContracts: AVALANCHE_CONTRACTS.length,
        aliveContracts: avaxAlive,
        healthPercentage: Math.round((avaxAlive / AVALANCHE_CONTRACTS.length) * 100),
        loading: false,
      });
    } catch (error) {
      console.error("Dashboard load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const overallHealth =
    baseHealth && avaxHealth
      ? Math.round(
          ((baseHealth.aliveContracts + avaxHealth.aliveContracts) /
            (baseHealth.totalContracts + avaxHealth.totalContracts)) *
            100
        )
      : 0;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground mb-2">Dashboard</Text>
            <Text className="text-sm text-muted">Vaultfire Protocol Network Status</Text>
          </View>

          {/* Overall Health */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={[
              styles.healthCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Overall Network Health</Text>
                <Text style={{ color: colors.primary, fontSize: 32, fontWeight: "bold", marginTop: 8 }}>
                  {overallHealth}%
                </Text>
              </View>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.background, fontSize: 32, fontWeight: "bold" }}>
                  {overallHealth > 80 ? "✓" : overallHealth > 50 ? "⚠" : "✗"}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Chain Health Cards */}
          <View className="mt-6 gap-4">
            {[baseHealth, avaxHealth].map(
              (health, idx) =>
                health && (
                  <Animated.View key={health.chain} entering={FadeInDown.delay(300 + idx * 100)}>
                    <View
                      style={[
                        styles.chainCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View className="flex-row justify-between items-start mb-4">
                        <View>
                          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "bold" }}>
                            {health.chainName}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                            Chain ID: {health.chainId}
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: health.healthPercentage > 80 ? colors.success : colors.warning,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.background,
                              fontSize: 12,
                              fontWeight: "bold",
                            }}
                          >
                            {health.healthPercentage}%
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View
                        style={{
                          height: 8,
                          backgroundColor: colors.border,
                          borderRadius: 4,
                          overflow: "hidden",
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${health.healthPercentage}%`,
                            backgroundColor:
                              health.healthPercentage > 80 ? colors.success : health.healthPercentage > 50 ? colors.warning : colors.error,
                          }}
                        />
                      </View>

                      {/* Stats */}
                      <View className="flex-row justify-between">
                        <View>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Contracts Alive</Text>
                          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "bold", marginTop: 2 }}>
                            {health.aliveContracts}/{health.totalContracts}
                          </Text>
                        </View>
                        {health.loading ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: colors.primary,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: colors.background, fontSize: 20 }}>
                              {health.healthPercentage === 100 ? "✓" : "⚠"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Animated.View>
                )
            )}
          </View>

          {/* Core Values */}
          <Animated.View entering={FadeInDown.delay(500)} className="mt-8">
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
              Core Values
            </Text>
            <View
              style={[
                styles.valuesCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, fontWeight: "500" }}>
                {CORE_VALUES}
              </Text>
            </View>
          </Animated.View>

          {/* Protocol Info */}
          <Animated.View entering={FadeInDown.delay(600)} className="mt-6 mb-4">
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                The Vaultfire Protocol is deployed across {BASE_CONTRACTS.length} contracts on Base and {AVALANCHE_CONTRACTS.length} contracts on Avalanche, implementing ERC-8004 standards for ethical AI governance.
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  healthCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chainCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  valuesCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
