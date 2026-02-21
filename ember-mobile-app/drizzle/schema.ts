import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Vaultfire Sync Layer ────────────────────────────────────────────────────
// Wallet address is the universal user identity across web and mobile.
// No OAuth required — the wallet address itself is the authentication key.

/**
 * Wallet profiles — links a wallet address to user preferences and metadata.
 * This is the "user" concept for Vaultfire: your wallet IS your identity.
 */
export const walletProfiles = mysqlTable("wallet_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Ethereum wallet address (0x...) — the universal user ID */
  walletAddress: varchar("walletAddress", { length: 42 }).notNull().unique(),
  /** Optional display name */
  displayName: varchar("displayName", { length: 100 }),
  /** Last platform used: "web" | "mobile" */
  lastPlatform: varchar("lastPlatform", { length: 20 }),
  /** Last seen timestamp */
  lastSeen: timestamp("lastSeen").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WalletProfile = typeof walletProfiles.$inferSelect;
export type InsertWalletProfile = typeof walletProfiles.$inferInsert;

/**
 * Conversations — stores full chat history keyed by wallet address.
 * Each conversation has a title and array of messages.
 * Both web and mobile apps read/write to the same conversations.
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  /** Wallet address that owns this conversation */
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  /** Conversation title (auto-generated from first message or user-set) */
  title: varchar("title", { length: 255 }).notNull().default("New Conversation"),
  /** JSON array of { role: "user"|"assistant", content: string, timestamp: number } */
  messages: json("messages").notNull().$type<Array<{ role: string; content: string; timestamp: number }>>(),
  /** Whether this conversation is active or archived */
  isActive: boolean("isActive").default(true).notNull(),
  /** Platform where conversation was last updated */
  lastPlatform: varchar("lastPlatform", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Memories — stores Ember's extracted memories about the user.
 * These persist across conversations and platforms.
 * Ember uses these to provide personalized, context-aware responses.
 */
export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  /** Wallet address this memory belongs to */
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  /** The memory content (e.g., "User is interested in governance proposals") */
  content: text("content").notNull(),
  /** Memory category: preference, fact, interaction, context */
  category: varchar("category", { length: 50 }).default("general"),
  /** Source conversation ID (nullable — some memories may be manual) */
  sourceConversationId: int("sourceConversationId"),
  /** Platform where memory was extracted */
  sourcePlatform: varchar("sourcePlatform", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert;

/**
 * Wallet sync data — stores wallet-related preferences that sync across platforms.
 * Not private keys (those stay on-device) — just display preferences and chain configs.
 */
export const walletSyncData = mysqlTable("wallet_sync_data", {
  id: int("id").autoincrement().primaryKey(),
  /** Wallet address */
  walletAddress: varchar("walletAddress", { length: 42 }).notNull().unique(),
  /** JSON object with preferred chains, display currency, etc. */
  preferences: json("preferences").$type<{
    preferredChains?: number[];
    displayCurrency?: string;
    notifications?: boolean;
  }>(),
  /** Last known balances (cached for quick display) */
  cachedBalances: json("cachedBalances").$type<Array<{
    chainId: number;
    balance: string;
    symbol: string;
    updatedAt: number;
  }>>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WalletSyncData = typeof walletSyncData.$inferSelect;
export type InsertWalletSyncData = typeof walletSyncData.$inferInsert;
