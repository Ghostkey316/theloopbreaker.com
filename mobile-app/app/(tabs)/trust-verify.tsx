import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useWallet } from "@/lib/wallet-context";
import { fetchTrustProfile, type TrustProfile } from "@/lib/on-chain";
import { ethers } from "ethers";

export default function TrustVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { connectedAddress, shortenAddress } = useWallet();
  const [searchAddress, setSearchAddress] = useState(connectedAddress || "");
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  useEffect(() => {
    if (connectedAddress && !searchAddress) {
      setSearchAddress(connectedAddress);
      handleSearch(connectedAddress);
    }
  }, [connectedAddress]);

  const handleSearch = async (input: string) => {
    if (!input.trim()) {
      setError("Please enter an address or ENS name");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProfile(null);
    setResolvedName(null);

    let address: string = input.trim();
    const inputStr: string = address;

    // Try ENS/Basename resolution
    if (!ethers.isAddress(address)) {
      if (inputStr.endsWith(".eth") || inputStr.endsWith(".base") || inputStr.endsWith(".base.eth")) {
        try {
          const { getApiBaseUrl } = await import("@/constants/oauth");
          const apiBase = getApiBaseUrl();
          const res = await fetch(`${apiBase}/trpc/resolveAddress.resolve?input=${encodeURIComponent(JSON.stringify({ input: address }))}`);
          const json = await res.json();
          if (json?.result?.data?.address) {
            setResolvedName(address);
            address = json.result.data.address;
          } else {
            setError(`Could not resolve "${address}". Try a 0x address.`);
            setIsLoading(false);
            return;
          }
        } catch {
          setError(`Failed to resolve "${address}". Try a 0x address.`);
          setIsLoading(false);
          return;
        }
      } else {
        setError("Invalid address. Enter a 0x address, .eth name, or .base name.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const checksummed = ethers.getAddress(address);
      const data = await fetchTrustProfile(checksummed);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    // In a real app, you'd use Clipboard API
    // For now, just focus on the input
  };

  const renderCard = (title: string, icon: string, content: React.ReactNode) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialIcons name={icon as any} size={18} color="#F97316" />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardContent}>{content}</View>
    </View>
  );

  const renderIdentityCard = () => {
    if (!profile?.identity) {
      return renderCard("Identity", "person", <Text style={styles.noData}>Not registered</Text>);
    }

    return renderCard("Identity", "verified-user", (
      <View style={styles.dataRows}>
        <DataRow label="Address" value={shortenAddress(profile.identity.address)} />
        <DataRow label="Type" value={profile.identity.agentType} />
        <DataRow label="Status" value={profile.identity.active ? "Active" : "Inactive"} />
        <DataRow
          label="Registered"
          value={new Date(profile.identity.registeredAt * 1000).toLocaleDateString()}
        />
      </View>
    ));
  };

  const renderReputationCard = () => {
    if (!profile?.reputation) {
      return renderCard("Reputation", "star", <Text style={styles.noData}>No data</Text>);
    }

    const rating = profile.reputation.averageRating;
    const stars = Math.round(rating / 20); // Convert 0-100 to 0-5

    return renderCard("Reputation", "star", (
      <View style={styles.dataRows}>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingScore}>{rating.toFixed(0)}</Text>
          <View style={styles.stars}>
            {[...Array(5)].map((_, i) => (
              <MaterialIcons
                key={i}
                name={i < stars ? "star" : "star-outline"}
                size={14}
                color={i < stars ? "#F59E0B" : "#4B5563"}
              />
            ))}
          </View>
        </View>
        <DataRow label="Total Feedbacks" value={profile.reputation.totalFeedbacks.toString()} />
        <DataRow label="Verified" value={profile.reputation.verifiedFeedbacks.toString()} />
      </View>
    ));
  };

  const renderBondsCard = () => {
    return renderCard("Bonds", "attach-money", (
      <View style={styles.dataRows}>
        <DataRow label="Partnership Bonds" value={profile?.bonds.partnershipBonds.toString() || "0"} />
        <DataRow label="Accountability Bonds" value={profile?.bonds.accountabilityBonds.toString() || "0"} />
        <DataRow label="Total Staked" value={`${parseFloat(profile?.bonds.totalStaked || "0").toFixed(4)} ETH`} />
      </View>
    ));
  };

  const renderValidationCard = () => {
    return renderCard("Validation", "checklist", (
      <View style={styles.dataRows}>
        <DataRow label="Requests" value={profile?.validation.requestCount.toString() || "0"} />
        <DataRow label="Responses" value={profile?.validation.responseCount.toString() || "0"} />
      </View>
    ));
  };

  const renderBridgeCard = () => {
    const recognized = profile?.bridge.recognized;
    return renderCard("Bridge Status", "bridge", (
      <View style={styles.dataRows}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Avalanche Synced:</Text>
          <View
            style={[
              styles.statusBadge,
              recognized ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
            ]}
          >
            <MaterialIcons
              name={recognized ? "check-circle" : "cancel"}
              size={14}
              color={recognized ? "#22C55E" : "#F59E0B"}
            />
            <Text style={[styles.statusText, recognized ? styles.statusTextSuccess : styles.statusTextWarning]}>
              {recognized ? "Recognized" : "Not Recognized"}
            </Text>
          </View>
        </View>
      </View>
    ));
  };

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="verified-user" size={24} color="#F97316" />
            <Text style={styles.headerTitle}>Trust Verify</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={18} color="#52525B" />
            <TextInput
              style={styles.searchInput}
              placeholder="0x address, name.eth, or name.base"
              placeholderTextColor="#52525B"
              value={searchAddress}
              onChangeText={setSearchAddress}
              autoCapitalize="none"
            />
            {connectedAddress && (
              <Pressable
                onPress={() => setSearchAddress(connectedAddress)}
                style={({ pressed }) => [styles.pasteButton, pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="content-paste" size={18} color="#F97316" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => handleSearch(searchAddress)}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && !isLoading && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#09090B" size="small" />
            ) : (
              <MaterialIcons name="search" size={20} color="#09090B" />
            )}
          </Pressable>
        </View>

        {/* Results */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {profile && (
          <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultsContent}>
              {/* Address Display */}
              <View style={styles.addressDisplay}>
                <View style={styles.addressIcon}>
                  <MaterialIcons name="account-balance-wallet" size={24} color="#F97316" />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>Address</Text>
                  <Text style={styles.addressValue}>{shortenAddress(profile.address)}</Text>
                </View>
                {profile.fullyRegistered && (
                  <View style={styles.registeredBadge}>
                    <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                  </View>
                )}
              </View>

              {/* Cards */}
              {renderIdentityCard()}
              {renderReputationCard()}
              {renderBondsCard()}
              {renderValidationCard()}
              {renderBridgeCard()}
            </View>
          </ScrollView>
        )}

        {!profile && !isLoading && !error && (
          <View style={styles.emptyState}>
            <MaterialIcons name="shield" size={48} color="#F97316" />
            <Text style={styles.emptyTitle}>Enter an address to verify</Text>
            <Text style={styles.emptySubtitle}>Look up any Ethereum address to see their Vaultfire trust profile</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111113",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FAFAFA",
  },
  pasteButton: {
    padding: 4,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#7F1D1D",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  errorText: {
    fontSize: 13,
    color: "#FECACA",
    flex: 1,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  addressDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
    marginBottom: 8,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: "#52525B",
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FAFAFA",
    fontFamily: "monospace",
  },
  registeredBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  cardContent: {
    gap: 0,
  },
  dataRows: {
    gap: 8,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  dataLabel: {
    fontSize: 13,
    color: "#A1A1AA",
  },
  dataValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FAFAFA",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  ratingScore: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F59E0B",
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 13,
    color: "#A1A1AA",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeSuccess: {
    backgroundColor: "#064E3B",
  },
  statusBadgeWarning: {
    backgroundColor: "#78350F",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextSuccess: {
    color: "#22C55E",
  },
  statusTextWarning: {
    color: "#F59E0B",
  },
  noData: {
    fontSize: 13,
    color: "#52525B",
    fontStyle: "italic",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FAFAFA",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 18,
  },
});
