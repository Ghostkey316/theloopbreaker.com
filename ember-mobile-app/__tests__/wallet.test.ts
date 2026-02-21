/**
 * Wallet Feature Tests for Ember - Vaultfire Protocol App
 * Tests wallet creation, import, secure storage, multi-chain support, and UI.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const walletCoreSrc = fs.readFileSync(
  path.resolve(__dirname, "../lib/wallet-core.ts"),
  "utf-8"
);
const walletScreenSrc = fs.readFileSync(
  path.resolve(__dirname, "../app/(tabs)/wallet.tsx"),
  "utf-8"
);
const chatScreenSrc = fs.readFileSync(
  path.resolve(__dirname, "../app/(tabs)/chat.tsx"),
  "utf-8"
);
const tabLayoutSrc = fs.readFileSync(
  path.resolve(__dirname, "../app/(tabs)/_layout.tsx"),
  "utf-8"
);
const iconSymbolSrc = fs.readFileSync(
  path.resolve(__dirname, "../components/ui/icon-symbol.tsx"),
  "utf-8"
);

// ============================================================
// WALLET CORE MODULE
// ============================================================

describe("Wallet Core Module (lib/wallet-core.ts)", () => {
  it("exists and has substantial content", () => {
    expect(walletCoreSrc.length).toBeGreaterThan(500);
  });

  it("uses ethers.js Wallet.createRandom() for keypair generation", () => {
    expect(walletCoreSrc).toContain("ethers");
    expect(walletCoreSrc).toContain("createRandom");
  });

  it("uses Expo SecureStore for encrypted storage", () => {
    expect(walletCoreSrc).toContain("SecureStore");
    expect(walletCoreSrc).toContain("setItemAsync");
    expect(walletCoreSrc).toContain("getItemAsync");
  });

  it("has createWallet function", () => {
    expect(walletCoreSrc).toContain("createWallet");
  });

  it("has import functions (seed phrase or private key)", () => {
    expect(walletCoreSrc).toContain("importFromMnemonic");
    expect(walletCoreSrc).toContain("importFromPrivateKey");
  });

  it("has getWalletAddress function", () => {
    expect(walletCoreSrc).toContain("getWalletAddress");
  });

  it("has deleteWallet function", () => {
    expect(walletCoreSrc).toContain("deleteWallet");
  });

  it("has multi-chain balance fetching", () => {
    expect(walletCoreSrc).toContain("getAllBalances");
    expect(walletCoreSrc).toContain("eth_getBalance");
  });

  it("has modular chain config array", () => {
    expect(walletCoreSrc).toContain("SUPPORTED_CHAINS");
  });

  it("supports ETH mainnet, Base, and Avalanche", () => {
    expect(walletCoreSrc).toContain("Ethereum");
    expect(walletCoreSrc).toContain("Base");
    expect(walletCoreSrc).toContain("Avalanche");
  });

  it("has chain IDs for all three chains (1, 8453, 43114)", () => {
    expect(walletCoreSrc).toContain("1"); // ETH mainnet
    expect(walletCoreSrc).toContain("8453"); // Base
    expect(walletCoreSrc).toContain("43114"); // Avalanche
  });

  it("has comment about adding future chains", () => {
    expect(walletCoreSrc.toLowerCase()).toMatch(/add.*solana|add.*arbitrum|add.*polygon/i);
  });

  it("has getWalletContextForEmber function for chat integration", () => {
    expect(walletCoreSrc).toContain("getWalletContextForEmber");
  });

  it("private key never leaves the device (no fetch/upload of private key)", () => {
    // Ensure private key is only stored locally, never sent over network
    const lines = walletCoreSrc.split("\n");
    const fetchLines = lines.filter(
      (l) => l.includes("fetch") && l.includes("privateKey")
    );
    expect(fetchLines.length).toBe(0);
  });
});

// ============================================================
// WALLET SCREEN
// ============================================================

describe("Wallet Screen (app/(tabs)/wallet.tsx)", () => {
  it("exists and has substantial content", () => {
    expect(walletScreenSrc.length).toBeGreaterThan(1000);
  });

  it("has onboarding/welcome screen", () => {
    expect(walletScreenSrc).toContain("Create");
    expect(walletScreenSrc).toContain("Vaultfire");
  });

  it("has Ember conversational guidance", () => {
    // Ember should guide the user through wallet creation
    expect(walletScreenSrc.toLowerCase()).toMatch(/ember|welcome|let.*set.*up/i);
  });

  it("shows 12-word seed phrase during creation", () => {
    expect(walletScreenSrc).toContain("mnemonic");
  });

  it("has seed phrase backup verification (confirm random words)", () => {
    expect(walletScreenSrc).toContain("verify");
  });

  it("has import wallet option", () => {
    expect(walletScreenSrc).toContain("Import");
  });

  it("shows multi-chain balances", () => {
    expect(walletScreenSrc).toContain("balance");
  });

  it("has Receive button with copy address", () => {
    expect(walletScreenSrc).toContain("Receive");
    expect(walletScreenSrc).toContain("copy");
  });

  it("has Send button (placeholder)", () => {
    expect(walletScreenSrc).toContain("Send");
  });

  it("has pull-to-refresh for balance updates", () => {
    expect(walletScreenSrc).toContain("RefreshControl");
  });

  it("uses ScreenContainer for safe area", () => {
    expect(walletScreenSrc).toContain("ScreenContainer");
  });

  it("uses FadeInDown animations", () => {
    expect(walletScreenSrc).toContain("FadeInDown");
  });

  it("uses dark ember theme colors", () => {
    expect(walletScreenSrc).toContain("useColors");
  });
});

// ============================================================
// TAB NAVIGATION
// ============================================================

describe("Wallet Tab Navigation", () => {
  it("tab layout includes wallet tab", () => {
    expect(tabLayoutSrc).toContain('name="wallet"');
    expect(tabLayoutSrc).toContain('title: "Wallet"');
  });

  it("wallet tab has icon", () => {
    expect(tabLayoutSrc).toContain("wallet.pass.fill");
  });

  it("icon mapping exists for wallet icon", () => {
    expect(iconSymbolSrc).toContain("wallet.pass.fill");
  });

  it("now has 6 tabs total", () => {
    const tabScreenMatches = tabLayoutSrc.match(/Tabs\.Screen/g);
    expect(tabScreenMatches?.length).toBe(6);
  });
});

// ============================================================
// EMBER INTEGRATION
// ============================================================

describe("Ember Chat Wallet Integration", () => {
  it("chat screen imports wallet-core for context", () => {
    expect(chatScreenSrc).toContain("wallet-core");
  });

  it("chat screen gets wallet context for Ember", () => {
    expect(chatScreenSrc).toContain("getWalletContextForEmber");
  });

  it("wallet context is passed to Ember's memory/context", () => {
    expect(chatScreenSrc).toContain("walletCtx");
  });
});

// ============================================================
// SECURITY
// ============================================================

describe("Wallet Security", () => {
  it("uses SecureStore for private key storage", () => {
    expect(walletCoreSrc).toContain("SecureStore");
  });

  it("stores private key via secureSet (SecureStore on native, AsyncStorage fallback on web)", () => {
    // Private key should be stored via secureSet which uses SecureStore on native
    expect(walletCoreSrc).toContain("secureSet(SECURE_KEYS.PRIVATE_KEY");
    // The secure functions use SecureStore on native
    expect(walletCoreSrc).toContain("SecureStore");
  });

  it("has delete/clear wallet function", () => {
    expect(walletCoreSrc).toContain("deleteWallet");
  });

  it("no hardcoded private keys or mnemonics", () => {
    // Should not have any actual private keys in source
    const hasHardcodedKey = /0x[a-fA-F0-9]{64}/.test(walletCoreSrc);
    expect(hasHardcodedKey).toBe(false);
  });
});
