/**
 * Ember Memory System
 * Extracts and persists conversation memories using AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const MEMORY_KEY = "@ember_memories";
const CHAT_HISTORY_KEY = "@ember_chat_history";

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
  type: "fact" | "preference" | "context";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Extract potential memories from a conversation exchange.
 * Looks for factual statements, preferences, and contextual information.
 */
export function extractMemories(userMessage: string, assistantResponse: string): Memory[] {
  const memories: Memory[] = [];
  const timestamp = Date.now();

  // Extract if user mentions personal facts
  const factPatterns = [
    /(?:i am|i'm|my name is|i work|i live|i have)\s+(.+)/i,
    /(?:i prefer|i like|i want|i need)\s+(.+)/i,
    /(?:i'm interested in|i care about)\s+(.+)/i,
  ];

  for (const pattern of factPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        id: `mem_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        content: match[0].trim(),
        timestamp,
        type: match[0].toLowerCase().includes("prefer") || match[0].toLowerCase().includes("like")
          ? "preference"
          : "fact",
      });
    }
  }

  // Extract if user asks about specific contracts or topics
  const topicPatterns = [
    /(?:tell me about|what is|explain|how does)\s+(.+)/i,
    /(?:contract|address|bridge|governance)\s+(.+)/i,
  ];

  for (const pattern of topicPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        id: `mem_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        content: `User asked about: ${match[1].trim()}`,
        timestamp,
        type: "context",
      });
    }
  }

  return memories;
}

export async function saveMemories(newMemories: Memory[]): Promise<void> {
  try {
    const existing = await getMemories();
    const combined = [...existing, ...newMemories];
    // Keep only the last 100 memories
    const trimmed = combined.slice(-100);
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save memories:", error);
  }
}

export async function getMemories(): Promise<Memory[]> {
  try {
    const data = await AsyncStorage.getItem(MEMORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to get memories:", error);
    return [];
  }
}

export async function clearMemories(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MEMORY_KEY);
  } catch (error) {
    console.error("Failed to clear memories:", error);
  }
}

export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    // Keep only the last 200 messages
    const trimmed = messages.slice(-200);
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  try {
    const data = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to get chat history:", error);
    return [];
  }
}

export async function clearChatHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
  } catch (error) {
    console.error("Failed to clear chat history:", error);
  }
}
