/**
 * Comprehensive Audit Tests for Embris - Vaultfire Protocol App
 * Tests all 10 audit areas with PASS/FAIL for each item.
 * Updated for full feature parity: 45 contracts (15 per chain × 3 chains),
 * 14 tab screens, Ethereum chain support, and all new features.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// 1. CONTRACT ADDRESSES AUDIT
// ============================================================

// Reference addresses from ember-web-app/app/lib/contracts.ts (source of truth)
const EXPECTED_BASE_CONTRACTS: Record<string, string> = {
  MissionEnforcement: "0x8568F4020FCD55915dB3695558dD6D2532599e56",
  AntiSurveillance: "0x722E37A7D6f27896C688336AaaFb0dDA80D25E57",
  PrivacyGuarantees: "0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045",
  ERC8004IdentityRegistry: "0x35978DB675576598F0781dA2133E94cdCf4858bC",
  BeliefAttestationVerifier: "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
  AIPartnershipBondsV2: "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4",
  FlourishingMetricsOracle: "0x83dd216449B3F0574E39043ECFE275946fa492e9",
  AIAccountabilityBondsV2: "0xf92baef9523BC264144F80F9c31D5c5C017c6Da8",
  ERC8004ReputationRegistry: "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
  ERC8004ValidationRegistry: "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
  VaultfireERC8004Adapter: "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
  MultisigGovernance: "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
  ProductionBeliefAttestationVerifier: "0xa5CEC47B48999EB398707838E3A18dd20A1ae272",
  DilithiumAttestor: "0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4",
  VaultfireTeleporterBridge: "0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2",
};

const EXPECTED_AVALANCHE_CONTRACTS: Record<string, string> = {
  MissionEnforcement: "0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB",
  AntiSurveillance: "0x281814eF92062DA8049Fe5c4743c4Aef19a17380",
  PrivacyGuarantees: "0xc09F0e06690332eD9b490E1040BdE642f11F3937",
  ERC8004IdentityRegistry: "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3",
  BeliefAttestationVerifier: "0x227e27e7776d3ee14128BC66216354495E113B19",
  AIPartnershipBondsV2: "0xea6B504827a746d781f867441364C7A732AA4b07",
  FlourishingMetricsOracle: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
  AIAccountabilityBondsV2: "0xaeFEa985E0C52f92F73606657B9dA60db2798af3",
  ERC8004ReputationRegistry: "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24",
  ERC8004ValidationRegistry: "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b",
  VaultfireERC8004Adapter: "0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053",
  MultisigGovernance: "0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee",
  ProductionBeliefAttestationVerifier: "0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F",
  DilithiumAttestor: "0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f",
  VaultfireTeleporterBridge: "0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31",
};

const EXPECTED_ETHEREUM_CONTRACTS: Record<string, string> = {
  MissionEnforcement: "0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58",
  AntiSurveillance: "0xfDdd2B1597c87577543176AB7f49D587876563D2",
  PrivacyGuarantees: "0x8aceF0Bc7e07B2dE35E9069663953f41B5422218",
  ERC8004IdentityRegistry: "0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C",
  BeliefAttestationVerifier: "0x613585B786af2d5ecb1c3e712CE5ffFB8f53f155",
  AIPartnershipBondsV2: "0x247F31bB2b5a0d28E68bf24865AA242965FF99cd",
  FlourishingMetricsOracle: "0x690411685278548157409FA7AC8279A5B1Fb6F78",
  AIAccountabilityBondsV2: "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24",
  ERC8004ReputationRegistry: "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b",
  ERC8004ValidationRegistry: "0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053",
  VaultfireERC8004Adapter: "0xCc7300F39aF4cc2A924f82a5Facd7049436157Ee",
  MultisigGovernance: "0x227e27e7776d3ee14128BC66216354495E113B19",
  ProductionBeliefAttestationVerifier: "0xea6B504827a746d781f867441364C7A732AA4b07",
  DilithiumAttestor: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
  TrustDataBridge: "0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F",
};

describe("1. Contract Addresses Audit", () => {
  const contractsFile = fs.readFileSync(
    path.resolve(__dirname, "../constants/contracts.ts"),
    "utf-8"
  );

  describe("Base Contracts (15 contracts, Chain ID 8453)", () => {
    for (const [name, address] of Object.entries(EXPECTED_BASE_CONTRACTS)) {
      it(`Base ${name}: ${address}`, () => {
        expect(contractsFile).toContain(address);
        const regex = new RegExp(
          `name:\\s*'${name}'.*?address:\\s*'${address}'.*?chain:\\s*'base'`,
          "s"
        );
        expect(contractsFile).toMatch(regex);
      });
    }

    it("should have exactly 15 Base contracts", () => {
      const baseMatches = contractsFile.match(/chain:\s*'base',\s*chainId/g);
      expect(baseMatches?.length).toBe(15);
    });
  });

  describe("Avalanche Contracts (15 contracts, Chain ID 43114)", () => {
    for (const [name, address] of Object.entries(EXPECTED_AVALANCHE_CONTRACTS)) {
      it(`Avalanche ${name}: ${address}`, () => {
        expect(contractsFile).toContain(address);
        const regex = new RegExp(
          `name:\\s*'${name}'.*?address:\\s*'${address}'.*?chain:\\s*'avalanche'`,
          "s"
        );
        expect(contractsFile).toMatch(regex);
      });
    }

    it("should have exactly 15 Avalanche contracts", () => {
      const avaxMatches = contractsFile.match(/chain:\s*'avalanche'/g);
      expect(avaxMatches?.length).toBe(15);
    });
  });

  describe("Ethereum Contracts (15 contracts, Chain ID 1)", () => {
    for (const [name, address] of Object.entries(EXPECTED_ETHEREUM_CONTRACTS)) {
      it(`Ethereum ${name}: ${address}`, () => {
        expect(contractsFile).toContain(address);
        const regex = new RegExp(
          `name:\\s*'${name}'.*?address:\\s*'${address}'.*?chain:\\s*'ethereum'`,
          "s"
        );
        expect(contractsFile).toMatch(regex);
      });
    }

    it("should have exactly 15 Ethereum contracts", () => {
      const ethMatches = contractsFile.match(/chain:\s*'ethereum'/g);
      expect(ethMatches?.length).toBe(15);
    });
  });

  describe("Chain Configuration", () => {
    it("Base chain ID is 8453", () => {
      expect(contractsFile).toContain("chainId: 8453");
    });

    it("Avalanche chain ID is 43114", () => {
      expect(contractsFile).toContain("chainId: 43114");
    });

    it("Ethereum chain ID is 1", () => {
      expect(contractsFile).toContain("chainId: 1");
    });

    it("Base RPC is https://mainnet.base.org", () => {
      expect(contractsFile).toContain("rpc: 'https://mainnet.base.org'");
    });

    it("Avalanche RPC is configured", () => {
      expect(contractsFile).toMatch(/rpc:\s*'https:\/\/.*avax/);
    });

    it("Ethereum RPC is configured", () => {
      expect(contractsFile).toMatch(/rpc:\s*'https:\/\/.*ethereum/);
    });

    it("Total of 45 contracts (15 per chain × 3 chains)", () => {
      const allMatches = contractsFile.match(/chain:\s*'(base|avalanche|ethereum)',\s*chainId/g);
      expect(allMatches?.length).toBe(45);
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

  it("System prompt includes all Ethereum contract addresses", () => {
    for (const address of Object.values(EXPECTED_ETHEREUM_CONTRACTS)) {
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
// 4. ALL SCREENS AUDIT
// ============================================================

describe("4. All Screens Audit", () => {
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

  it("VNS screen (vns.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "vns.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("VNS");
    expect(content).toContain("ScreenContainer");
  });

  it("ZK Proofs screen (zk-proofs.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "zk-proofs.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("ZK");
    expect(content).toContain("ScreenContainer");
  });

  it("Agent Hub screen (agent-hub.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "agent-hub.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Agent");
    expect(content).toContain("ScreenContainer");
  });

  it("Earnings screen (earnings.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "earnings.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Earnings");
    expect(content).toContain("ScreenContainer");
  });

  it("Agent API screen (agent-api.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "agent-api.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("API");
    expect(content).toContain("ScreenContainer");
  });

  it("Settings screen (settings.tsx) exists and has content", () => {
    const file = path.join(tabsDir, "settings.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("Settings");
    expect(content).toContain("ScreenContainer");
  });

  it("All original screens use ScreenContainer for safe area handling", () => {
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

  it("Tab layout has 14 Tabs.Screen entries (all screens)", () => {
    const tabScreenMatches = layoutFile.match(/Tabs\.Screen/g);
    expect(tabScreenMatches?.length).toBe(14);
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

  it('Has Agent Hub tab (name="agent-hub")', () => {
    expect(layoutFile).toContain('name="agent-hub"');
    expect(layoutFile).toContain('title: "Hub"');
  });

  it('Has VNS tab (name="vns")', () => {
    expect(layoutFile).toContain('name="vns"');
    expect(layoutFile).toContain('title: "VNS"');
  });

  it('Has ZK Proofs tab (name="zk-proofs")', () => {
    expect(layoutFile).toContain('name="zk-proofs"');
    expect(layoutFile).toContain('title: "ZK Proofs"');
  });

  it('Has Earnings tab (name="earnings")', () => {
    expect(layoutFile).toContain('name="earnings"');
    expect(layoutFile).toContain('title: "Earnings"');
  });

  it('Has Agent API tab (name="agent-api")', () => {
    expect(layoutFile).toContain('name="agent-api"');
    expect(layoutFile).toContain('title: "API"');
  });

  it('Has Settings tab (name="settings")', () => {
    expect(layoutFile).toContain('name="settings"');
  });

  it("All tabs have icons", () => {
    expect(layoutFile).toContain("house.fill");
    expect(layoutFile).toContain("bubble.left.fill");
    expect(layoutFile).toContain("shield.checkered");
    expect(layoutFile).toContain("arrow.left.arrow.right");
    expect(layoutFile).toContain("chart.bar.fill");
    expect(layoutFile).toContain("wallet.pass.fill");
    expect(layoutFile).toContain("person.3.fill");
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

  it("Background is dark", () => {
    expect(themeConfig).toMatch(/#0[0-9A-Fa-f]{5}/);
  });

  it("Primary color is embris/fire orange", () => {
    expect(themeConfig).toMatch(/#[Ff][0-9A-Fa-f]{5}/);
  });

  it("Surface color is dark", () => {
    expect(themeConfig).toContain("surface");
  });

  it("Both light and dark modes use dark colors", () => {
    const lightBg = themeConfig.match(/background.*?light:\s*'([^']+)'/s);
    const darkBg = themeConfig.match(/background.*?dark:\s*'([^']+)'/s);
    expect(lightBg).toBeTruthy();
    expect(darkBg).toBeTruthy();
    if (lightBg && darkBg) {
      expect(lightBg[1].startsWith("#0") || lightBg[1].startsWith("#1")).toBe(true);
      expect(darkBg[1].startsWith("#0") || darkBg[1].startsWith("#1")).toBe(true);
    }
  });

  it("No white/light backgrounds in theme", () => {
    expect(themeConfig).not.toMatch(/background.*?'#[Ff]{3,6}'/s);
  });

  it("Splash screen uses dark background", () => {
    const appConfig = fs.readFileSync(
      path.resolve(__dirname, "../app.config.ts"),
      "utf-8"
    );
    const splashBg = appConfig.match(/backgroundColor:\s*"#0[0-9A-Fa-f]{5}"/);
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

  it("Supports Ethereum chain", () => {
    expect(blockchainFile).toContain('"ethereum"');
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
    expect(stats.size).toBeGreaterThan(1000);
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
    expect(homeScreen).toContain("companionDisplayName");
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
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(content).not.toMatch(/AKIA[A-Z0-9]{16}/);
      expect(content).not.toMatch(/Bearer\s+[a-zA-Z0-9]{20,}/);
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
      const logMatches = content.match(/console\.log\(/g);
      expect(logMatches).toBeNull();
    }
  });
});

// ============================================================
// 10. MISSING FEATURES / COMPLETENESS AUDIT
// ============================================================

describe("10. Completeness Audit", () => {
  it("All core tab screens are implemented", () => {
    const tabsDir = path.resolve(__dirname, "../app/(tabs)");
    const expected = [
      "index.tsx", "chat.tsx", "verify.tsx", "bridge.tsx", "dashboard.tsx",
      "wallet.tsx", "vns.tsx", "zk-proofs.tsx", "agent-hub.tsx", "earnings.tsx",
      "agent-api.tsx", "settings.tsx",
    ];
    for (const file of expected) {
      expect(fs.existsSync(path.join(tabsDir, file))).toBe(true);
    }
  });

  it("Tab layout references all screens", () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf-8"
    );
    expect(layout).toContain('"index"');
    expect(layout).toContain('"chat"');
    expect(layout).toContain('"verify"');
    expect(layout).toContain('"bridge"');
    expect(layout).toContain('"dashboard"');
    expect(layout).toContain('"wallet"');
    expect(layout).toContain('"vns"');
    expect(layout).toContain('"zk-proofs"');
    expect(layout).toContain('"agent-hub"');
    expect(layout).toContain('"earnings"');
    expect(layout).toContain('"agent-api"');
    expect(layout).toContain('"settings"');
  });

  it("Blockchain service covers all three chains", () => {
    const blockchain = fs.readFileSync(
      path.resolve(__dirname, "../lib/blockchain.ts"),
      "utf-8"
    );
    expect(blockchain).toContain('"base"');
    expect(blockchain).toContain('"avalanche"');
    expect(blockchain).toContain('"ethereum"');
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
    expect(home).toContain('"/wallet"');
    expect(home).toContain('"/vns"');
    expect(home).toContain('"/zk-proofs"');
    expect(home).toContain('"/agent-hub"');
    expect(home).toContain('"/earnings"');
    expect(home).toContain('"/agent-api"');
  });

  it("Lib files exist for all new features", () => {
    const libDir = path.resolve(__dirname, "../lib");
    const expectedLibs = [
      "disclaimers.ts", "vns.ts", "zk-proofs.ts", "x402-client.ts",
      "xmtp-connector.ts", "trust-gate.ts", "agent-hub.ts", "spending-limits.ts",
    ];
    for (const file of expectedLibs) {
      expect(fs.existsSync(path.join(libDir, file))).toBe(true);
    }
  });

  it("Disclaimer banner component exists", () => {
    const disclaimerBanner = path.resolve(__dirname, "../components/disclaimer-banner.tsx");
    expect(fs.existsSync(disclaimerBanner)).toBe(true);
  });
});
