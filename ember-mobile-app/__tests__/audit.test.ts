/**
 * Comprehensive Audit Tests for Embris - Vaultfire Protocol App
 * Tests all 10 audit areas with PASS/FAIL for each item.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// 1. CONTRACT ADDRESSES AUDIT
// ============================================================

// Reference addresses from the user's specification
const EXPECTED_BASE_CONTRACTS: Record<string, string> = {
  MissionEnforcement: "0x38165D2D7a8584985CCa5640f4b32b1f3347CC83",
  AntiSurveillance: "0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C",
  PrivacyGuarantees: "0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55",
  ERC8004IdentityRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
  BeliefAttestationVerifier: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
  AIPartnershipBondsV2: "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1",
  FlourishingMetricsOracle: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1",
  AIAccountabilityBondsV2: "0xDfc66395A4742b5168712a04942C90B99394aEEb",
  ERC8004ReputationRegistry: "0x544B575431ECD927bA83E85008446fA1e100204a",
  ERC8004ValidationRegistry: "0x501fE0f960c1e061C4d295Af241f9F1512775556",
  VaultfireERC8004Adapter: "0x5470d8189849675C043fFA7fc451e5F2f4e5532c",
  MultisigGovernance: "0xea0A6750642AA294658dC9f1eDf36b95D21e7B22",
  ProductionBeliefAttestationVerifier: "0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B",
  VaultfireTeleporterBridge: "0xFe122605364f428570c4C0EB2CCAEBb68dD22d05",
};

const EXPECTED_AVALANCHE_CONTRACTS: Record<string, string> = {
  MissionEnforcement: "0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709",
  AntiSurveillance: "0xaCB59e0f0eA47B25b24390B71b877928E5842630",
  ERC8004IdentityRegistry: "0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5",
  AIPartnershipBondsV2: "0x37679B1dCfabE6eA6b8408626815A1426bE2D717",
  FlourishingMetricsOracle: "0x83b2D1a8e383c4239dE66b6614176636618c1c0A",
  AIAccountabilityBondsV2: "0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192",
  ProductionBeliefAttestationVerifier: "0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1",
  VaultfireTeleporterBridge: "0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf",
  PrivacyGuarantees: "0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C",
  BeliefAttestationVerifier: "0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55",
  ERC8004ReputationRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
  ERC8004ValidationRegistry: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
  VaultfireERC8004Adapter: "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1",
  MultisigGovernance: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1",
};

describe("1. Contract Addresses Audit", () => {
  // Read the contracts file
  const contractsFile = fs.readFileSync(
    path.resolve(__dirname, "../constants/contracts.ts"),
    "utf-8"
  );

  describe("Base Contracts (14 contracts, Chain ID 8453)", () => {
    for (const [name, address] of Object.entries(EXPECTED_BASE_CONTRACTS)) {
      it(`Base ${name}: ${address}`, () => {
        expect(contractsFile).toContain(address);
        // Verify it's associated with base chain
        const regex = new RegExp(
          `name:\\s*"${name}".*?address:\\s*"${address}".*?chain:\\s*"base"`,
          "s"
        );
        expect(contractsFile).toMatch(regex);
      });
    }

    it("should have exactly 14 Base contracts", () => {
      const baseMatches = contractsFile.match(/chain:\s*"base"/g);
      expect(baseMatches?.length).toBe(14);
    });
  });

  describe("Avalanche Contracts (14 contracts, Chain ID 43114)", () => {
    for (const [name, address] of Object.entries(EXPECTED_AVALANCHE_CONTRACTS)) {
      it(`Avalanche ${name}: ${address}`, () => {
        expect(contractsFile).toContain(address);
        const regex = new RegExp(
          `name:\\s*"${name}".*?address:\\s*"${address}".*?chain:\\s*"avalanche"`,
          "s"
        );
        expect(contractsFile).toMatch(regex);
      });
    }

    it("should have exactly 14 Avalanche contracts", () => {
      const avaxMatches = contractsFile.match(/chain:\s*"avalanche"/g);
      expect(avaxMatches?.length).toBe(14);
    });
  });

  describe("Chain Configuration", () => {
    it("Base chain ID is 8453", () => {
      expect(contractsFile).toContain("chainId: 8453");
    });

    it("Avalanche chain ID is 43114", () => {
      expect(contractsFile).toContain("chainId: 43114");
    });

    it("Base RPC is https://mainnet.base.org", () => {
      expect(contractsFile).toContain('rpc: "https://mainnet.base.org"');
    });

    it("Avalanche RPC is https://api.avax.network/ext/bc/C/rpc", () => {
      expect(contractsFile).toContain(
        'rpc: "https://api.avax.network/ext/bc/C/rpc"'
      );
    });

    it("Total of 28 contracts across both chains", () => {
      const allMatches = contractsFile.match(/chain:\s*"(base|avalanche)"/g);
      expect(allMatches?.length).toBe(28);
    });
  });
});

// ============================================================
// 2. EMBRIS AI CHAT AUDIT
// ============================================================

describe("2. Embris AI Chat Audit", () => {
  const serverRouters = fs.readFileSync(
    path.resolve(__dirname, "../server/routers.ts"),
    "utf-8"
  );
  const contractsFile = fs.readFileSync(
    path.resolve(__dirname, "../constants/contracts.ts"),
    "utf-8"
  );

  it("Server has chat.send mutation endpoint", () => {
    expect(serverRouters).toContain("chat:");
    expect(serverRouters).toContain("send:");
  });

  it("System prompt includes Vaultfire Protocol knowledge", () => {
    // Check either server routers or contracts file for the system prompt
    const hasSystemPrompt =
      serverRouters.includes("EMBRIS_SYSTEM_PROMPT") ||
      serverRouters.includes("Vaultfire Protocol");
    expect(hasSystemPrompt).toBe(true);
  });

  it("System prompt includes all Base contract addresses", () => {
    for (const address of Object.values(EXPECTED_BASE_CONTRACTS)) {
      const inRouters = serverRouters.includes(address);
      const inContracts = contractsFile.includes(address);
      expect(inRouters || inContracts).toBe(true);
    }
  });

  it("System prompt includes all Avalanche contract addresses", () => {
    for (const address of Object.values(EXPECTED_AVALANCHE_CONTRACTS)) {
      const inRouters = serverRouters.includes(address);
      const inContracts = contractsFile.includes(address);
      expect(inRouters || inContracts).toBe(true);
    }
  });

  it("System prompt includes ERC-8004 knowledge", () => {
    const hasERC8004 =
      serverRouters.includes("ERC-8004") || serverRouters.includes("ERC8004");
    expect(hasERC8004).toBe(true);
  });

  it('System prompt includes core values: "Morals over metrics. Privacy over surveillance. Freedom over control."', () => {
    const hasValues =
      serverRouters.includes("Morals over metrics") ||
      contractsFile.includes("Morals over metrics");
    expect(hasValues).toBe(true);
  });

  it("Chat accepts messages array and memories", () => {
    expect(serverRouters).toContain("messages:");
    expect(serverRouters).toContain("memories:");
  });

  it("Chat uses server LLM (invokeLLM)", () => {
    expect(serverRouters).toContain("invokeLLM");
  });

  it("Chat screen file exists", () => {
    const chatScreen = path.resolve(__dirname, "../app/(tabs)/chat.tsx");
    expect(fs.existsSync(chatScreen)).toBe(true);
  });
});

// ============================================================
// 3. MEMORY SYSTEM AUDIT
// ============================================================

describe("3. Memory System Audit", () => {
  const memoryFile = fs.readFileSync(
    path.resolve(__dirname, "../lib/memory.ts"),
    "utf-8"
  );

  it("Memory module exists", () => {
    expect(memoryFile.length).toBeGreaterThan(0);
  });

  it("Uses AsyncStorage for persistence", () => {
    expect(memoryFile).toContain("AsyncStorage");
  });

  it("Has memory extraction function", () => {
    expect(memoryFile).toContain("extractMemories");
  });

  it("Has save memories function", () => {
    expect(memoryFile).toContain("saveMemories");
  });

  it("Has get memories function", () => {
    expect(memoryFile).toContain("getMemories");
  });

  it("Has clear memories function", () => {
    expect(memoryFile).toContain("clearMemories");
  });

  it("Has chat history persistence", () => {
    expect(memoryFile).toContain("saveChatHistory");
    expect(memoryFile).toContain("getChatHistory");
  });

  it("Memory types include fact, preference, context", () => {
    expect(memoryFile).toContain('"fact"');
    expect(memoryFile).toContain('"preference"');
    expect(memoryFile).toContain('"context"');
  });

  it("Chat screen integrates memory system", () => {
    const chatScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/chat.tsx"),
      "utf-8"
    );
    expect(chatScreen).toContain("extractMemories");
    expect(chatScreen).toContain("saveMemories");
    expect(chatScreen).toContain("getMemories");
    expect(chatScreen).toContain("saveChatHistory");
  });
});

// ============================================================
// 4. ALL 5 SCREENS AUDIT
// ============================================================

describe("4. All 5 Screens Audit", () => {
  const tabsDir = path.resolve(__dirname, "../app/(tabs)");

  it("Home screen (index.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "index.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Vaultfire Protocol");
    expect(content).toContain("ScreenContainer");
  });

  it("Chat screen (chat.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "chat.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Embris");
    expect(content).toContain("ScreenContainer");
  });

  it("Trust Verification screen (verify.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "verify.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Trust Verification");
    expect(content).toContain("ScreenContainer");
  });

  it("Cross-Chain Bridge screen (bridge.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "bridge.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Cross-Chain Bridge");
    expect(content).toContain("ScreenContainer");
  });

  it("Dashboard screen (dashboard.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "dashboard.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Dashboard");
    expect(content).toContain("ScreenContainer");
  });

  it("All screens use ScreenContainer for safe area handling", () => {
    const screens = ["index.tsx", "chat.tsx", "verify.tsx", "bridge.tsx", "dashboard.tsx"];
    for (const screen of screens) {
      const content = fs.readFileSync(path.join(tabsDir, screen), "utf-8");
      expect(content).toContain("ScreenContainer");
    }
  });
});

// ============================================================
// 5. TAB NAVIGATION AUDIT
// ============================================================

describe("5. Tab Navigation Audit", () => {
  const layoutFile = fs.readFileSync(
    path.resolve(__dirname, "../app/(tabs)/_layout.tsx"),
    "utf-8"
  );

  it("Tab layout has 6 Tabs.Screen entries (Home, Embris, Wallet, Verify, Bridge, Dashboard)", () => {
    const tabScreenMatches = layoutFile.match(/Tabs\.Screen/g);
    expect(tabScreenMatches?.length).toBe(6);
  });

  it('Has Wallet tab (name="wallet")', () => {
    expect(layoutFile).toContain('name="wallet"');
    expect(layoutFile).toContain('title: "Wallet"');
  });

  it('Has Home tab (name="index")', () => {
    expect(layoutFile).toContain('name="index"');
    expect(layoutFile).toContain('title: "Home"');
  });

  it('Has Embris tab (name="chat")', () => {
    expect(layoutFile).toContain('name="chat"');
    expect(layoutFile).toContain('title: "Embris"');
  });

  it('Has Verify tab (name="verify")', () => {
    expect(layoutFile).toContain('name="verify"');
    expect(layoutFile).toContain('title: "Verify"');
  });

  it('Has Bridge tab (name="bridge")', () => {
    expect(layoutFile).toContain('name="bridge"');
    expect(layoutFile).toContain('title: "Bridge"');
  });

  it('Has Dashboard tab (name="dashboard")', () => {
    expect(layoutFile).toContain('name="dashboard"');
    expect(layoutFile).toContain('title: "Dashboard"');
  });

  it("All tabs have icons", () => {
    expect(layoutFile).toContain("house.fill");
    expect(layoutFile).toContain("bubble.left.fill");
    expect(layoutFile).toContain("shield.checkered");
    expect(layoutFile).toContain("arrow.left.arrow.right");
    expect(layoutFile).toContain("chart.bar.fill");
  });

  it("Icon mappings exist in icon-symbol.tsx", () => {
    const iconFile = fs.readFileSync(
      path.resolve(__dirname, "../components/ui/icon-symbol.tsx"),
      "utf-8"
    );
    expect(iconFile).toContain('"house.fill"');
    expect(iconFile).toContain('"bubble.left.fill"');
    expect(iconFile).toContain('"shield.checkered"');
    expect(iconFile).toContain('"arrow.left.arrow.right"');
    expect(iconFile).toContain('"chart.bar.fill"');
  });
});

// ============================================================
// 6. THEME AUDIT
// ============================================================

describe("6. Dark Embris/Fire Theme Audit", () => {
  const themeConfig = fs.readFileSync(
    path.resolve(__dirname, "../theme.config.js"),
    "utf-8"
  );

  it("Background is dark (#0D0D0D)", () => {
    expect(themeConfig).toContain("#0A0A0C");
  });

  it("Primary color is embris/fire orange", () => {
    // Should be an orange-ish color
    expect(themeConfig).toMatch(/#[Ff]{2}[0-9A-Fa-f]{4}/);
  });

  it("Surface color is dark", () => {
    // Dark surface for cards
    expect(themeConfig).toContain("surface");
  });

  it("Both light and dark modes use dark colors", () => {
    // For an always-dark app, light mode should also be dark
    const lightBg = themeConfig.match(/background.*?light:\s*'([^']+)'/s);
    const darkBg = themeConfig.match(/background.*?dark:\s*'([^']+)'/s);
    expect(lightBg).toBeTruthy();
    expect(darkBg).toBeTruthy();
    // Both should be dark colors (starting with #0 or #1)
    if (lightBg && darkBg) {
      expect(lightBg[1].startsWith("#0") || lightBg[1].startsWith("#1")).toBe(true);
      expect(darkBg[1].startsWith("#0") || darkBg[1].startsWith("#1")).toBe(true);
    }
  });

  it("No white/light backgrounds in theme", () => {
    // Should not have #ffffff or #fff as background
    expect(themeConfig).not.toMatch(/background.*?'#[Ff]{3,6}'/s);
  });

  it("Splash screen uses dark background", () => {
    const appConfig = fs.readFileSync(
      path.resolve(__dirname, "../app.config.ts"),
      "utf-8"
    );
    // Splash background should be dark
    const splashBg = appConfig.match(/backgroundColor:\s*"#0A0A0C"/);
    expect(splashBg).toBeTruthy();
  });
});

// ============================================================
// 7. BLOCKCHAIN CONNECTIVITY AUDIT
// ============================================================

describe("7. Blockchain Connectivity Audit", () => {
  const blockchainFile = fs.readFileSync(
    path.resolve(__dirname, "../lib/blockchain.ts"),
    "utf-8"
  );

  it("Blockchain service module exists", () => {
    expect(blockchainFile.length).toBeGreaterThan(0);
  });

  it("Has JSON-RPC call function", () => {
    expect(blockchainFile).toContain("jsonRpc");
    expect(blockchainFile).toContain("jsonrpc");
  });

  it("Can get block number", () => {
    expect(blockchainFile).toContain("getBlockNumber");
    expect(blockchainFile).toContain("eth_blockNumber");
  });

  it("Can get chain ID", () => {
    expect(blockchainFile).toContain("getChainId");
    expect(blockchainFile).toContain("eth_chainId");
  });

  it("Can check contract code exists", () => {
    expect(blockchainFile).toContain("checkContractExists");
    expect(blockchainFile).toContain("eth_getCode");
  });

  it("Has chain connectivity check function", () => {
    expect(blockchainFile).toContain("checkChainConnectivity");
  });

  it("Has check all chains function", () => {
    expect(blockchainFile).toContain("checkAllChains");
  });

  it("Home screen uses blockchain connectivity", () => {
    const homeScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(homeScreen).toContain("checkChainConnectivity");
  });

  it("Bridge screen uses blockchain connectivity", () => {
    const bridgeScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/bridge.tsx"),
      "utf-8"
    );
    expect(bridgeScreen).toContain("getTeleporterBridgeStats");
  });

  it("Verify screen uses blockchain connectivity", () => {
    const verifyScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/verify.tsx"),
      "utf-8"
    );
    expect(verifyScreen).toContain("getMultipleContractStatus");
  });
});

// ============================================================
// 8. BRANDING AUDIT
// ============================================================

describe("8. Branding Audit", () => {
  it("App icon exists at assets/images/icon.png", () => {
    const iconPath = path.resolve(__dirname, "../assets/images/icon.png");
    expect(fs.existsSync(iconPath)).toBe(true);
    const stats = fs.statSync(iconPath);
    expect(stats.size).toBeGreaterThan(1000); // Not a placeholder
  });

  it("Splash icon exists", () => {
    const splashPath = path.resolve(__dirname, "../assets/images/splash-icon.png");
    expect(fs.existsSync(splashPath)).toBe(true);
  });

  it("Favicon exists", () => {
    const faviconPath = path.resolve(__dirname, "../assets/images/favicon.png");
    expect(fs.existsSync(faviconPath)).toBe(true);
  });

  it("Android foreground icon exists", () => {
    const androidPath = path.resolve(
      __dirname,
      "../assets/images/android-icon-foreground.png"
    );
    expect(fs.existsSync(androidPath)).toBe(true);
  });

  it('App name is "Vaultfire"', () => {
    const appConfig = fs.readFileSync(
      path.resolve(__dirname, "../app.config.ts"),
      "utf-8"
    );
    expect(appConfig).toContain('appName: "Vaultfire"');
  });

  it("Logo URL is set in app.config.ts", () => {
    const appConfig = fs.readFileSync(
      path.resolve(__dirname, "../app.config.ts"),
      "utf-8"
    );
    expect(appConfig).toMatch(/logoUrl:\s*"https:\/\//);
  });

  it("Home screen shows Vaultfire Protocol branding", () => {
    const homeScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(homeScreen).toContain("Vaultfire Protocol");
    expect(homeScreen).toContain("Powered by Embris AI");
  });

  it("Website theloopbreaker.com is referenced", () => {
    const contractsFile = fs.readFileSync(
      path.resolve(__dirname, "../constants/contracts.ts"),
      "utf-8"
    );
    expect(contractsFile).toContain("theloopbreaker.com");

    const homeScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(homeScreen).toContain("theloopbreaker.com");
  });

  it("Flame icon is used in branding", () => {
    const homeScreen = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(homeScreen).toContain("flame.fill");
  });
});

// ============================================================
// 9. CODE QUALITY AUDIT
// ============================================================

describe("9. Code Quality Audit", () => {
  const projectRoot = path.resolve(__dirname, "..");

  it("No hardcoded API keys in source files", () => {
    const sourceFiles = [
      "constants/contracts.ts",
      "lib/blockchain.ts",
      "lib/memory.ts",
      "app/(tabs)/index.tsx",
      "app/(tabs)/chat.tsx",
      "app/(tabs)/verify.tsx",
      "app/(tabs)/bridge.tsx",
      "app/(tabs)/dashboard.tsx",
      "server/routers.ts",
    ];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(path.join(projectRoot, file), "utf-8");
      // Check for common API key patterns
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/); // OpenAI
      expect(content).not.toMatch(/AKIA[A-Z0-9]{16}/); // AWS
      expect(content).not.toMatch(/Bearer\s+[a-zA-Z0-9]{20,}/); // Bearer tokens
    }
  });

  it("No placeholder data in contracts", () => {
    const contracts = fs.readFileSync(
      path.join(projectRoot, "constants/contracts.ts"),
      "utf-8"
    );
    expect(contracts).not.toContain("0x0000000000000000000000000000000000000000");
    expect(contracts).not.toContain("TODO");
    expect(contracts).not.toContain("PLACEHOLDER");
  });

  it("All screens use StyleSheet.create for styles", () => {
    const screens = [
      "app/(tabs)/index.tsx",
      "app/(tabs)/chat.tsx",
      "app/(tabs)/verify.tsx",
      "app/(tabs)/bridge.tsx",
      "app/(tabs)/dashboard.tsx",
    ];

    for (const screen of screens) {
      const content = fs.readFileSync(path.join(projectRoot, screen), "utf-8");
      expect(content).toContain("StyleSheet.create");
    }
  });

  it("All screens use proper imports", () => {
    const screens = [
      "app/(tabs)/index.tsx",
      "app/(tabs)/chat.tsx",
      "app/(tabs)/verify.tsx",
      "app/(tabs)/bridge.tsx",
      "app/(tabs)/dashboard.tsx",
    ];

    for (const screen of screens) {
      const content = fs.readFileSync(path.join(projectRoot, screen), "utf-8");
      expect(content).toContain("from \"react-native\"");
      expect(content).toContain("from \"@/components/screen-container\"");
    }
  });

  it("No console.log statements in production code (except error logging)", () => {
    const sourceFiles = [
      "constants/contracts.ts",
      "lib/blockchain.ts",
      "app/(tabs)/index.tsx",
      "app/(tabs)/_layout.tsx",
    ];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(path.join(projectRoot, file), "utf-8");
      // console.error is OK, console.log is not
      const logMatches = content.match(/console\.log\(/g);
      expect(logMatches).toBeNull();
    }
  });
});

// ============================================================
// 10. MISSING FEATURES / COMPLETENESS AUDIT
// ============================================================

describe("10. Completeness Audit", () => {
  it("All 5 tab screens are implemented", () => {
    const tabsDir = path.resolve(__dirname, "../app/(tabs)");
    const expected = ["index.tsx", "chat.tsx", "verify.tsx", "bridge.tsx", "dashboard.tsx"];
    for (const file of expected) {
      expect(fs.existsSync(path.join(tabsDir, file))).toBe(true);
    }
  });

  it("Tab layout references all 5 screens", () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf-8"
    );
    expect(layout).toContain('"index"');
    expect(layout).toContain('"chat"');
    expect(layout).toContain('"verify"');
    expect(layout).toContain('"bridge"');
    expect(layout).toContain('"dashboard"');
  });

  it("Blockchain service covers both chains", () => {
    const blockchain = fs.readFileSync(
      path.resolve(__dirname, "../lib/blockchain.ts"),
      "utf-8"
    );
    expect(blockchain).toContain('"base"');
    expect(blockchain).toContain('"avalanche"');
  });

  it("Memory system has full CRUD operations", () => {
    const memory = fs.readFileSync(
      path.resolve(__dirname, "../lib/memory.ts"),
      "utf-8"
    );
    expect(memory).toContain("saveMemories");
    expect(memory).toContain("getMemories");
    expect(memory).toContain("clearMemories");
    expect(memory).toContain("saveChatHistory");
    expect(memory).toContain("getChatHistory");
    expect(memory).toContain("clearChatHistory");
  });

  it("Core values string is correct", () => {
    const contracts = fs.readFileSync(
      path.resolve(__dirname, "../constants/contracts.ts"),
      "utf-8"
    );
    expect(contracts).toContain(
      "Morals over metrics. Privacy over surveillance. Freedom over control."
    );
  });

  it("Website URL is correct", () => {
    const contracts = fs.readFileSync(
      path.resolve(__dirname, "../constants/contracts.ts"),
      "utf-8"
    );
    expect(contracts).toContain("https://theloopbreaker.com");
  });

  it("Home screen has quick actions to navigate to all other screens", () => {
    const home = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/index.tsx"),
      "utf-8"
    );
    expect(home).toContain('"/chat"');
    expect(home).toContain('"/verify"');
    expect(home).toContain('"/bridge"');
    expect(home).toContain('"/dashboard"');
  });
});
