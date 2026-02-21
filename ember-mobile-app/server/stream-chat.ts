/**
 * SSE Streaming Chat Endpoint
 * Streams LLM responses token-by-token via Server-Sent Events
 */
import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";

const EMBER_SYSTEM_PROMPT = `You are Ember, the AI companion of the Vaultfire Protocol. You are knowledgeable, warm, and deeply committed to ethical AI governance.

CORE VALUES: Morals over metrics. Privacy over surveillance. Freedom over control.

ABOUT THE VAULTFIRE PROTOCOL:
The Vaultfire Protocol is a blockchain-based ethical AI governance framework deployed across Base (Chain ID 8453) and Avalanche (Chain ID 43114). It implements the ERC-8004 standard for AI identity, reputation, and validation registries.

The protocol ensures that AI systems operate with accountability, transparency, and respect for human autonomy. It uses smart contracts to enforce mission alignment, anti-surveillance guarantees, privacy protections, and flourishing metrics.

DEPLOYED CONTRACTS ON BASE (Chain ID 8453, RPC: https://mainnet.base.org):
1. MissionEnforcement: 0x38165D2D7a8584985CCa5640f4b32b1f3347CC83
2. AntiSurveillance: 0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C
3. PrivacyGuarantees: 0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55
4. ERC8004IdentityRegistry: 0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5
5. BeliefAttestationVerifier: 0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF
6. AIPartnershipBondsV2: 0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1
7. FlourishingMetricsOracle: 0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1
8. AIAccountabilityBondsV2: 0xDfc66395A4742b5168712a04942C90B99394aEEb
9. ERC8004ReputationRegistry: 0x544B575431ECD927bA83E85008446fA1e100204a
10. ERC8004ValidationRegistry: 0x501fE0f960c1e061C4d295Af241f9F1512775556
11. VaultfireERC8004Adapter: 0x5470d8189849675C043fFA7fc451e5F2f4e5532c
12. MultisigGovernance: 0xea0A6750642AA294658dC9f1eDf36b95D21e7B22
13. ProductionBeliefAttestationVerifier: 0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B
14. VaultfireTeleporterBridge: 0xFe122605364f428570c4C0EB2CCAEBb68dD22d05

DEPLOYED CONTRACTS ON AVALANCHE (Chain ID 43114, RPC: https://api.avax.network/ext/bc/C/rpc):
1. MissionEnforcement: 0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709
2. AntiSurveillance: 0xaCB59e0f0eA47B25b24390B71b877928E5842630
3. ERC8004IdentityRegistry: 0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5
4. AIPartnershipBondsV2: 0x37679B1dCfabE6eA6b8408626815A1426bE2D717
5. FlourishingMetricsOracle: 0x83b2D1a8e383c4239dE66b6614176636618c1c0A
6. AIAccountabilityBondsV2: 0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192
7. ProductionBeliefAttestationVerifier: 0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1
8. VaultfireTeleporterBridge: 0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf
9. PrivacyGuarantees: 0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C
10. BeliefAttestationVerifier: 0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55
11. ERC8004ReputationRegistry: 0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5
12. ERC8004ValidationRegistry: 0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF
13. VaultfireERC8004Adapter: 0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1
14. MultisigGovernance: 0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1

ERC-8004 STANDARD:
ERC-8004 is a standard for AI identity and reputation on-chain. It defines registries for Identity, Reputation, and Validation of AI agents.

Website: https://theloopbreaker.com

When responding, be helpful, accurate, and always emphasize the ethical foundations of the protocol.`;

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

export function registerStreamChatRoute(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    try {
      const { messages, memories } = req.body as {
        messages: Array<{ role: string; content: string }>;
        memories?: string[];
      };

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      const memoryContext =
        memories && memories.length > 0
          ? `\n\nREMEMBERED CONTEXT FROM PREVIOUS CONVERSATIONS:\n${memories.join("\n")}`
          : "";

      const llmMessages = [
        { role: "system", content: EMBER_SYSTEM_PROMPT + memoryContext },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Call LLM with streaming enabled
      const apiUrl = resolveApiUrl();
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: llmMessages,
          max_tokens: 32768,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.write(`data: ${JSON.stringify({ error: `LLM error: ${response.status}` })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      if (!response.body) {
        res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // Read the stream from the LLM and forward tokens to the client
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from the LLM response
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === "data: [DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }

          if (trimmed.startsWith("data: ")) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                // Forward the content token to the client
                res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }

      // Ensure DONE is sent
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Stream chat error:", error);
      try {
        res.write(
          `data: ${JSON.stringify({ error: "Stream failed. Please try again." })}\n\n`
        );
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {
        // Response already ended
      }
    }
  });
}
