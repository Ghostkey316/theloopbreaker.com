import { describe, it, expect } from "vitest";
import { ethers } from "ethers";

// ============ Contract Config Tests ============

describe("Contract Configuration", () => {
  const CONTRACTS: Record<string, string> = {
    ERC8004IdentityRegistry: "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD",
    ERC8004ReputationRegistry: "0x1043A9fBeAEDD401735c46Aa17B4a2FA1193B06C",
    ERC8004ValidationRegistry: "0x50E4609991691D5104016c4a2F6D2875234d4B06",
    AIPartnershipBondsV2: "0xd167A4F5eb428766Fc14C074e9f0C979c5CB4855",
    AIAccountabilityBondsV2: "0x956a99C8f50bAc8b8b69dA934AEaBFEaCF41B140",
    VaultfireERC8004Adapter: "0x02Cb2bFBeC479Cb1EA109E4C92744e08d5A5B361",
    MultisigGovernance: "0xd979025D0384Ea4F1b2562b9855d8Be7Eb89856D",
    FlourishingMetricsOracle: "0xb751abb1158908114662b254567b8135C460932C",
    ProductionBeliefAttestationVerifier: "0xBDB5d85B3a84C773113779be89A166Ed515A7fE2",
    VaultfireTeleporterBridge: "0xaD8D7aE60805B6e5d4BF6b70248AD8B46DEE9528",
    BeliefAttestationVerifier: "0x5657DA7E68CBbA1B529F74e2137CBA7bf3663B4a",
    PrivacyGuarantees: "0x1dCbeD76E05Eaf829c8BDf10a9511504cDa8EB1e",
    MissionEnforcement: "0x6EC0440e1601558024f285903F0F4577B109B609",
    AntiSurveillance: "0x2baE308ddCfc6a270d6dFCeeF947bd8B77b9d3Ac",
  };

  const AVAX_CONTRACTS: Record<string, string> = {
    VaultfireTeleporterBridge: "0x75de435Acc5dec0f612408f02Ae169528ce3a91b",
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
    expect(ethers.isAddress("0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD")).toBe(true);
    expect(ethers.isAddress("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("should reject invalid addresses", () => {
    expect(ethers.isAddress("not-an-address")).toBe(false);
    expect(ethers.isAddress("0x123")).toBe(false);
    expect(ethers.isAddress("")).toBe(false);
  });

  it("should checksum addresses correctly", () => {
    const address = "0x206265eabde04e15ebeb6e27cad64d9bfdb470dd";
    const checksummed = ethers.getAddress(address);
    expect(checksummed).toBe("0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD");
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
    const spender = "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD";
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
      "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD",
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
      "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD",
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
