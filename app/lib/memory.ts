/**
 * Ember Memory System — Browser localStorage-based persistence.
 */

const MEMORY_KEY = 'ember_memories';
const CHAT_HISTORY_KEY = 'ember_chat_history';

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
  type: 'fact' | 'preference' | 'context';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

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

export function extractMemories(userMessage: string, _assistantResponse: string): Memory[] {
  const memories: Memory[] = [];
  const timestamp = Date.now();
  const factPatterns = [
    /(?:i am|i'm|my name is|i work|i live|i have)\s+(.+)/i,
    /(?:i prefer|i like|i want|i need)\s+(.+)/i,
  ];
  for (const pattern of factPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        id: `mem_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
        content: match[0].trim(),
        timestamp,
        type: match[0].toLowerCase().includes('prefer') || match[0].toLowerCase().includes('like')
          ? 'preference' : 'fact',
      });
    }
  }
  return memories;
}

export function saveMemories(memories: Memory[]): void {
  storageSet(MEMORY_KEY, JSON.stringify(memories));
}

export function getMemories(): Memory[] {
  const raw = storageGet(MEMORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Memory[]; } catch { return []; }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  const trimmed = messages.slice(-100);
  storageSet(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
}

export function getChatHistory(): ChatMessage[] {
  const raw = storageGet(CHAT_HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as ChatMessage[]; } catch { return []; }
}

export function clearChatHistory(): void {
  storageRemove(CHAT_HISTORY_KEY);
}

export function clearMemories(): void {
  storageRemove(MEMORY_KEY);
}

export function getAllMemories(): Memory[] {
  return getMemories();
}

export function clearAllMemories(): void {
  storageRemove(MEMORY_KEY);
  storageRemove(CHAT_HISTORY_KEY);
}

export interface SyncData {
  version: number;
  exportedAt: string;
  chatHistory?: ChatMessage[];
  memories?: Memory[];
  walletAddress?: string;
}

export function exportData(): SyncData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    chatHistory: getChatHistory(),
    memories: getMemories(),
    walletAddress: typeof window !== 'undefined' ? (localStorage.getItem('vaultfire_wallet_address') ?? undefined) : undefined,
  };
}

export function importData(data: SyncData): void {
  if (data.chatHistory) saveChatHistory(data.chatHistory);
  if (data.memories) saveMemories(data.memories);
  if (data.walletAddress && typeof window !== 'undefined') {
    localStorage.setItem('vaultfire_wallet_address', data.walletAddress);
  }
}
