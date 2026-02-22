/**
 * Embris Enhanced Export System (Mobile)
 * Exports conversation data, memories, and analytics.
 * Uses Share API for mobile.
 */

import { Share, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage, Memory } from "./memory";

export async function exportConversation(
  messages: ChatMessage[],
  memories: Memory[]
): Promise<void> {
  let content = "# Embris Conversation Export\n";
  content += `Exported: ${new Date().toISOString()}\n`;
  content += `Messages: ${messages.length}\n`;
  content += `Memories: ${memories.length}\n\n`;

  content += "## Conversation\n\n";
  messages.forEach((m) => {
    const role = m.role === "user" ? "You" : "Embris";
    const time = new Date(m.timestamp).toLocaleString();
    content += `**${role}** (${time}):\n${m.content}\n\n`;
  });

  if (memories.length > 0) {
    content += "## Memories\n\n";
    memories.forEach((m) => {
      content += `- [${m.type}] ${m.content}\n`;
    });
  }

  try {
    await Share.share({
      message: content,
      title: "Embris Conversation Export",
    });
  } catch (error) {
    console.error("Export failed:", error);
  }
}

export async function exportAllData(): Promise<string> {
  const keys = await AsyncStorage.getAllKeys();
  const embrisKeys = keys.filter((k) => k.startsWith("@embris_") || k.startsWith("@ember_"));
  const pairs = await AsyncStorage.multiGet(embrisKeys);

  let content = "# Embris Full Data Export\n";
  content += `Exported: ${new Date().toISOString()}\n`;
  content += `Data keys: ${embrisKeys.length}\n\n`;

  pairs.forEach(([key, value]) => {
    content += `## ${key}\n\`\`\`json\n${value}\n\`\`\`\n\n`;
  });

  return content;
}
