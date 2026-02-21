/**
 * Sync Layer Database Queries
 * Provides CRUD operations for conversations, memories, and wallet profiles.
 * All data is keyed by wallet address — the universal Vaultfire identity.
 */
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  conversations,
  memories,
  walletProfiles,
  walletSyncData,
  type InsertConversation,
  type InsertMemory,
  type InsertWalletProfile,
} from "../drizzle/schema";

// ─── Wallet Profiles ─────────────────────────────────────────────────────────

export async function upsertWalletProfile(
  walletAddress: string,
  platform: string,
  displayName?: string
) {
  const db = await getDb();
  if (!db) return null;

  const addr = walletAddress.toLowerCase();
  const existing = await db
    .select()
    .from(walletProfiles)
    .where(eq(walletProfiles.walletAddress, addr))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(walletProfiles)
      .set({
        lastPlatform: platform,
        lastSeen: new Date(),
        ...(displayName ? { displayName } : {}),
      })
      .where(eq(walletProfiles.walletAddress, addr));
    return { ...existing[0], lastPlatform: platform, lastSeen: new Date() };
  }

  await db.insert(walletProfiles).values({
    walletAddress: addr,
    displayName: displayName || null,
    lastPlatform: platform,
    lastSeen: new Date(),
  });

  const created = await db
    .select()
    .from(walletProfiles)
    .where(eq(walletProfiles.walletAddress, addr))
    .limit(1);
  return created[0] || null;
}

export async function getWalletProfile(walletAddress: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(walletProfiles)
    .where(eq(walletProfiles.walletAddress, walletAddress.toLowerCase()))
    .limit(1);
  return result[0] || null;
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function getConversations(walletAddress: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.walletAddress, walletAddress.toLowerCase()),
        eq(conversations.isActive, true)
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversation(id: number, walletAddress: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.walletAddress, walletAddress.toLowerCase())
      )
    )
    .limit(1);
  return result[0] || null;
}

export async function createConversation(
  walletAddress: string,
  title: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  platform: string
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(conversations).values({
    walletAddress: walletAddress.toLowerCase(),
    title,
    messages: messages,
    lastPlatform: platform,
  });

  return { id: result[0].insertId };
}

export async function updateConversation(
  id: number,
  walletAddress: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  title?: string,
  platform?: string
) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(conversations)
    .set({
      messages: messages,
      ...(title ? { title } : {}),
      ...(platform ? { lastPlatform: platform } : {}),
    })
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.walletAddress, walletAddress.toLowerCase())
      )
    );
  return true;
}

export async function archiveConversation(id: number, walletAddress: string) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(conversations)
    .set({ isActive: false })
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.walletAddress, walletAddress.toLowerCase())
      )
    );
  return true;
}

// ─── Memories ────────────────────────────────────────────────────────────────

export async function getMemories(walletAddress: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(memories)
    .where(eq(memories.walletAddress, walletAddress.toLowerCase()))
    .orderBy(desc(memories.createdAt))
    .limit(limit);
}

export async function addMemory(
  walletAddress: string,
  content: string,
  category: string = "general",
  sourceConversationId?: number,
  sourcePlatform?: string
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(memories).values({
    walletAddress: walletAddress.toLowerCase(),
    content,
    category,
    sourceConversationId: sourceConversationId || null,
    sourcePlatform: sourcePlatform || null,
  });

  return { id: result[0].insertId };
}

export async function addMemories(
  walletAddress: string,
  items: Array<{ content: string; category?: string }>,
  sourcePlatform?: string
) {
  const db = await getDb();
  if (!db) return [];

  const values = items.map((item) => ({
    walletAddress: walletAddress.toLowerCase(),
    content: item.content,
    category: item.category || "general",
    sourcePlatform: sourcePlatform || null,
  }));

  if (values.length === 0) return [];

  await db.insert(memories).values(values);
  return values;
}

export async function deleteMemory(id: number, walletAddress: string) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(memories)
    .where(
      and(
        eq(memories.id, id),
        eq(memories.walletAddress, walletAddress.toLowerCase())
      )
    );
  return true;
}

// ─── Wallet Sync Data ────────────────────────────────────────────────────────

export async function getWalletSyncData(walletAddress: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(walletSyncData)
    .where(eq(walletSyncData.walletAddress, walletAddress.toLowerCase()))
    .limit(1);
  return result[0] || null;
}

export async function upsertWalletSyncData(
  walletAddress: string,
  preferences?: Record<string, unknown>,
  cachedBalances?: Array<{ chainId: number; balance: string; symbol: string; updatedAt: number }>
) {
  const db = await getDb();
  if (!db) return null;

  const addr = walletAddress.toLowerCase();
  const existing = await db
    .select()
    .from(walletSyncData)
    .where(eq(walletSyncData.walletAddress, addr))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(walletSyncData)
      .set({
        ...(preferences ? { preferences } : {}),
        ...(cachedBalances ? { cachedBalances } : {}),
      })
      .where(eq(walletSyncData.walletAddress, addr));
    return true;
  }

  await db.insert(walletSyncData).values({
    walletAddress: addr,
    preferences: preferences || {},
    cachedBalances: cachedBalances || [],
  });
  return true;
}
