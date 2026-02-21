import { ScrollView, Text, View, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS } from "@/constants/contracts";
import { getMultipleContractStatus } from "@/lib/contract-reader";
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

      // Initialize with loading state
      const baseInit = BASE_CONTRACTS.map((c) => ({
        name: c.name,
        address: c.address,
        alive: false,
        loading: true,
      }));
      const avaxInit = AVALANCHE_CONTRACTS.map((c) => ({
        name: c.name,
        address: c.address,
        alive: false,
        loading: true,
      }));

      setBaseContracts(baseInit);
      setAvaxContracts(avaxInit);

      // Check Base contracts
      const baseAddresses = BASE_CONTRACTS.map((c) => c.address);
      const baseStatus = await getMultipleContractStatus("base", baseAddresses);
      const baseUpdated = BASE_CONTRACTS.map((c) => ({
        name: c.name,
        address: c.address,
        alive: baseStatus[c.address] ?? false,
        loading: false,
      }));
      setBaseContracts(baseUpdated);

      // Check Avalanche contracts
      const avaxAddresses = AVALANCHE_CONTRACTS.map((c) => c.address);
      const avaxStatus = await getMultipleContractStatus("avalanche", avaxAddresses);
      const avaxUpdated = AVALANCHE_CONTRACTS.map((c) => ({
        name: c.name,
        address: c.address,
        alive: avaxStatus[c.address] ?? false,
        loading: false,
      }));
      setAvaxContracts(avaxUpdated);
    } catch (error) {
      console.error("Failed to load contract status:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadContractStatus();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContractStatus();
  };

  const contracts = selectedChain === "base" ? baseContracts : avaxContracts;
  const aliveCount = contracts.filter((c) => c.alive).length;
  const totalCount = contracts.length;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground mb-2">Trust Verification</Text>
            <Text className="text-sm text-muted">Verify Vaultfire Protocol contracts on-chain</Text>
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
                Base (8453)
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
                Avalanche (43114)
              </Text>
            </Pressable>
          </View>

          {/* Status Summary */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Contracts Verified</Text>
                <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "bold" }}>
                  {aliveCount}/{totalCount}
                </Text>
              </View>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.background, fontSize: 28, fontWeight: "bold" }}>
                  {Math.round((aliveCount / totalCount) * 100)}%
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Contract List */}
          <View className="mt-6 gap-3">
            {loading && contracts.length === 0 ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>Loading contracts...</Text>
              </View>
            ) : (
              contracts.map((contract, idx) => (
                <Animated.View key={contract.address} entering={FadeInDown.delay(300 + idx * 50)}>
                  <View
                    style={[
                      styles.contractCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: contract.alive ? colors.success : colors.error,
                        borderLeftWidth: 4,
                      },
                    ]}
                  >
                    <View className="flex-row justify-between items-start flex-1">
                      <View className="flex-1">
                        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                          {contract.name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                          {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
                        </Text>
                      </View>
                      <View className="items-center">
                        {contract.loading ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: contract.alive ? colors.success : colors.error,
                            }}
                          />
                        )}
                        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                          {contract.alive ? "Live" : "Offline"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </View>

          {/* Footer Info */}
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
                This screen verifies that all Vaultfire Protocol contracts are deployed and responding on their respective chains. Green indicators mean the contract bytecode is present and callable.
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
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  contractCard: {
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
  },
  infoCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
