import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import type { Conversation, ChatMessage } from "./ember";

const CONVERSATIONS_KEY = "vaultfire_conversations";
const ACTIVE_CONVERSATION_KEY = "vaultfire_active_conversation";

export async function getConversations(): Promise<Conversation[]> {
  try {
    const data = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    if (!data) return [];
    const convos: Conversation[] = JSON.parse(data);
    return convos.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const convos = await getConversations();
  const index = convos.findIndex((c) => c.id === conversation.id);
  if (index >= 0) {
    convos[index] = conversation;
  } else {
    convos.unshift(conversation);
  }
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convos));
}

export async function deleteConversation(id: string): Promise<void> {
  const convos = await getConversations();
  const filtered = convos.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(filtered));
}

export async function getActiveConversationId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

export async function setActiveConversationId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
}

export function createNewConversation(): Conversation {
  return {
    id: uuidv4(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";
  const text = firstUserMsg.content.trim();
  if (text.length <= 40) return text;
  return text.substring(0, 37) + "...";
}
