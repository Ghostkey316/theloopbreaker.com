/**
 * Embris Multi-Conversation System (Mobile)
 *
 * Manages multiple chat conversations using AsyncStorage.
 * Embris's memory remains GLOBAL across all conversations.
 *
 * Storage layout:
 *   @embris_conversations_index  — JSON array of ConversationMeta (sorted by updatedAt desc)
 *   @embris_conv_{id}            — JSON array of ChatMessage for that conversation
 *   @embris_active_conv          — string: currently active conversation id
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatMessage } from "./memory";

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const INDEX_KEY = "@embris_conversations_index";
const ACTIVE_KEY = "@embris_active_conv";
const CONV_PREFIX = "@embris_conv_";
const LEGACY_CHAT_KEY = "@ember_chat_history";

// ─── Index management ─────────────────────────────────────────────────────────

export async function getConversationIndex(): Promise<ConversationMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ConversationMeta[];
  } catch { return []; }
}

async function saveConversationIndex(index: ConversationMeta[]): Promise<void> {
  const sorted = [...index].sort((a, b) => b.updatedAt - a.updatedAt);
  try { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(sorted)); } catch { /* ignore */ }
}

// ─── Active conversation ──────────────────────────────────────────────────────

export async function getActiveConversationId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export async function setActiveConversationId(id: string): Promise<void> {
  try { await AsyncStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

// ─── Conversation CRUD ────────────────────────────────────────────────────────

export async function createConversation(firstMessage?: string): Promise<ConversationMeta> {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const preview = firstMessage ? firstMessage.slice(0, 60) : "New conversation";
  const title = generateTitle(firstMessage || "");
  const meta: ConversationMeta = { id, title, createdAt: now, updatedAt: now, preview };

  const index = await getConversationIndex();
  index.unshift(meta);
  await saveConversationIndex(index);
  await setActiveConversationId(id);
  return meta;
}

export async function updateConversationMeta(
  id: string,
  updates: Partial<Pick<ConversationMeta, "title" | "updatedAt" | "preview">>
): Promise<void> {
  const index = await getConversationIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx === -1) return;
  index[idx] = { ...index[idx], ...updates };
  await saveConversationIndex(index);
}

export async function deleteConversation(id: string): Promise<void> {
  const index = await getConversationIndex();
  const filtered = index.filter((c) => c.id !== id);
  await saveConversationIndex(filtered);
  try { await AsyncStorage.removeItem(`${CONV_PREFIX}${id}`); } catch { /* ignore */ }

  const activeId = await getActiveConversationId();
  if (activeId === id) {
    if (filtered.length > 0) {
      await setActiveConversationId(filtered[0].id);
    } else {
      try { await AsyncStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
    }
  }
}

// ─── Message storage per conversation ────────────────────────────────────────

export async function getConversationMessages(id: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CONV_PREFIX}${id}`);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch { return []; }
}

export async function saveConversationMessages(id: string, messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-200);
  try { await AsyncStorage.setItem(`${CONV_PREFIX}${id}`, JSON.stringify(trimmed)); } catch { /* ignore */ }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  await updateConversationMeta(id, {
    updatedAt: Date.now(),
    preview: lastUser ? lastUser.content.slice(0, 60) : "",
  });
}

export async function clearConversationMessages(id: string): Promise<void> {
  try { await AsyncStorage.removeItem(`${CONV_PREFIX}${id}`); } catch { /* ignore */ }
  await updateConversationMeta(id, { updatedAt: Date.now(), preview: "" });
}

// ─── Title generation ─────────────────────────────────────────────────────────

export function generateTitle(firstUserMessage: string): string {
  if (!firstUserMessage.trim()) return "New Chat";
  const clean = firstUserMessage.trim().replace(/[^\w\s,.?!'-]/g, "").trim();
  if (clean.length <= 40) return clean;
  const truncated = clean.slice(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

export async function updateConversationTitle(id: string, firstUserMessage: string): Promise<void> {
  const title = generateTitle(firstUserMessage);
  await updateConversationMeta(id, { title });
}

// ─── Migration: import existing @ember_chat_history ──────────────────────────

export async function migrateFromLegacy(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_CHAT_KEY);
    if (!raw) return null;
    const messages = JSON.parse(raw) as ChatMessage[];
    if (!messages || messages.length === 0) return null;

    const index = await getConversationIndex();
    if (index.length > 0) return getActiveConversationId();

    const firstUser = messages.find((m) => m.role === "user");
    const meta = await createConversation(firstUser?.content || "");
    await saveConversationMessages(meta.id, messages);
    return meta.id;
  } catch { return null; }
}

// ─── Ensure an active conversation exists ────────────────────────────────────

export async function ensureActiveConversation(): Promise<string> {
  const migrated = await migrateFromLegacy();
  if (migrated) return migrated;

  const activeId = await getActiveConversationId();
  if (activeId) {
    const index = await getConversationIndex();
    if (index.some((c) => c.id === activeId)) return activeId;
  }

  const index = await getConversationIndex();
  if (index.length > 0) {
    await setActiveConversationId(index[0].id);
    return index[0].id;
  }

  const meta = await createConversation();
  return meta.id;
}
