/**
 * Embris Multi-Conversation System
 *
 * Manages multiple chat conversations, each with its own message history.
 * Embris's memory (memories_v2) remains GLOBAL across all conversations.
 *
 * Storage layout:
 *   embris_conversations_index  — JSON array of ConversationMeta (sorted by updatedAt desc)
 *   embris_conv_{id}            — JSON array of ChatMessage for that conversation
 *   embris_active_conv          — string: currently active conversation id
 */

import type { ChatMessage } from './memory';

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** First user message snippet, used as fallback title */
  preview: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const INDEX_KEY = 'embris_conversations_index';
const ACTIVE_KEY = 'embris_active_conv';
const CONV_PREFIX = 'embris_conv_';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function storageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Index management ─────────────────────────────────────────────────────────

export function getConversationIndex(): ConversationMeta[] {
  const raw = storageGet(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ConversationMeta[]; } catch { return []; }
}

function saveConversationIndex(index: ConversationMeta[]): void {
  // Sort by most recent first
  const sorted = [...index].sort((a, b) => b.updatedAt - a.updatedAt);
  storageSet(INDEX_KEY, JSON.stringify(sorted));
}

// ─── Active conversation ──────────────────────────────────────────────────────

export function getActiveConversationId(): string | null {
  return storageGet(ACTIVE_KEY);
}

export function setActiveConversationId(id: string): void {
  storageSet(ACTIVE_KEY, id);
}

// ─── Conversation CRUD ────────────────────────────────────────────────────────

export function createConversation(firstMessage?: string): ConversationMeta {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const preview = firstMessage ? firstMessage.slice(0, 60) : 'New conversation';
  const title = generateTitle(firstMessage || '');
  const meta: ConversationMeta = { id, title, createdAt: now, updatedAt: now, preview };

  const index = getConversationIndex();
  index.unshift(meta);
  saveConversationIndex(index);
  setActiveConversationId(id);
  return meta;
}

export function updateConversationMeta(
  id: string,
  updates: Partial<Pick<ConversationMeta, 'title' | 'updatedAt' | 'preview'>>
): void {
  const index = getConversationIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx === -1) return;
  index[idx] = { ...index[idx], ...updates };
  saveConversationIndex(index);
}

export function deleteConversation(id: string): void {
  const index = getConversationIndex();
  const filtered = index.filter((c) => c.id !== id);
  saveConversationIndex(filtered);
  storageRemove(`${CONV_PREFIX}${id}`);

  // If we deleted the active conversation, switch to most recent
  const activeId = getActiveConversationId();
  if (activeId === id) {
    if (filtered.length > 0) {
      setActiveConversationId(filtered[0].id);
    } else {
      storageRemove(ACTIVE_KEY);
    }
  }
}

// ─── Message storage per conversation ────────────────────────────────────────

export function getConversationMessages(id: string): ChatMessage[] {
  const raw = storageGet(`${CONV_PREFIX}${id}`);
  if (!raw) return [];
  try { return JSON.parse(raw) as ChatMessage[]; } catch { return []; }
}

export function saveConversationMessages(id: string, messages: ChatMessage[]): void {
  const trimmed = messages.slice(-200);
  storageSet(`${CONV_PREFIX}${id}`, JSON.stringify(trimmed));
  // Update the index entry's updatedAt and preview
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  updateConversationMeta(id, {
    updatedAt: Date.now(),
    preview: lastUser ? lastUser.content.slice(0, 60) : '',
  });
}

export function clearConversationMessages(id: string): void {
  storageRemove(`${CONV_PREFIX}${id}`);
  updateConversationMeta(id, { updatedAt: Date.now(), preview: '' });
}

// ─── Title generation ─────────────────────────────────────────────────────────

export function generateTitle(firstUserMessage: string): string {
  if (!firstUserMessage.trim()) return 'New Chat';
  const clean = firstUserMessage.trim().replace(/[^\w\s,.?!'-]/g, '').trim();
  if (clean.length <= 40) return clean;
  // Truncate at last word boundary before 40 chars
  const truncated = clean.slice(0, 40);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + '…' : truncated + '…';
}

export function updateConversationTitle(id: string, firstUserMessage: string): void {
  const title = generateTitle(firstUserMessage);
  updateConversationMeta(id, { title });
}

// ─── Migration: import existing ember_chat_history into a conversation ────────

const LEGACY_CHAT_KEY = 'ember_chat_history';

export function migrateFromLegacy(): string | null {
  const raw = storageGet(LEGACY_CHAT_KEY);
  if (!raw) return null;
  try {
    const messages = JSON.parse(raw) as ChatMessage[];
    if (!messages || messages.length === 0) return null;

    // Check if already migrated
    const index = getConversationIndex();
    if (index.length > 0) return getActiveConversationId();

    // Create a conversation from the legacy history
    const firstUser = messages.find((m) => m.role === 'user');
    const meta = createConversation(firstUser?.content || '');
    saveConversationMessages(meta.id, messages);
    // Don't remove legacy key — keep as backup
    return meta.id;
  } catch { return null; }
}

// ─── Ensure an active conversation exists ────────────────────────────────────

export function ensureActiveConversation(): string {
  // Try migration first
  const migrated = migrateFromLegacy();
  if (migrated) return migrated;

  const activeId = getActiveConversationId();
  if (activeId) {
    const index = getConversationIndex();
    if (index.some((c) => c.id === activeId)) return activeId;
  }

  const index = getConversationIndex();
  if (index.length > 0) {
    setActiveConversationId(index[0].id);
    return index[0].id;
  }

  // Create fresh conversation
  const meta = createConversation();
  return meta.id;
}
