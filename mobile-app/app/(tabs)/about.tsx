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
    <View key={value.title} style={s.valueCard}>
      <View style={s.valueIcon}>
        <MaterialIcons name={value.icon as any} size={18} color="#F97316" />
      </View>
      <View style={s.valueContent}>
        <Text style={s.valueTitle}>{value.title}</Text>
        <Text style={s.valueDesc}>{value.description}</Text>
      </View>
    </View>
  );

  const renderContractGroup = (title: string, contracts: Record<string, string>, chain: "base" | "avax") => (
    <View key={title} style={s.contractGroup}>
      <Text style={s.contractGroupTitle}>{title}</Text>
      {Object.entries(contracts).map(([name, address]) => (
        <Pressable
          key={address}
          onPress={() => setExpandedContract(expandedContract === address ? null : address)}
          style={({ pressed }) => [s.contractItem, pressed && { opacity: 0.7 }]}
        >
          <View style={s.contractHeader}>
            <View style={s.contractInfo}>
              <Text style={s.contractName}>{name}</Text>
              <Text style={s.contractAddr}>{address.slice(0, 10)}...{address.slice(-8)}</Text>
            </View>
            <Text style={s.chainBadge}>{chain === "base" ? "Base" : "Avax"}</Text>
            <MaterialIcons
              name={expandedContract === address ? "expand-less" : "expand-more"}
              size={18}
              color="#52525B"
            />
          </View>

          {expandedContract === address && (
            <View style={s.contractExpanded}>
              <Pressable
                onPress={() =>
                  handleOpenLink(
                    chain === "base" ? basescanAddress(address) : snowtraceAddress(address)
                  )
                }
                style={({ pressed }) => [s.explorerLink, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="open-in-new" size={14} color="#F97316" />
                <Text style={s.explorerLinkText}>
                  View on {chain === "base" ? "Basescan" : "Snowtrace"}
                </Text>
              </Pressable>
              <View style={s.addrBox}>
                <Text style={s.fullAddr}>{address}</Text>
              </View>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>About</Text>
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* Hero */}
            <View style={s.hero}>
              <View style={s.heroIcon}>
                <MaterialIcons name="local-fire-department" size={36} color="#F97316" />
              </View>
              <Text style={s.heroTitle}>Embris</Text>
              <Text style={s.heroLabel}>POWERED BY VAULTFIRE PROTOCOL</Text>
              <Text style={s.heroDesc}>
                The world's first AI accountability protocol. Infrastructure for verifiable trust between humans and AI.
              </Text>
            </View>

            {/* Mission */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>MISSION</Text>
              <Text style={s.bodyText}>
                Vaultfire empowers humans to reclaim agency in an AI-driven world. We build infrastructure for trust, transparency, and accountability in AI systems — ensuring privacy, freedom, and human dignity at every layer.
              </Text>
            </View>

            {/* Values */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>CORE VALUES</Text>
              <View style={s.valuesGrid}>
                {values.map(renderValueCard)}
              </View>
            </View>

            {/* Architecture */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>ARCHITECTURE</Text>
              <View style={s.archCard}>
                <Text style={s.archTitle}>ERC-8004 Standard</Text>
                <Text style={s.archText}>
                  AI agent identity, reputation, and validation across Base and Avalanche.
                </Text>
                <View style={s.archFeatures}>
                  <ArchFeature icon="person" label="Identity" />
                  <ArchFeature icon="star" label="Reputation" />
                  <ArchFeature icon="verified-user" label="Validation" />
                  <ArchFeature icon="attach-money" label="Bonds" />
                </View>
              </View>
            </View>

            {/* Contracts */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>SMART CONTRACTS</Text>
              <Text style={s.bodyTextSmall}>Tap any contract to view on the blockchain explorer.</Text>
              {renderContractGroup("Base Mainnet (Chain ID 8453)", CONTRACTS, "base")}
              {renderContractGroup("Avalanche C-Chain (Chain ID 43114)", AVAX_CONTRACTS, "avax")}
            </View>

            {/* Links */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>RESOURCES</Text>
              <View style={s.linksGrid}>
                <LinkButton icon="language" label="Website" onPress={() => handleOpenLink("https://theloopbreaker.com")} />
                <LinkButton icon="description" label="Docs" onPress={() => handleOpenLink("https://docs.vaultfire.io")} />
                <LinkButton icon="code" label="GitHub" onPress={() => handleOpenLink("https://github.com/Ghostkey316")} />
                <LinkButton icon="forum" label="Discord" onPress={() => handleOpenLink("https://discord.gg/vaultfire")} />
              </View>
            </View>

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerText}>Embris v1.0 — Powered by Vaultfire Protocol</Text>
              <Text style={s.footerSub}>Read-only. Zero tracking. Privacy first.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function ArchFeature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.archFeature}>
      <MaterialIcons name={icon as any} size={14} color="#A1A1AA" />
      <Text style={s.archFeatureLabel}>{label}</Text>
    </View>
  );
}

function LinkButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.7 }]}
    >
      <MaterialIcons name={icon as any} size={18} color="#A1A1AA" />
      <Text style={s.linkBtnLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  headerTitle: { fontSize: 28, fontWeight: "600", color: "#FAFAFA" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 24, gap: 48 },

  // Hero
  hero: { alignItems: "center", gap: 8 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#111113", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 4,
  },
  heroTitle: { fontSize: 28, fontWeight: "600", color: "#FAFAFA" },
  heroLabel: {
    fontSize: 11, fontWeight: "500", color: "#52525B",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  heroDesc: { fontSize: 14, color: "#A1A1AA", textAlign: "center", lineHeight: 20, marginTop: 8 },

  // Sections
  section: { gap: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: "500", color: "#52525B",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  bodyText: { fontSize: 14, color: "#A1A1AA", lineHeight: 22 },
  bodyTextSmall: { fontSize: 13, color: "#52525B", marginBottom: 8 },

  // Values
  valuesGrid: { gap: 8 },
  valueCard: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#111113", borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  valueIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(249,115,22,0.08)", alignItems: "center", justifyContent: "center",
  },
  valueContent: { flex: 1 },
  valueTitle: { fontSize: 14, fontWeight: "500", color: "#FAFAFA", marginBottom: 2 },
  valueDesc: { fontSize: 13, color: "#A1A1AA", lineHeight: 18 },

  // Architecture
  archCard: {
    backgroundColor: "#111113", borderRadius: 12, padding: 20, gap: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  archTitle: { fontSize: 14, fontWeight: "500", color: "#FAFAFA" },
  archText: { fontSize: 13, color: "#A1A1AA", lineHeight: 18 },
  archFeatures: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  archFeature: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  archFeatureLabel: { fontSize: 11, color: "#A1A1AA", fontWeight: "500" },

  // Contracts
  contractGroup: { gap: 6, marginBottom: 16 },
  contractGroupTitle: { fontSize: 11, fontWeight: "500", color: "#52525B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  contractItem: {
    backgroundColor: "#111113", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  contractHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  contractInfo: { flex: 1 },
  contractName: { fontSize: 13, fontWeight: "500", color: "#FAFAFA", marginBottom: 2 },
  contractAddr: { fontSize: 10, color: "#52525B", fontFamily: "monospace" },
  chainBadge: {
    fontSize: 10, fontWeight: "500", color: "#A1A1AA",
    backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  contractExpanded: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.03)", gap: 8,
  },
  explorerLink: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  explorerLinkText: { fontSize: 12, color: "#F97316", fontWeight: "500" },
  addrBox: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, padding: 10 },
  fullAddr: { fontSize: 10, color: "#A1A1AA", fontFamily: "monospace" },

  // Links
  linksGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkBtn: {
    flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#111113", borderRadius: 10, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  linkBtnLabel: { fontSize: 13, fontWeight: "500", color: "#FAFAFA" },

  // Footer
  footer: {
    alignItems: "center", gap: 4, paddingVertical: 24,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.03)",
  },
  footerText: { fontSize: 12, fontWeight: "500", color: "#52525B" },
  footerSub: { fontSize: 11, color: "#52525B" },
});
