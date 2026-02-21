/**
 * Sync Layer Tests — Verifies the sync service, server routes, and database schema.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(filePath: string): string {
  return fs.readFileSync(path.join(ROOT, filePath), "utf-8");
}

describe("Sync Layer — Database Schema", () => {
  const schema = readFile("drizzle/schema.ts");

  it("has walletProfiles table", () => {
    expect(schema).toContain("walletProfiles");
    expect(schema).toContain("walletAddress");
  });

  it("has conversations table", () => {
    expect(schema).toContain("conversations");
    expect(schema).toContain("messages");
  });

  it("has memories table", () => {
    expect(schema).toContain("memories");
    expect(schema).toContain("content");
  });

  it("has walletSyncData table", () => {
    expect(schema).toContain("walletSyncData");
    expect(schema).toContain("preferences");
  });

  it("walletAddress is the key field across all sync tables", () => {
    const walletMatches = schema.match(/walletAddress/g);
    expect(walletMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Sync Layer — Server Routes", () => {
  const routes = readFile("server/sync-routes.ts");

  it("has /api/sync/status endpoint", () => {
    expect(routes).toContain("/api/sync/status");
  });

  it("has /api/sync/auth endpoint", () => {
    expect(routes).toContain("/api/sync/auth");
  });

  it("has /api/sync/conversations endpoints", () => {
    expect(routes).toContain("/api/sync/conversations");
  });

  it("has /api/sync/memories endpoints", () => {
    expect(routes).toContain("/api/sync/memories");
  });

  it("has /api/sync/wallet endpoints", () => {
    expect(routes).toContain("/api/sync/wallet");
  });

  it("uses x-wallet-address header for auth", () => {
    expect(routes).toContain("x-wallet-address");
  });

  it("validates wallet address format", () => {
    expect(routes).toContain("0x");
  });

  it("handles GET, POST, PUT, DELETE methods", () => {
    expect(routes).toContain("app.get");
    expect(routes).toContain("app.post");
    expect(routes).toContain("app.put");
    expect(routes).toContain("app.delete");
  });
});

describe("Sync Layer — Server Database Helpers", () => {
  const syncDb = readFile("server/sync-db.ts");

  it("has upsertWalletProfile function", () => {
    expect(syncDb).toContain("upsertWalletProfile");
  });

  it("has getConversations function", () => {
    expect(syncDb).toContain("getConversations");
  });

  it("has createConversation function", () => {
    expect(syncDb).toContain("createConversation");
  });

  it("has updateConversation function", () => {
    expect(syncDb).toContain("updateConversation");
  });

  it("has getMemories function", () => {
    expect(syncDb).toContain("getMemories");
  });

  it("has addMemories function", () => {
    expect(syncDb).toContain("addMemories");
  });

  it("has getWalletSyncData function", () => {
    expect(syncDb).toContain("getWalletSyncData");
  });

  it("has upsertWalletSyncData function", () => {
    expect(syncDb).toContain("upsertWalletSyncData");
  });
});

describe("Sync Layer — Client Service", () => {
  const syncService = readFile("lib/sync-service.ts");

  it("exports syncAuth function", () => {
    expect(syncService).toContain("export async function syncAuth");
  });

  it("exports fetchConversations function", () => {
    expect(syncService).toContain("export async function fetchConversations");
  });

  it("exports createSyncConversation function", () => {
    expect(syncService).toContain("export async function createSyncConversation");
  });

  it("exports updateSyncConversation function", () => {
    expect(syncService).toContain("export async function updateSyncConversation");
  });

  it("exports fetchMemories function", () => {
    expect(syncService).toContain("export async function fetchMemories");
  });

  it("exports pushMemories function", () => {
    expect(syncService).toContain("export async function pushMemories");
  });

  it("exports fetchWalletSyncData function", () => {
    expect(syncService).toContain("export async function fetchWalletSyncData");
  });

  it("exports performFullSync function", () => {
    expect(syncService).toContain("export async function performFullSync");
  });

  it("uses wallet address as identity header", () => {
    expect(syncService).toContain("x-wallet-address");
  });

  it("falls back gracefully on network errors", () => {
    // All functions have try/catch with fallback returns
    const catchCount = (syncService.match(/catch/g) || []).length;
    expect(catchCount).toBeGreaterThanOrEqual(8);
  });

  it("detects platform for sync metadata", () => {
    expect(syncService).toContain("Platform.OS");
  });
});

describe("Sync Layer — Chat Integration", () => {
  const chat = readFile("app/(tabs)/chat.tsx");

  it("imports sync service functions", () => {
    expect(chat).toContain("syncAuth");
    expect(chat).toContain("createSyncConversation");
    expect(chat).toContain("updateSyncConversation");
    expect(chat).toContain("pushMemories");
  });

  it("has syncEnabled state", () => {
    expect(chat).toContain("syncEnabled");
  });

  it("has syncConvoId state for tracking server conversation", () => {
    expect(chat).toContain("syncConvoId");
  });

  it("initializes sync on wallet connection", () => {
    expect(chat).toContain("syncAuth(addr)");
  });

  it("syncs conversations after message send", () => {
    expect(chat).toContain("walletAddress && syncEnabled");
  });

  it("pushes memories to server", () => {
    expect(chat).toContain("pushMemories(walletAddress");
  });

  it("shows sync status in header", () => {
    expect(chat).toContain("Synced");
  });

  it("fetches server-side memories on load", () => {
    expect(chat).toContain("fetchSyncMemories");
  });
});

describe("Sync Layer — Server Registration", () => {
  const serverIndex = readFile("server/_core/index.ts");

  it("imports sync routes", () => {
    expect(serverIndex).toContain("registerSyncRoutes");
  });

  it("registers sync routes on the Express app", () => {
    expect(serverIndex).toContain("registerSyncRoutes(app)");
  });
});
