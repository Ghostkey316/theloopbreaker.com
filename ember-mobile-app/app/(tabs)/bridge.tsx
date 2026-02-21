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
import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";
import { getTeleporterBridgeStats, checkContractAlive } from "@/lib/contract-reader";
import Animated, { FadeInDown } from "react-native-reanimated";

interface BridgeStatus {
  chain: "base" | "avalanche";
  chainName: string;
  chainId: number;
  isAlive: boolean;
  messageCount: number;
  relayerCount: number;
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

      // Initialize loading states
      setBaseStatus({
        chain: "base",
        chainName: "Base",
        chainId: 8453,
        isAlive: false,
        messageCount: 0,
        relayerCount: 0,
        loading: true,
      });
      setAvaxStatus({
        chain: "avalanche",
        chainName: "Avalanche",
        chainId: 43114,
        isAlive: false,
        messageCount: 0,
        relayerCount: 0,
        loading: true,
      });

      // Check bridge contracts
      if (baseBridge && avaxBridge) {
        const [baseStats, avaxStats] = await Promise.all([
          getTeleporterBridgeStats("base", baseBridge.address),
          getTeleporterBridgeStats("avalanche", avaxBridge.address),
        ]);

        setBaseStatus({
          chain: "base",
          chainName: "Base",
          chainId: 8453,
          isAlive: baseStats.isAlive,
          messageCount: baseStats.messageCount,
          relayerCount: baseStats.relayerCount,
          loading: false,
        });

        setAvaxStatus({
          chain: "avalanche",
          chainName: "Avalanche",
          chainId: 43114,
          isAlive: avaxStats.isAlive,
          messageCount: avaxStats.messageCount,
          relayerCount: avaxStats.relayerCount,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Bridge status check failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseBridge, avaxBridge]);

  useEffect(() => {
    loadBridgeStatus();
  }, [loadBridgeStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBridgeStatus();
  };

  const currentStatus = selectedChain === "base" ? baseStatus : avaxStatus;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground mb-2">Cross-Chain Bridge</Text>
            <Text className="text-sm text-muted">Vaultfire Teleporter Bridge Status</Text>
          </View>

          {/* Chain Selector */}
          <View className="flex-row gap-3 mb-6">
            <Pressable
              onPress={() => setSelectedChain("base")}
              style={({ pressed }) => [
                styles.chainButton,
                {
                  backgroundColor: selectedChain === "base" ? colors.primary : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedChain === "base" ? colors.background : colors.foreground,
                  fontWeight: "600",
                }}
              >
                Base
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedChain("avalanche")}
              style={({ pressed }) => [
                styles.chainButton,
                {
                  backgroundColor: selectedChain === "avalanche" ? colors.primary : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedChain === "avalanche" ? colors.background : colors.foreground,
                  fontWeight: "600",
                }}
              >
                Avalanche
              </Text>
            </Pressable>
          </View>

          {/* Bridge Status Card */}
          {loading && !currentStatus ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, marginTop: 12 }}>Loading bridge status...</Text>
            </View>
          ) : currentStatus ? (
            <Animated.View entering={FadeInDown.delay(200)}>
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: currentStatus.isAlive ? colors.success : colors.error,
                    borderWidth: 2,
                  },
                ]}
              >
                {/* Status Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Bridge Status</Text>
                    <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginTop: 4 }}>
                      {currentStatus.chainName} Bridge
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: currentStatus.isAlive ? colors.success : colors.error,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.background, fontSize: 24 }}>
                      {currentStatus.isAlive ? "✓" : "✗"}
                    </Text>
                  </View>
                </View>

                {/* Stats Grid */}
                <View className="gap-4">
                  <View className="flex-row gap-4">
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Messages Relayed</Text>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 20,
                          fontWeight: "bold",
                          marginTop: 4,
                        }}
                      >
                        {currentStatus.messageCount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Active Relayers</Text>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 20,
                          fontWeight: "bold",
                          marginTop: 4,
                        }}
                      >
                        {currentStatus.relayerCount}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                      marginVertical: 4,
                    }}
                  />

                  <View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Chain ID</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 4 }}>
                      {currentStatus.chainId}
                    </Text>
                  </View>
                </View>

                {/* Status Indicator */}
                <View className="mt-6 flex-row items-center gap-3">
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: currentStatus.isAlive ? colors.success : colors.error,
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {currentStatus.isAlive ? "Bridge is operational" : "Bridge is offline"}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* Both Chains Summary */}
          <Animated.View entering={FadeInDown.delay(400)} className="mt-8">
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
              Network Overview
            </Text>
            <View className="gap-3">
              {[baseStatus, avaxStatus].map(
                (status) =>
                  status && (
                    <View
                      key={status.chain}
                      style={[
                        styles.miniCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                            {status.chainName}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                            {status.messageCount.toLocaleString()} messages
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: status.isAlive ? colors.success : colors.error,
                          }}
                        />
                      </View>
                    </View>
                  )
              )}
            </View>
          </Animated.View>

          {/* Info Section */}
          <Animated.View entering={FadeInDown.delay(600)} className="mt-8 mb-4">
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
                The Vaultfire Teleporter Bridge enables secure cross-chain communication between Base and Avalanche. Relayers validate and relay messages across chains.
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chainButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
  },
  miniCard: {
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
