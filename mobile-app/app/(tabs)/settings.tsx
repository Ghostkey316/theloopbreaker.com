import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memoryService, type MemoryItem } from "@/lib/memory-service";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    const allMemories = await memoryService.getAll();
    setMemories(allMemories);
    setMemoryCount(allMemories.length);
    setLoading(false);
  };

  const deleteMemory = async (id: string) => {
    Alert.alert("Delete Memory", "Are you sure you want to delete this memory?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Delete",
        onPress: async () => {
          await memoryService.deleteMemory(id);
          await loadMemories();
        },
      },
    ]);
  };

  const clearAllMemories = () => {
    Alert.alert("Clear All Memories", "This will delete everything Embris remembers about you. This cannot be undone.", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Clear All",
        onPress: async () => {
          await memoryService.clearAll();
          await loadMemories();
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="p-0">
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Settings</Text>
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* Memory Section */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>EMBRIS MEMORY</Text>
              <View style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.cardTitle}>Local Memory</Text>
                  <Text style={s.badge}>{memoryCount}</Text>
                </View>
                <Text style={s.cardDesc}>
                  Embris remembers things you share to provide personalized responses. All memory is stored locally on your device — never sent to any server.
                </Text>
                <View style={s.privacyNote}>
                  <MaterialIcons name="lock" size={14} color="#52525B" />
                  <Text style={s.privacyText}>
                    Encrypted local storage. Zero server-side data.
                  </Text>
                </View>
                <Pressable
                  onPress={clearAllMemories}
                  style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.7 }]}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                  <Text style={s.clearBtnText}>Clear All Memories</Text>
                </Pressable>
              </View>
            </View>

            {/* Memory List */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>WHAT EMBRIS REMEMBERS</Text>
              {loading ? (
                <ActivityIndicator size="large" color="#A1A1AA" style={{ paddingVertical: 32 }} />
              ) : memories.length === 0 ? (
                <Text style={s.emptyText}>
                  No memories yet. Start chatting with Embris to build your memory profile.
                </Text>
              ) : (
                <View style={s.memList}>
                  {memories.map((mem) => (
                    <View key={mem.id} style={s.memItem}>
                      <View style={s.memContent}>
                        <Text style={s.memCategory}>{mem.category.replace("_", " ")}</Text>
                        <Text style={s.memKey}>{mem.key}</Text>
                        <Text style={s.memValue}>{mem.value}</Text>
                        <Text style={s.memDate}>
                          {new Date(mem.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => deleteMemory(mem.id)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.4 : 1, padding: 4 }]}
                      >
                        <MaterialIcons name="close" size={16} color="#52525B" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Growth */}
            {memoryCount > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>GROWTH</Text>
                <View style={s.card}>
                  <View style={s.growthRow}>
                    <Text style={s.growthLabel}>Days with Embris</Text>
                    <Text style={s.growthValue}>
                      {Math.ceil((Date.now() - (memories[0]?.timestamp || Date.now())) / (1000 * 60 * 60 * 24))}
                    </Text>
                  </View>
                  <View style={[s.growthRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.03)", paddingTop: 12 }]}>
                    <Text style={s.growthLabel}>Memories</Text>
                    <Text style={s.growthValue}>{memoryCount}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
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

  card: {
    backgroundColor: "#111113", borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)", gap: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "500", color: "#FAFAFA" },
  badge: {
    fontSize: 12, fontWeight: "600", color: "#FAFAFA",
    backgroundColor: "rgba(249,115,22,0.15)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
  },
  cardDesc: { fontSize: 13, color: "#A1A1AA", lineHeight: 18 },

  privacyNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  privacyText: { fontSize: 12, color: "#52525B" },

  clearBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 8, marginTop: 4,
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.15)",
  },
  clearBtnText: { fontSize: 13, fontWeight: "500", color: "#EF4444" },

  emptyText: { fontSize: 14, color: "#52525B", textAlign: "center", paddingVertical: 32 },

  memList: { gap: 8 },
  memItem: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: "#111113", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.03)",
  },
  memContent: { flex: 1 },
  memCategory: {
    fontSize: 10, fontWeight: "500", color: "#52525B",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  memKey: { fontSize: 13, fontWeight: "500", color: "#FAFAFA" },
  memValue: { fontSize: 12, color: "#A1A1AA", marginTop: 2 },
  memDate: { fontSize: 10, color: "#52525B", marginTop: 6 },

  growthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  growthLabel: { fontSize: 13, color: "#A1A1AA" },
  growthValue: { fontSize: 14, fontWeight: "600", color: "#FAFAFA" },
});
