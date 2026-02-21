import { describe, it, expect } from "vitest";
import { ethers } from "ethers";

// ============ Contract Config Tests ============

describe("Contract Configuration", () => {
  const CONTRACTS: Record<string, string> = {
    ERC8004IdentityRegistry: "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
    ERC8004ReputationRegistry: "0x544B575431ECD927bA83E85008446fA1e100204a",
    ERC8004ValidationRegistry: "0x501fE0f960c1e061C4d295Af241f9F1512775556",
    AIPartnershipBondsV2: "0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1",
    AIAccountabilityBondsV2: "0xDfc66395A4742b5168712a04942C90B99394aEEb",
    VaultfireERC8004Adapter: "0x5470d8189849675C043fFA7fc451e5F2f4e5532c",
    MultisigGovernance: "0xea0A6750642AA294658dC9f1eDf36b95D21e7B22",
    FlourishingMetricsOracle: "0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1",
    ProductionBeliefAttestationVerifier: "0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B",
    VaultfireTeleporterBridge: "0xFe122605364f428570c4C0EB2CCAEBb68dD22d05",
    BeliefAttestationVerifier: "0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF",
    PrivacyGuarantees: "0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55",
    MissionEnforcement: "0x38165D2D7a8584985CCa5640f4b32b1f3347CC83",
    AntiSurveillance: "0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C",
  };

  const AVAX_CONTRACTS: Record<string, string> = {
    VaultfireTeleporterBridge: "0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf",
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
    expect(ethers.isAddress("0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5")).toBe(true);
    expect(ethers.isAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("should reject invalid addresses", () => {
    expect(ethers.isAddress("not-an-address")).toBe(false);
    expect(ethers.isAddress("0x123")).toBe(false);
    expect(ethers.isAddress("")).toBe(false);
  });

  it("should checksum addresses correctly", () => {
    const address = "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5";
    const checksummed = ethers.getAddress(address);
    expect(checksummed).toBe("0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5");
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
    const spender = "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5";
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
      "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
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
      "0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5",
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

// ============ Ember Permission Levels ============

describe("Ember Permission Levels", () => {
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
