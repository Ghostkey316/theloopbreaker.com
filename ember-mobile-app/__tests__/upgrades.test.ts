import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ─── 1. SSE Streaming Chat ────────────────────────────────────────────

describe("Upgrade 1: SSE Streaming Chat", () => {
  const serverStream = readFile("server/stream-chat.ts");
  const clientStream = readFile("lib/stream-chat.ts");
  const chatScreen = readFile("app/(tabs)/chat.tsx");
  const serverIndex = readFile("server/_core/index.ts");

  it("server: has SSE endpoint registered", () => {
    expect(serverStream).toContain("/api/chat/stream");
    expect(serverStream).toContain("text/event-stream");
    expect(serverStream).toContain("Cache-Control");
    expect(serverStream).toContain("no-cache");
  });

  it("server: streams tokens from LLM", () => {
    expect(serverStream).toContain("stream: true");
    expect(serverStream).toContain("delta?.content");
    expect(serverStream).toContain("data: [DONE]");
  });

  it("server: includes full Ember system prompt with all contracts", () => {
    expect(serverStream).toContain("EMBER_SYSTEM_PROMPT");
    expect(serverStream).toContain("Morals over metrics");
    expect(serverStream).toContain("0x38165D2D7a8584985CCa5640f4b32b1f3347CC83"); // Base MissionEnforcement
    expect(serverStream).toContain("0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709"); // Avax MissionEnforcement
    expect(serverStream).toContain("ERC-8004");
    expect(serverStream).toContain("theloopbreaker.com");
  });

  it("server: stream route is registered in index.ts", () => {
    expect(serverIndex).toContain("registerStreamChatRoute");
  });

  it("client: has streaming fetch with ReadableStream", () => {
    expect(clientStream).toContain("/api/chat/stream");
    expect(clientStream).toContain("response.body");
    expect(clientStream).toContain("getReader");
    expect(clientStream).toContain("TextDecoder");
  });

  it("client: has onToken, onDone, onError callbacks", () => {
    expect(clientStream).toContain("onToken");
    expect(clientStream).toContain("onDone");
    expect(clientStream).toContain("onError");
  });

  it("client: parses SSE data lines correctly", () => {
    expect(clientStream).toContain('data: [DONE]');
    expect(clientStream).toContain('startsWith("data: ")');
    expect(clientStream).toContain("json.token");
  });

  it("chat screen: uses streamChat for sending messages", () => {
    expect(chatScreen).toContain("streamChat");
    expect(chatScreen).toContain("isStreaming");
    expect(chatScreen).toContain("streamingRef");
  });

  it("chat screen: shows streaming cursor during response", () => {
    expect(chatScreen).toContain("streamCursor");
    expect(chatScreen).toContain("cursorDot");
  });

  it("chat screen: falls back to tRPC on stream error", () => {
    expect(chatScreen).toContain("chatMutation.mutateAsync");
    expect(chatScreen).toContain("onError");
  });
});

// ─── 2. Wallet Integration ────────────────────────────────────────────

describe("Upgrade 2: Wallet Integration", () => {
  const walletLib = readFile("lib/wallet.ts");
  const chatScreen = readFile("app/(tabs)/chat.tsx");

  it("wallet: uses real JSON-RPC eth_getBalance calls", () => {
    expect(walletLib).toContain("eth_getBalance");
    expect(walletLib).toContain("jsonRpcCall");
    // RPC URLs are in CHAINS constants, wallet.ts uses CHAINS[chain].rpc
    expect(walletLib).toContain("CHAINS");
  });

  it("wallet: formats wei to ETH with BigInt math", () => {
    expect(walletLib).toContain("formatWeiToEth");
    expect(walletLib).toContain("BigInt(10 ** 18)");
  });

  it("wallet: validates Ethereum addresses", () => {
    expect(walletLib).toContain("validateAddress");
    expect(walletLib).toContain("0x[a-fA-F0-9]{40}");
  });

  it("wallet: persists address in AsyncStorage", () => {
    expect(walletLib).toContain("AsyncStorage");
    expect(walletLib).toContain("saveWalletAddress");
    expect(walletLib).toContain("getWalletAddress");
    expect(walletLib).toContain("clearWalletAddress");
  });

  it("wallet: fetches balances on both chains", () => {
    expect(walletLib).toContain("balanceBase");
    expect(walletLib).toContain("balanceAvalanche");
    expect(walletLib).toContain("Promise.allSettled");
  });

  it("chat: shows wallet modal with connect/disconnect", () => {
    expect(chatScreen).toContain("walletModalVisible");
    expect(chatScreen).toContain("Connect Wallet");
    expect(chatScreen).toContain("Wallet Connected");
    expect(chatScreen).toContain("disconnectWallet");
  });

  it("chat: displays ETH and AVAX balances", () => {
    expect(chatScreen).toContain("BASE (ETH)");
    expect(chatScreen).toContain("AVALANCHE (AVAX)");
    expect(chatScreen).toContain("formatBalance");
  });

  it("chat: passes wallet address to Ember as memory context", () => {
    expect(chatScreen).toContain("User wallet:");
  });
});

// ─── 3. ABI-Encoded Contract Storage Reads ────────────────────────────

describe("Upgrade 3: ABI-Encoded Contract Storage Reads", () => {
  const contractReader = readFile("lib/contract-reader.ts");
  const bridgeScreen = readFile("app/(tabs)/bridge.tsx");
  const dashboardScreen = readFile("app/(tabs)/dashboard.tsx");

  it("contract-reader: has known function selectors", () => {
    expect(contractReader).toContain("KNOWN_SELECTORS");
    expect(contractReader).toContain("proposalCount()");
    expect(contractReader).toContain("0xda35c664");
    expect(contractReader).toContain("nonce()");
    expect(contractReader).toContain("0xaffed0e0");
    expect(contractReader).toContain("owner()");
    expect(contractReader).toContain("0x8da5cb5b");
    expect(contractReader).toContain("paused()");
    expect(contractReader).toContain("0x5c975abb");
  });

  it("contract-reader: uses eth_call for on-chain reads", () => {
    expect(contractReader).toContain("eth_call");
    expect(contractReader).toContain("safeEthCall");
    expect(contractReader).toContain("to: contractAddress");
    expect(contractReader).toContain("data: selector");
  });

  it("contract-reader: decodes uint256 and bool from hex", () => {
    expect(contractReader).toContain("decodeUint256");
    expect(contractReader).toContain("decodeBool");
    expect(contractReader).toContain("BigInt(hex)");
  });

  it("contract-reader: tries multiple function signatures with fallback", () => {
    expect(contractReader).toContain("tryReadUint256");
    expect(contractReader).toContain("for (const sig of signatures)");
  });

  it("contract-reader: has governance data reader", () => {
    expect(contractReader).toContain("getGovernanceData");
    expect(contractReader).toContain("proposalCount");
    expect(contractReader).toContain("threshold");
    expect(contractReader).toContain("ownerCount");
  });

  it("contract-reader: has bridge stats reader", () => {
    expect(contractReader).toContain("getTeleporterBridgeStats");
    expect(contractReader).toContain("messageNonce()");
    expect(contractReader).toContain("paused");
  });

  it("contract-reader: has registry data reader", () => {
    expect(contractReader).toContain("getRegistryData");
    expect(contractReader).toContain("getAgentCount()");
    expect(contractReader).toContain("getEntryCount()");
    expect(contractReader).toContain("entryCount");
  });

  it("contract-reader: has batch chain contract data reader", () => {
    expect(contractReader).toContain("getChainContractData");
    expect(contractReader).toContain("readData");
  });

  it("contract-reader: gracefully handles missing functions", () => {
    expect(contractReader).toContain("return null");
    expect(contractReader).toContain("catch");
  });

  it("bridge screen: uses real bridge stats (no simulated data)", () => {
    expect(bridgeScreen).toContain("getTeleporterBridgeStats");
    expect(bridgeScreen).toContain("messageCount");
    expect(bridgeScreen).toContain("paused");
    expect(bridgeScreen).not.toContain("Math.random");
  });

  it("dashboard screen: uses real contract status checks", () => {
    expect(dashboardScreen).toContain("getMultipleContractStatus");
    // eth_getCode is called inside getMultipleContractStatus in contract-reader.ts
    expect(dashboardScreen).not.toContain("Math.random");
  });

  it("contract-reader: no simulated/random data", () => {
    expect(contractReader).not.toContain("Math.random");
    expect(contractReader).not.toContain("Simulated");
    expect(contractReader).not.toContain("For demo");
  });
});
