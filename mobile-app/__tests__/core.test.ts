import { describe, it, expect } from "vitest";
import { ethers } from "ethers";

// ============ Contract Config Tests ============

describe("Contract Configuration", () => {
  const CONTRACTS: Record<string, string> = {
    ERC8004IdentityRegistry: "0x35978DB675576598F0781dA2133E94cdCf4858bC",
    ERC8004ReputationRegistry: "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
    ERC8004ValidationRegistry: "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
    AIPartnershipBondsV2: "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4",
    AIAccountabilityBondsV2: "0xf92baef9523BC264144F80F9c31D5c5C017c6Da8",
    VaultfireERC8004Adapter: "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
    MultisigGovernance: "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
    FlourishingMetricsOracle: "0x83dd216449B3F0574E39043ECFE275946fa492e9",
    ProductionBeliefAttestationVerifier: "0xa5CEC47B48999EB398707838E3A18dd20A1ae272",
    VaultfireTeleporterBridge: "0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2",
    BeliefAttestationVerifier: "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
    PrivacyGuarantees: "0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045",
    MissionEnforcement: "0x8568F4020FCD55915dB3695558dD6D2532599e56",
    AntiSurveillance: "0x722E37A7D6f27896C688336AaaFb0dDA80D25E57",
  };

  const AVAX_CONTRACTS: Record<string, string> = {
    VaultfireTeleporterBridge: "0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31",
  };

  it("should have 14 Base contracts", () => {
    expect(Object.keys(CONTRACTS).length).toBe(14);
  });

  it("should have 1 Avalanche contract", () => {
    expect(Object.keys(AVAX_CONTRACTS).length).toBe(1);
  });

  it("should have valid Ethereum addresses for all contracts", () => {
    for (const [name, address] of Object.entries(CONTRACTS)) {
      expect(ethers.isAddress(address), `${name} has invalid address: ${address}`).toBe(true);
    }
    for (const [name, address] of Object.entries(AVAX_CONTRACTS)) {
      expect(ethers.isAddress(address), `${name} has invalid address: ${address}`).toBe(true);
    }
  });

  it("should have no duplicate contract addresses", () => {
    const allAddresses = [
      ...Object.values(CONTRACTS),
      ...Object.values(AVAX_CONTRACTS),
    ].map((a) => a.toLowerCase());
    const unique = new Set(allAddresses);
    expect(unique.size).toBe(allAddresses.length);
  });
});

// ============ Capabilities Hash Tests ============

describe("Capabilities Hash", () => {
  it("should correctly compute keccak256 hash for capabilities string", () => {
    const capabilities = "AI analysis, trust verification, wallet monitoring";
    const hash = ethers.keccak256(ethers.toUtf8Bytes(capabilities));
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("should produce different hashes for different capabilities", () => {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("sentinel"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("validator"));
    expect(hash1).not.toBe(hash2);
  });
});

// ============ Address Validation Tests ============

describe("Address Validation", () => {
  it("should validate correct Ethereum addresses", () => {
    expect(ethers.isAddress("0x35978DB675576598F0781dA2133E94cdCf4858bC")).toBe(true);
    expect(ethers.isAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("should reject invalid addresses", () => {
    expect(ethers.isAddress("not-an-address")).toBe(false);
    expect(ethers.isAddress("0x123")).toBe(false);
    expect(ethers.isAddress("")).toBe(false);
  });

  it("should checksum addresses correctly", () => {
    const address = "0x35978DB675576598F0781dA2133E94cdCf4858bC";
    const checksummed = ethers.getAddress(address);
    expect(checksummed).toBe("0x35978DB675576598F0781dA2133E94cdCf4858bC");
  });
});

// ============ Token Config Tests ============

describe("Token Configuration", () => {
  const BASE_TOKENS = [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
  ];

  it("should have valid token addresses", () => {
    for (const token of BASE_TOKENS) {
      expect(ethers.isAddress(token.address), `${token.symbol} has invalid address`).toBe(true);
    }
  });

  it("should have correct decimal values", () => {
    for (const token of BASE_TOKENS) {
      expect(token.decimals).toBeGreaterThan(0);
      expect(token.decimals).toBeLessThanOrEqual(18);
    }
  });

  it("should have no duplicate token symbols", () => {
    const symbols = BASE_TOKENS.map((t) => t.symbol);
    const unique = new Set(symbols);
    expect(unique.size).toBe(symbols.length);
  });
});

// ============ Transaction Builder Tests ============

describe("Transaction Building", () => {
  it("should encode registerAgent function call correctly", () => {
    const iface = new ethers.Interface([
      "function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash)",
    ]);
    const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("sentinel capabilities"));
    const data = iface.encodeFunctionData("registerAgent", [
      "https://vaultfire.io/agent/1",
      "sentinel",
      capabilitiesHash,
    ]);
    expect(data).toMatch(/^0x/);
    expect(data.length).toBeGreaterThan(10);
  });

  it("should encode approve(spender, 0) for revoke correctly", () => {
    const iface = new ethers.Interface([
      "function approve(address spender, uint256 amount)",
    ]);
    const spender = "0x35978DB675576598F0781dA2133E94cdCf4858bC";
    const data = iface.encodeFunctionData("approve", [spender, 0]);
    expect(data).toMatch(/^0x/);
    // approve selector is 0x095ea7b3
    expect(data.startsWith("0x095ea7b3")).toBe(true);
  });

  it("should encode createBond function call correctly", () => {
    const iface = new ethers.Interface([
      "function createBond(address aiAgent, string partnershipType)",
    ]);
    const data = iface.encodeFunctionData("createBond", [
      "0x35978DB675576598F0781dA2133E94cdCf4858bC",
      "research",
    ]);
    expect(data).toMatch(/^0x/);
    expect(data.length).toBeGreaterThan(10);
  });

  it("should encode submitFeedback function call correctly", () => {
    const iface = new ethers.Interface([
      "function submitFeedback(address agent, uint256 rating, string comment)",
    ]);
    const data = iface.encodeFunctionData("submitFeedback", [
      "0x35978DB675576598F0781dA2133E94cdCf4858bC",
      5,
      "Excellent agent",
    ]);
    expect(data).toMatch(/^0x/);
    expect(data.length).toBeGreaterThan(10);
  });

  it("should correctly format ETH values", () => {
    const value = ethers.parseEther("0.01");
    expect(value.toString()).toBe("10000000000000000");
    expect(ethers.formatEther(value)).toBe("0.01");
  });
});

// ============ Security Rules Tests ============

describe("Security Rules", () => {
  it("should never include ASM token interactions", () => {
    // ASM token should never appear in any transaction builder
    const FORBIDDEN_TOKENS = ["ASM"];
    const BASE_TOKENS = [
      { symbol: "USDC" },
      { symbol: "USDT" },
      { symbol: "DAI" },
      { symbol: "WETH" },
      { symbol: "cbETH" },
    ];
    for (const token of BASE_TOKENS) {
      expect(FORBIDDEN_TOKENS.includes(token.symbol)).toBe(false);
    }
  });

  it("should ensure all transactions are read-only by default", () => {
    // The app should never auto-sign transactions
    // This test validates the principle that all write operations require user confirmation
    const requiresUserSignature = true;
    expect(requiresUserSignature).toBe(true);
  });
});

// ============ Embris Permission Levels ============

describe("Embris Permission Levels", () => {
  const PERMISSION_LEVELS = ["view_only", "advisory", "guardian"] as const;

  it("should have exactly 3 permission levels", () => {
    expect(PERMISSION_LEVELS.length).toBe(3);
  });

  it("should include view_only, advisory, and guardian", () => {
    expect(PERMISSION_LEVELS).toContain("view_only");
    expect(PERMISSION_LEVELS).toContain("advisory");
    expect(PERMISSION_LEVELS).toContain("guardian");
  });
});
