/**
 * Sync Layer REST API Routes
 * 
 * These endpoints provide cross-platform sync for the Vaultfire ecosystem.
 * Both the web app and mobile app connect to the same endpoints.
 * 
 * Authentication: Wallet address in the `x-wallet-address` header.
 * The wallet address IS the user identity — no OAuth required.
 * 
 * Endpoints:
 *   POST   /api/sync/auth          — Register/authenticate wallet, get profile
 *   GET    /api/sync/conversations  — List all conversations
 *   GET    /api/sync/conversations/:id — Get a single conversation
 *   POST   /api/sync/conversations  — Create a new conversation
 *   PUT    /api/sync/conversations/:id — Update a conversation
 *   DELETE /api/sync/conversations/:id — Archive a conversation
 *   GET    /api/sync/memories       — List all memories
 *   POST   /api/sync/memories       — Add new memories
 *   DELETE /api/sync/memories/:id   — Delete a memory
 *   GET    /api/sync/wallet         — Get wallet sync data
 *   PUT    /api/sync/wallet         — Update wallet sync data
 *   GET    /api/sync/status         — Sync health check
 */
import type { Express, Request, Response, NextFunction } from "express";
import * as syncDb from "./sync-db";

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Extracts and validates the wallet address from the request header.
 * Returns 401 if no wallet address is provided.
 */
function requireWallet(req: Request, res: Response, next: NextFunction) {
  const walletAddress = req.headers["x-wallet-address"] as string;

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    res.status(401).json({
      error: "Valid wallet address required in x-wallet-address header",
    });
    return;
  }

  // Attach to request for downstream handlers
  (req as any).walletAddress = walletAddress.toLowerCase();
  next();
}

// ─── Route Registration ──────────────────────────────────────────────────────

export function registerSyncRoutes(app: Express) {
  // ── Auth / Profile ──────────────────────────────────────────────────────

  /**
   * POST /api/sync/auth
   * Register or authenticate a wallet. Creates profile if new.
   * Body: { platform: "web" | "mobile", displayName?: string }
   */
  app.post("/api/sync/auth", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const { platform = "mobile", displayName } = req.body || {};

      const profile = await syncDb.upsertWalletProfile(
        walletAddress,
        platform,
        displayName
      );

      if (!profile) {
        res.json({
          success: true,
          profile: { walletAddress, lastPlatform: platform },
          dbAvailable: false,
        });
        return;
      }

      res.json({ success: true, profile, dbAvailable: true });
    } catch (error) {
      console.error("[Sync] Auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // ── Conversations ───────────────────────────────────────────────────────

  /**
   * GET /api/sync/conversations
   * List all active conversations for the authenticated wallet.
   * Query: ?limit=50
   */
  app.get("/api/sync/conversations", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const limit = parseInt(req.query.limit as string) || 50;

      const convos = await syncDb.getConversations(walletAddress, limit);
      res.json({ conversations: convos });
    } catch (error) {
      console.error("[Sync] List conversations error:", error);
      res.status(500).json({ error: "Failed to list conversations" });
    }
  });

  /**
   * GET /api/sync/conversations/:id
   * Get a single conversation by ID.
   */
  app.get("/api/sync/conversations/:id", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid conversation ID" });
        return;
      }

      const convo = await syncDb.getConversation(id, walletAddress);
      if (!convo) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      res.json({ conversation: convo });
    } catch (error) {
      console.error("[Sync] Get conversation error:", error);
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  /**
   * POST /api/sync/conversations
   * Create a new conversation.
   * Body: { title: string, messages: Array<{role, content, timestamp}>, platform: string }
   */
  app.post("/api/sync/conversations", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const { title, messages, platform = "mobile" } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      const result = await syncDb.createConversation(
        walletAddress,
        title || "New Conversation",
        messages,
        platform
      );

      res.json({ success: true, conversation: result });
    } catch (error) {
      console.error("[Sync] Create conversation error:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  /**
   * PUT /api/sync/conversations/:id
   * Update an existing conversation (add messages, change title).
   * Body: { messages: Array<{role, content, timestamp}>, title?: string, platform?: string }
   */
  app.put("/api/sync/conversations/:id", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const id = parseInt(req.params.id);
      const { messages, title, platform } = req.body;

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid conversation ID" });
        return;
      }

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      const success = await syncDb.updateConversation(
        id,
        walletAddress,
        messages,
        title,
        platform
      );

      res.json({ success });
    } catch (error) {
      console.error("[Sync] Update conversation error:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  /**
   * DELETE /api/sync/conversations/:id
   * Archive a conversation (soft delete).
   */
  app.delete("/api/sync/conversations/:id", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid conversation ID" });
        return;
      }

      const success = await syncDb.archiveConversation(id, walletAddress);
      res.json({ success });
    } catch (error) {
      console.error("[Sync] Archive conversation error:", error);
      res.status(500).json({ error: "Failed to archive conversation" });
    }
  });

  // ── Memories ────────────────────────────────────────────────────────────

  /**
   * GET /api/sync/memories
   * List all memories for the authenticated wallet.
   * Query: ?limit=100
   */
  app.get("/api/sync/memories", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const limit = parseInt(req.query.limit as string) || 100;

      const mems = await syncDb.getMemories(walletAddress, limit);
      res.json({ memories: mems });
    } catch (error) {
      console.error("[Sync] List memories error:", error);
      res.status(500).json({ error: "Failed to list memories" });
    }
  });

  /**
   * POST /api/sync/memories
   * Add new memories.
   * Body: { memories: Array<{content: string, category?: string}>, platform?: string }
   */
  app.post("/api/sync/memories", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const { memories: newMemories, platform = "mobile" } = req.body;

      if (!newMemories || !Array.isArray(newMemories)) {
        res.status(400).json({ error: "memories array is required" });
        return;
      }

      const result = await syncDb.addMemories(walletAddress, newMemories, platform);
      res.json({ success: true, count: result.length });
    } catch (error) {
      console.error("[Sync] Add memories error:", error);
      res.status(500).json({ error: "Failed to add memories" });
    }
  });

  /**
   * DELETE /api/sync/memories/:id
   * Delete a specific memory.
   */
  app.delete("/api/sync/memories/:id", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid memory ID" });
        return;
      }

      const success = await syncDb.deleteMemory(id, walletAddress);
      res.json({ success });
    } catch (error) {
      console.error("[Sync] Delete memory error:", error);
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  // ── Wallet Sync ─────────────────────────────────────────────────────────

  /**
   * GET /api/sync/wallet
   * Get wallet sync data (preferences, cached balances).
   */
  app.get("/api/sync/wallet", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const data = await syncDb.getWalletSyncData(walletAddress);
      res.json({ walletData: data });
    } catch (error) {
      console.error("[Sync] Get wallet data error:", error);
      res.status(500).json({ error: "Failed to get wallet data" });
    }
  });

  /**
   * PUT /api/sync/wallet
   * Update wallet sync data.
   * Body: { preferences?: object, cachedBalances?: Array<{chainId, balance, symbol, updatedAt}> }
   */
  app.put("/api/sync/wallet", requireWallet, async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const { preferences, cachedBalances } = req.body;

      const success = await syncDb.upsertWalletSyncData(
        walletAddress,
        preferences,
        cachedBalances
      );

      res.json({ success });
    } catch (error) {
      console.error("[Sync] Update wallet data error:", error);
      res.status(500).json({ error: "Failed to update wallet data" });
    }
  });

  // ── Health Check ────────────────────────────────────────────────────────

  /**
   * GET /api/sync/status
   * Sync layer health check. Returns DB availability and endpoint list.
   */
  app.get("/api/sync/status", async (_req: Request, res: Response) => {
    try {
      const { getDb } = await import("./db");
      const db = await getDb();

      res.json({
        status: "ok",
        dbAvailable: !!db,
        version: "1.0.0",
        endpoints: {
          auth: "POST /api/sync/auth",
          conversations: {
            list: "GET /api/sync/conversations",
            get: "GET /api/sync/conversations/:id",
            create: "POST /api/sync/conversations",
            update: "PUT /api/sync/conversations/:id",
            archive: "DELETE /api/sync/conversations/:id",
          },
          memories: {
            list: "GET /api/sync/memories",
            add: "POST /api/sync/memories",
            delete: "DELETE /api/sync/memories/:id",
          },
          wallet: {
            get: "GET /api/sync/wallet",
            update: "PUT /api/sync/wallet",
          },
        },
      });
    } catch (error) {
      res.status(500).json({ status: "error", error: "Sync service unavailable" });
    }
  });
}
