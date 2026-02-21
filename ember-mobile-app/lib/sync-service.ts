/**
 * Sync Service — Client-side sync layer for cross-platform data persistence.
 * 
 * Connects to the server's /api/sync/* endpoints to sync conversations,
 * memories, and wallet data across web and mobile platforms.
 * 
 * Uses wallet address as the universal identity (x-wallet-address header).
 * Falls back to local AsyncStorage when the server is unavailable.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SYNC_KEYS = {
  LAST_SYNC: "@vaultfire_last_sync",
  PENDING_SYNC: "@vaultfire_pending_sync",
  SYNC_ENABLED: "@vaultfire_sync_enabled",
};

// Resolve the API base URL
function getApiBase(): string {
  // In development, use the local server
  if (__DEV__) {
    return Platform.OS === "web"
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "http://localhost:3000";
  }
  // In production, use the deployed server URL
  return "";
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

async function syncFetch(
  path: string,
  walletAddress: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getApiBase();
  const url = `${base}${path}`;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": walletAddress.toLowerCase(),
      ...(options.headers || {}),
    },
  });
}

// ─── Auth / Profile ──────────────────────────────────────────────────────────

export interface SyncProfile {
  walletAddress: string;
  displayName?: string;
  lastPlatform?: string;
  lastSeen?: string;
  dbAvailable: boolean;
}

/**
 * Authenticate with the sync layer using wallet address.
 * Creates a profile if it doesn't exist.
 */
export async function syncAuth(walletAddress: string): Promise<SyncProfile | null> {
  try {
    const res = await syncFetch("/api/sync/auth", walletAddress, {
      method: "POST",
      body: JSON.stringify({
        platform: Platform.OS === "web" ? "web" : "mobile",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.profile
      ? { ...data.profile, dbAvailable: data.dbAvailable }
      : null;
  } catch (error) {
    console.warn("[Sync] Auth failed, operating offline:", error);
    return null;
  }
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface SyncMessage {
  role: string;
  content: string;
  timestamp: number;
}

export interface SyncConversation {
  id: number;
  walletAddress: string;
  title: string;
  messages: SyncMessage[];
  isActive: boolean;
  lastPlatform?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all conversations from the server.
 */
export async function fetchConversations(
  walletAddress: string,
  limit = 50
): Promise<SyncConversation[]> {
  try {
    const res = await syncFetch(
      `/api/sync/conversations?limit=${limit}`,
      walletAddress
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch {
    return [];
  }
}

/**
 * Fetch a single conversation by ID.
 */
export async function fetchConversation(
  walletAddress: string,
  id: number
): Promise<SyncConversation | null> {
  try {
    const res = await syncFetch(
      `/api/sync/conversations/${id}`,
      walletAddress
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversation || null;
  } catch {
    return null;
  }
}

/**
 * Create a new conversation on the server.
 */
export async function createSyncConversation(
  walletAddress: string,
  title: string,
  messages: SyncMessage[]
): Promise<{ id: number } | null> {
  try {
    const res = await syncFetch("/api/sync/conversations", walletAddress, {
      method: "POST",
      body: JSON.stringify({
        title,
        messages,
        platform: Platform.OS === "web" ? "web" : "mobile",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversation || null;
  } catch {
    return null;
  }
}

/**
 * Update an existing conversation on the server.
 */
export async function updateSyncConversation(
  walletAddress: string,
  id: number,
  messages: SyncMessage[],
  title?: string
): Promise<boolean> {
  try {
    const res = await syncFetch(
      `/api/sync/conversations/${id}`,
      walletAddress,
      {
        method: "PUT",
        body: JSON.stringify({
          messages,
          title,
          platform: Platform.OS === "web" ? "web" : "mobile",
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Archive (soft-delete) a conversation.
 */
export async function archiveSyncConversation(
  walletAddress: string,
  id: number
): Promise<boolean> {
  try {
    const res = await syncFetch(
      `/api/sync/conversations/${id}`,
      walletAddress,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Memories ────────────────────────────────────────────────────────────────

export interface SyncMemory {
  id: number;
  walletAddress: string;
  content: string;
  category?: string;
  sourcePlatform?: string;
  createdAt: string;
}

/**
 * Fetch all memories from the server.
 */
export async function fetchMemories(
  walletAddress: string,
  limit = 100
): Promise<SyncMemory[]> {
  try {
    const res = await syncFetch(
      `/api/sync/memories?limit=${limit}`,
      walletAddress
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.memories || [];
  } catch {
    return [];
  }
}

/**
 * Push new memories to the server.
 */
export async function pushMemories(
  walletAddress: string,
  memories: Array<{ content: string; category?: string }>
): Promise<boolean> {
  try {
    const res = await syncFetch("/api/sync/memories", walletAddress, {
      method: "POST",
      body: JSON.stringify({
        memories,
        platform: Platform.OS === "web" ? "web" : "mobile",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a memory from the server.
 */
export async function deleteSyncMemory(
  walletAddress: string,
  id: number
): Promise<boolean> {
  try {
    const res = await syncFetch(
      `/api/sync/memories/${id}`,
      walletAddress,
      { method: "DELETE" }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Wallet Sync ─────────────────────────────────────────────────────────────

export interface WalletSyncData {
  preferences?: {
    preferredChains?: number[];
    displayCurrency?: string;
    notifications?: boolean;
  };
  cachedBalances?: Array<{
    chainId: number;
    balance: string;
    symbol: string;
    updatedAt: number;
  }>;
}

/**
 * Fetch wallet sync data from the server.
 */
export async function fetchWalletSyncData(
  walletAddress: string
): Promise<WalletSyncData | null> {
  try {
    const res = await syncFetch("/api/sync/wallet", walletAddress);
    if (!res.ok) return null;
    const data = await res.json();
    return data.walletData || null;
  } catch {
    return null;
  }
}

/**
 * Push wallet sync data to the server.
 */
export async function pushWalletSyncData(
  walletAddress: string,
  data: WalletSyncData
): Promise<boolean> {
  try {
    const res = await syncFetch("/api/sync/wallet", walletAddress, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Sync Status ─────────────────────────────────────────────────────────────

export interface SyncStatus {
  status: string;
  dbAvailable: boolean;
  version: string;
}

/**
 * Check if the sync layer is available and healthy.
 */
export async function checkSyncStatus(): Promise<SyncStatus | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sync/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Full Sync ───────────────────────────────────────────────────────────────

/**
 * Perform a full sync: push local data to server and pull server data.
 * This is the main sync entry point called when the app opens or reconnects.
 */
export async function performFullSync(walletAddress: string): Promise<{
  synced: boolean;
  conversationCount: number;
  memoryCount: number;
}> {
  try {
    // 1. Authenticate
    const profile = await syncAuth(walletAddress);
    if (!profile?.dbAvailable) {
      return { synced: false, conversationCount: 0, memoryCount: 0 };
    }

    // 2. Fetch server data
    const [conversations, memories] = await Promise.all([
      fetchConversations(walletAddress),
      fetchMemories(walletAddress),
    ]);

    // 3. Record sync timestamp
    await AsyncStorage.setItem(SYNC_KEYS.LAST_SYNC, new Date().toISOString());

    return {
      synced: true,
      conversationCount: conversations.length,
      memoryCount: memories.length,
    };
  } catch (error) {
    console.warn("[Sync] Full sync failed:", error);
    return { synced: false, conversationCount: 0, memoryCount: 0 };
  }
}
