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
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memoryService, type MemoryItem } from "@/lib/memory-service";

export default function SettingsScreen() {
  const colors = useColors();
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
    Alert.alert("Clear All Memories", "This will delete everything Ember remembers about you. This action cannot be undone.", [
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
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground mb-2">Settings</Text>
          <Text className="text-base text-muted">Manage your preferences and Ember's memory</Text>
        </View>

        {/* Ember's Memory Section */}
        <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="psychology" size={24} color="#F97316" />
              <Text className="text-xl font-semibold text-foreground">Ember's Memory</Text>
            </View>
            <View className="bg-primary px-3 py-1 rounded-full">
              <Text className="text-white font-semibold text-sm">{memoryCount}</Text>
            </View>
          </View>

          <Text className="text-sm text-muted mb-4 leading-relaxed">
            Ember remembers things you share to provide personalized, contextual responses. All memory is stored locally on your device — we never see it.
          </Text>

          {/* Privacy Notice */}
          <View className="bg-black/40 rounded-lg p-3 mb-4 border border-border">
            <View className="flex-row gap-2">
              <MaterialIcons name="lock" size={18} color="#8B5CF6" />
              <Text className="text-xs text-muted flex-1">
                🔒 Your privacy is protected. Ember's memory is stored only on your device using encrypted local storage. We never send this data to any server.
              </Text>
            </View>
          </View>

          {/* Clear All Button */}
          <Pressable
            onPress={clearAllMemories}
            style={({ pressed }) => [
              styles.dangerButton,
              { backgroundColor: pressed ? "#DC2626" : "#EF4444", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <MaterialIcons name="delete-outline" size={18} color="white" />
            <Text className="text-white font-semibold text-sm ml-2">Clear All Memories</Text>
          </Pressable>
        </View>

        {/* Memory List */}
        <View className="bg-surface rounded-xl p-4 border border-border">
          <Text className="text-lg font-semibold text-foreground mb-4">What Ember Remembers</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#F97316" />
          ) : memories.length === 0 ? (
            <Text className="text-center text-muted py-8">
              No memories yet. Start chatting with Ember to build your memory profile!
            </Text>
          ) : (
            <View className="gap-3">
              {memories.map((mem) => (
                <View key={mem.id} className="bg-black/20 rounded-lg p-3 border border-border flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-primary uppercase mb-1">{mem.category}</Text>
                    <Text className="text-sm font-medium text-foreground">{mem.key}</Text>
                    <Text className="text-xs text-muted mt-1">{mem.value}</Text>
                    <Text className="text-xs text-muted/60 mt-2">
                      {new Date(mem.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteMemory(mem.id)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  >
                    <MaterialIcons name="close" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Growth Metrics */}
        {memoryCount > 0 && (
          <View className="bg-surface rounded-xl p-4 mt-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">Your Growth</Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Days Using Ember</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {Math.ceil((Date.now() - (memories[0]?.timestamp || Date.now())) / (1000 * 60 * 60 * 24))} days
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted">Memories Collected</Text>
                <Text className="text-sm font-semibold text-foreground">{memoryCount}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});
