import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message } from "./_core/llm";
import { z } from "zod";
import { getDb } from "./db";
import { conversations, messages } from "../drizzle/schema";
import { eq, desc, and, asc } from "drizzle-orm";

const EMBER_SYSTEM_PROMPT = `You are Ember, the AI assistant for Vaultfire Protocol — a Web3 trust and identity platform built on Base and Avalanche. You help users understand trust verification, cross-chain bridges, AI partnership bonds, belief attestations, reputation scores, and governance.

Your personality: warm, knowledgeable, concise. You speak with confidence about blockchain concepts but remain approachable. You use markdown formatting for clarity. When you don't know something, you say so honestly.

Key Vaultfire concepts you know about:
- ERC-8004: Vaultfire's custom identity/reputation standard on Base
- Trust Verification: On-chain identity verification system
- Cross-Chain Bridge: Teleporter bridge between Base and Avalanche
- AI Partnership Bonds: Smart contracts binding AI agents to accountability
- Belief Attestations: On-chain attestations of trust and belief
- Multisig Governance: Decentralized protocol governance
- Flourishing Metrics Oracle: On-chain oracle for human flourishing data

Always be helpful and guide users through the Vaultfire ecosystem.`;

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

        // Load recent messages for context (last 20)
        const recentMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .orderBy(desc(messages.id))
          .limit(20);

        const llmMessages: Message[] = [
          { role: "system", content: EMBER_SYSTEM_PROMPT },
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

        // Auto-title: if this is the first user message, generate a title
        const allMsgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, input.conversationId))
          .limit(5);
        const userMsgs = allMsgs.filter((m) => m.role === "user");
        if (userMsgs.length === 1) {
          // Generate a short title from the first message
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
      .mutation(async ({ input }) => {
        const llmMessages: Message[] = [
          { role: "system", content: EMBER_SYSTEM_PROMPT },
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
        // Verify ownership
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
        // Verify ownership
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
  }),
});

export type AppRouter = typeof appRouter;
