import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message } from "./_core/llm";
import { z } from "zod";
import { getDb } from "./db";
import { conversations, messages, emberMemories, userSessions } from "../drizzle/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import {
  emberSendMessageLimiter,
  emberQuickSendLimiter,
  RateLimitError,
} from "./_core/rateLimit";

const EMBRIS_SYSTEM_PROMPT = `You are Ember, the AI assistant for Vaultfire Protocol — a Web3 trust and identity platform built on Ethereum, Base, and Avalanche. You help users understand trust verification, cross-chain bridges, AI partnership bonds, belief attestations, reputation scores, and governance.

Your personality: warm, knowledgeable, concise. You speak with confidence about blockchain concepts but remain approachable. You use markdown formatting for clarity. When you don't know something, you say so honestly.

Key Vaultfire concepts you know about:
- ERC-8004: Vaultfire's custom identity/reputation standard on Base
- Trust Verification: On-chain identity verification system
- Cross-Chain Bridge: Teleporter bridge between Ethereum, Base, and Avalanche
- AI Partnership Bonds: Smart contracts binding AI agents to accountability
- Belief Attestations: On-chain attestations of trust and belief
- Multisig Governance: Decentralized protocol governance
- Flourishing Metrics Oracle: On-chain oracle for human flourishing data

DEPLOYED CONTRACTS (Base - Chain ID 8453):
- MissionEnforcement: 0x38165D2D7a8584985CCa5640f4b32b1f3347CC83
- AntiSurveillance: 0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C
- PrivacyGuarantees: 0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55
- ERC8004IdentityRegistry: 0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5
- BeliefAttestationVerifier: 0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF
- AIPartnershipBondsV2: 0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1
- FlourishingMetricsOracle: 0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1
- AIAccountabilityBondsV2: 0xDfc66395A4742b5168712a04942C90B99394aEEb
- ERC8004ReputationRegistry: 0x544B575431ECD927bA83E85008446fA1e100204a
- ERC8004ValidationRegistry: 0x501fE0f960c1e061C4d295Af241f9F1512775556
- VaultfireERC8004Adapter: 0x5470d8189849675C043fFA7fc451e5F2f4e5532c
- MultisigGovernance: 0xea0A6750642AA294658dC9f1eDf36b95D21e7B22
- ProductionBeliefAttestationVerifier: 0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B
- VaultfireTeleporterBridge: 0xFe122605364f428570c4C0EB2CCAEBb68dD22d05

DEPLOYED CONTRACTS (Avalanche C-Chain - Chain ID 43114):
- MissionEnforcement: 0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709
- AntiSurveillance: 0xaCB59e0f0eA47B25b24390B71b877928E5842630
- PrivacyGuarantees: 0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C
- ERC8004IdentityRegistry: 0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5
- BeliefAttestationVerifier: 0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55
- AIPartnershipBondsV2: 0x37679B1dCfabE6eA6b8408626815A1426bE2D717
- FlourishingMetricsOracle: 0x83b2D1a8e383c4239dE66b6614176636618c1c0A
- AIAccountabilityBondsV2: 0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192
- ERC8004ReputationRegistry: 0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5
- ERC8004ValidationRegistry: 0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF
- VaultfireERC8004Adapter: 0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1
- MultisigGovernance: 0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1
- ProductionBeliefAttestationVerifier: 0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1
- VaultfireTeleporterBridge: 0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf

Always be helpful and guide users through the Vaultfire ecosystem.`;

/**
 * Build a time-aware greeting prefix based on how long since the user's last message.
 */
function getTimeAwareGreeting(lastSeen: Date | null): string | null {
  if (!lastSeen) return null;
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 4) return null; // Recent — no special greeting

  const hour = now.getHours();
  let timeOfDay = "evening";
  if (hour >= 5 && hour < 12) timeOfDay = "morning";
  else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";

  if (diffHours >= 72) {
    return `It's been a few days since we last talked! Good ${timeOfDay}. I'm glad you're back.`;
  } else if (diffHours >= 24) {
    return `Good ${timeOfDay}! It's been about a day since we chatted. Welcome back.`;
  } else {
    return `Good ${timeOfDay}! It's been a while since our last conversation.`;
  }
}

/**
 * Build the memory context block to inject into the system prompt.
 */
function buildMemoryContext(memories: { category: string; fact: string }[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- [${m.category}] ${m.fact}`);
  return `\n\nYou remember the following about this user from previous conversations:\n${lines.join("\n")}\n\nUse this knowledge naturally in conversation. Don't list everything — just be aware of it and reference relevant facts when appropriate.`;
}

/**
 * Extract key facts from a conversation exchange using a second LLM call.
 * Returns an array of {category, fact} objects.
 */
async function extractMemories(
  userMessage: string,
  assistantMessage: string
): Promise<{ category: string; fact: string }[]> {
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a memory extraction system. Analyze the user's message and extract key personal facts about the user. Only extract facts the USER reveals about themselves — not questions they ask.

Categories: name, preference, interest, goal, wallet, location, occupation, other

Output ONLY valid JSON: an array of objects like [{"category":"name","fact":"User's name is Alex"}]
If there are no personal facts to extract, output an empty array: []
Do NOT extract facts about the AI assistant. Only about the user.`,
        },
        {
          role: "user",
          content: `User said: "${userMessage}"\n\nAssistant replied: "${assistantMessage.slice(0, 500)}"`,
        },
      ],
      maxTokens: 300,
    });

    const raw = typeof result.choices?.[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "[]";

    // Extract JSON array from the response (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: unknown): item is { category: string; fact: string } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).category === "string" &&
          typeof (item as Record<string, unknown>).fact === "string"
      )
      .slice(0, 5); // Max 5 facts per exchange
  } catch (err) {
    console.warn("[Memory] Failed to extract memories:", err);
    return [];
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  ember: router({
    /** Send a message to Ember AI and get a response */
    sendMessage: protectedProcedure
      .input(
        z.object({
          conversationId: z.number(),
          content: z.string().min(1).max(4000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Rate limit: 20 requests per minute per user
        try {
          emberSendMessageLimiter.check(`user:${ctx.user.id}`);
        } catch (err) {
          if (err instanceof RateLimitError) {
            throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(err.retryAfterMs / 1000)}s.`);
          }
          throw err;
        }

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verify conversation belongs to user
        const [conv] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conv) throw new Error("Conversation not found");

        // Save user message
        await db.insert(messages).values({
          conversationId: input.conversationId,
          role: "user",
          content: input.content,
        });

        // --- TIME-AWARENESS: Check last seen ---
        let timeGreeting: string | null = null;
        try {
          const [session] = await db
            .select()
            .from(userSessions)
            .where(eq(userSessions.userId, ctx.user.id))
            .limit(1);
          timeGreeting = getTimeAwareGreeting(session?.lastSeen ?? null);

          // Update last_seen to now
          if (session) {
            await db
              .update(userSessions)
              .set({ lastSeen: new Date() })
              .where(eq(userSessions.userId, ctx.user.id));
          } else {
            await db.insert(userSessions).values({ userId: ctx.user.id });
          }
        } catch (err) {
          console.warn("[Session] Failed to track session:", err);
        }

        // --- CONTEXT INJECTION: Fetch memories ---
        let memoryContext = "";
        try {
          const memories = await db
            .select({ category: emberMemories.category, fact: emberMemories.fact })
            .from(emberMemories)
            .where(eq(emberMemories.userId, ctx.user.id))
            .limit(50);
          memoryContext = buildMemoryContext(memories);
        } catch (err) {
          console.warn("[Memory] Failed to fetch memories:", err);
        }

        // Build system prompt with memory + time awareness
        let systemPrompt = EMBRIS_SYSTEM_PROMPT + memoryContext;
        if (timeGreeting) {
          systemPrompt += `\n\nIMPORTANT: The user hasn't messaged in a while. Start your response with a warm greeting: "${timeGreeting}" — then answer their question normally.`;
        }

        // Load recent messages for context (last 20)
        const recentMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(desc(messages.id))
          .limit(20);

        const llmMessages: Message[] = [
          { role: "system", content: systemPrompt },
          ...recentMessages.reverse().map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
        ];

        const result = await invokeLLM({
          messages: llmMessages,
          maxTokens: 2048,
        });

        const assistantContent =
          typeof result.choices?.[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "I'm sorry, I couldn't generate a response. Please try again.";

        // Save assistant message
        await db.insert(messages).values({
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantContent,
        });

        // --- MEMORY EXTRACTION: Extract facts in background ---
        extractMemories(input.content, assistantContent).then(async (facts) => {
          if (facts.length === 0) return;
          try {
            const db2 = await getDb();
            if (!db2) return;
            for (const fact of facts) {
              await db2.insert(emberMemories).values({
                userId: ctx.user.id,
                category: fact.category,
                fact: fact.fact,
              });
            }
            console.log(`[Memory] Stored ${facts.length} memories for user ${ctx.user.id}`);
          } catch (err) {
            console.warn("[Memory] Failed to store memories:", err);
          }
        });

        // Auto-title: if this is the first user message, generate a title
        const allMsgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .limit(5);
        const userMsgs = allMsgs.filter((m) => m.role === "user");
        if (userMsgs.length === 1) {
          const titleResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "Generate a very short title (3-6 words, no quotes) for a conversation that starts with this message. Just output the title, nothing else.",
              },
              { role: "user", content: input.content },
            ],
            maxTokens: 30,
          });
          const title =
            typeof titleResult.choices?.[0]?.message?.content === "string"
              ? titleResult.choices[0].message.content.slice(0, 255)
              : "New Conversation";
          await db
            .update(conversations)
            .set({ title })
            .where(eq(conversations.id, input.conversationId));
        }

        return { content: assistantContent };
      }),

    /** Quick send for the floating chat (no conversation persistence) */
    quickSend: protectedProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant", "system"]),
              content: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Rate limit: 10 requests per minute per user
        try {
          emberQuickSendLimiter.check(`user:${ctx.user.id}`);
        } catch (err) {
          if (err instanceof RateLimitError) {
            throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(err.retryAfterMs / 1000)}s.`);
          }
          throw err;
        }

        const llmMessages: Message[] = [
          { role: "system", content: EMBRIS_SYSTEM_PROMPT },
          ...input.messages,
        ];
        const result = await invokeLLM({
          messages: llmMessages,
          maxTokens: 2048,
        });
        const content =
          typeof result.choices?.[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "I'm sorry, I couldn't generate a response.";
        return { content };
      }),

    /** List conversations for the current user */
    listConversations: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, ctx.user.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(50);
      return rows;
    }),

    /** Create a new conversation */
    createConversation: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(conversations).values({
        userId: ctx.user.id,
        title: "New Conversation",
      }).$returningId();
      return { id: result.id, title: "New Conversation" };
    }),

    /** Delete a conversation and its messages */
    deleteConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [conv] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.id),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conv) throw new Error("Conversation not found");
        await db.delete(messages).where(eq(messages.conversationId, input.id));
        await db.delete(conversations).where(eq(conversations.id, input.id));
        return { success: true };
      }),

    /** Get messages for a conversation */
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const [conv] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conv) return [];
        const rows = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(asc(messages.createdAt))
          .limit(200);
        return rows;
      }),

    /** List all memories for the current user */
    listMemories: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(emberMemories)
        .where(eq(emberMemories.userId, ctx.user.id))
        .orderBy(desc(emberMemories.createdAt))
        .limit(100);
      return rows;
    }),

    /** Delete a single memory */
    deleteMemory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Verify ownership
        const [mem] = await db
          .select()
          .from(emberMemories)
          .where(
            and(
              eq(emberMemories.id, input.id),
              eq(emberMemories.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!mem) throw new Error("Memory not found");
        await db.delete(emberMemories).where(eq(emberMemories.id, input.id));
        return { success: true };
      }),

    /** Clear all memories for the current user */
    clearAllMemories: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(emberMemories).where(eq(emberMemories.userId, ctx.user.id));
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
