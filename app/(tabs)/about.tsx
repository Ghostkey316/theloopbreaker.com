import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { CONTRACTS, basescanAddress, snowtraceAddress, AVAX_CONTRACTS } from "@/lib/contracts_config";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  const values = [
    {
      title: "Privacy",
      description: "User data is sacred. We never track, surveil, or monetize personal information.",
      icon: "privacy-tip",
    },
    {
      title: "Freedom",
      description: "AI should empower humans, not control them. Transparency and user agency first.",
      icon: "lock-open",
    },
    {
      title: "Accountability",
      description: "AI systems must be auditable and responsible for their actions.",
      icon: "verified-user",
    },
    {
      title: "Dignity",
      description: "Every person deserves respect, autonomy, and protection from AI harm.",
      icon: "favorite",
    },
  ];

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Failed to open URL:", err));
  };

  const renderValueCard = (value: typeof values[0]) => (
    <View key={value.title} style={styles.valueCard}>
      <View style={styles.valueIcon}>
        <MaterialIcons name={value.icon as any} size={20} color="#F97316" />
      </View>
      <View style={styles.valueContent}>
        <Text style={styles.valueTitle}>{value.title}</Text>
        <Text style={styles.valueDescription}>{value.description}</Text>
      </View>
    </View>
  );

  const renderContractGroup = (title: string, contracts: Record<string, string>, chain: "base" | "avax") => (
    <View key={title} style={styles.contractGroup}>
      <Text style={styles.contractGroupTitle}>{title}</Text>
      {Object.entries(contracts).map(([name, address]) => (
        <Pressable
          key={address}
          onPress={() => setExpandedContract(expandedContract === address ? null : address)}
          style={({ pressed }) => [styles.contractItem, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.contractHeader}>
            <View style={styles.contractInfo}>
              <Text style={styles.contractName}>{name}</Text>
              <Text style={styles.contractAddress}>{address.slice(0, 10)}...{address.slice(-8)}</Text>
            </View>
            <View style={styles.contractChain}>
              <Text style={styles.chainBadge}>{chain === "base" ? "Base" : "Avalanche"}</Text>
            </View>
            <MaterialIcons
              name={expandedContract === address ? "expand-less" : "expand-more"}
              size={20}
              color="#6B7280"
            />
          </View>

          {expandedContract === address && (
            <View style={styles.contractExpanded}>
              <Pressable
                onPress={() =>
                  handleOpenLink(
                    chain === "base" ? basescanAddress(address) : snowtraceAddress(address)
                  )
                }
                style={({ pressed }) => [styles.explorerLink, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="open-in-new" size={16} color="#F97316" />
                <Text style={styles.explorerLinkText}>
                  View on {chain === "base" ? "Basescan" : "Snowtrace"}
                </Text>
              </Pressable>
              <View style={styles.addressCopy}>
                <Text style={styles.fullAddress}>{address}</Text>
              </View>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="info" size={24} color="#F97316" />
            <Text style={styles.headerTitle}>About</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Logo & Title */}
            <View style={styles.heroSection}>
              <View style={styles.heroLogo}>
                <MaterialIcons name="shield" size={48} color="#F97316" />
                <MaterialIcons
                  name="local-fire-department"
                  size={28}
                  color="#F97316"
                  style={styles.heroFlame}
                />
              </View>
              <Text style={styles.heroTitle}>Vaultfire Protocol</Text>
              <Text style={styles.heroSubtitle}>The world's first AI accountability protocol</Text>
            </View>

            {/* Mission */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mission</Text>
              <Text style={styles.missionText}>
                Vaultfire empowers humans to reclaim agency in an AI-driven world. We build infrastructure for trust, transparency, and accountability in AI systems—ensuring privacy, freedom, and human dignity at every layer.
              </Text>
            </View>

            {/* Values */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Core Values</Text>
              <View style={styles.valuesGrid}>
                {values.map(renderValueCard)}
              </View>
            </View>

            {/* Architecture */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Architecture</Text>
              <View style={styles.architectureCard}>
                <Text style={styles.architectureTitle}>ERC-8004 Standard</Text>
                <Text style={styles.architectureText}>
                  Vaultfire uses the ERC-8004 standard for AI agent identity, reputation, and validation across Base and Avalanche.
                </Text>
                <View style={styles.architectureFeatures}>
                  <ArchFeature icon="person" label="Identity Registry" />
                  <ArchFeature icon="star" label="Reputation System" />
                  <ArchFeature icon="verified-user" label="Validation" />
                  <ArchFeature icon="attach-money" label="Bonds" />
                </View>
              </View>
            </View>

            {/* Contracts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Smart Contracts</Text>
              <Text style={styles.contractsDescription}>
                Tap any contract to view on the blockchain explorer.
              </Text>
              {renderContractGroup("Base Mainnet (Chain ID 8453)", CONTRACTS, "base")}
              {renderContractGroup("Avalanche C-Chain (Chain ID 43114)", AVAX_CONTRACTS, "avax")}
            </View>

            {/* Links */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resources</Text>
              <View style={styles.linksGrid}>
                <LinkButton icon="language" label="Website" onPress={() => handleOpenLink("https://vaultfire.io")} />
                <LinkButton icon="description" label="Docs" onPress={() => handleOpenLink("https://docs.vaultfire.io")} />
                <LinkButton icon="code" label="GitHub" onPress={() => handleOpenLink("https://github.com/vaultfire")} />
                <LinkButton icon="forum" label="Discord" onPress={() => handleOpenLink("https://discord.gg/vaultfire")} />
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Vaultfire Protocol v1.0</Text>
              <Text style={styles.footerSubtext}>Built for the Avalanche Build Games</Text>
              <Text style={styles.footerSubtext}>Read-only. Zero tracking. Privacy first.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function ArchFeature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.archFeature}>
      <MaterialIcons name={icon as any} size={16} color="#F97316" />
      <Text style={styles.archFeatureLabel}>{label}</Text>
    </View>
  );
}

function LinkButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkButton, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
    >
      <MaterialIcons name={icon as any} size={20} color="#F97316" />
      <Text style={styles.linkButtonLabel}>{label}</Text>
    </Pressable>
  );
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
    gap: 24,
  },
  heroSection: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  heroLogo: {
    position: "relative",
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  heroFlame: {
    position: "absolute",
    bottom: -4,
    right: -4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
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
  missionText: {
    fontSize: 14,
    color: "#E5E7EB",
    lineHeight: 22,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
  },
  valuesGrid: {
    gap: 10,
  },
  valueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
  },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#252540",
    alignItems: "center",
    justifyContent: "center",
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  valueDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
  },
  architectureCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F97316",
  },
  architectureTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  architectureText: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
  },
  architectureFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  archFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#252540",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  archFeatureLabel: {
    fontSize: 11,
    color: "#E5E7EB",
    fontWeight: "500",
  },
  contractsDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  contractGroup: {
    gap: 6,
    marginBottom: 12,
  },
  contractGroupTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  contractItem: {
    backgroundColor: "#1A1A2E",
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
  },
  contractHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contractInfo: {
    flex: 1,
  },
  contractName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  contractAddress: {
    fontSize: 11,
    color: "#6B7280",
    fontFamily: "monospace",
  },
  contractChain: {
    marginRight: 4,
  },
  chainBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#F97316",
    backgroundColor: "#3D2817",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contractExpanded: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#252540",
    gap: 8,
  },
  explorerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  explorerLinkText: {
    fontSize: 12,
    color: "#F97316",
    fontWeight: "600",
  },
  addressCopy: {
    backgroundColor: "#252540",
    borderRadius: 6,
    padding: 8,
  },
  fullAddress: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "monospace",
  },
  linksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  linkButton: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1A1A2E",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: "#2A2A3E",
  },
  linkButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 24,
    borderTopWidth: 0.5,
    borderTopColor: "#1A1A2E",
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  footerSubtext: {
    fontSize: 11,
    color: "#6B7280",
  },
});
