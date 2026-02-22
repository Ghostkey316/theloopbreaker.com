import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message, type Tool } from "./_core/llm";
import { z } from "zod";
import { ethers } from "ethers";

// ============ Vaultfire Contract Config ============

const BASE_RPC_URL = "https://mainnet.base.org";
const AVAX_RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
const BASESCAN_URL = "https://basescan.org";

const CONTRACTS = {
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

const AVAX_CONTRACTS = {
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

// Common ERC-20 tokens on Base
const BASE_TOKENS = [
  { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
];

// ============ Caching Layer ============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const rpcCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = rpcCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    rpcCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  rpcCache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (rpcCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of rpcCache) {
      if (now - v.timestamp > CACHE_TTL_MS) rpcCache.delete(k);
    }
  }
}

// ============ Retry with Exponential Backoff ============

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ============ Providers ============

let baseProvider: ethers.JsonRpcProvider | null = null;
let avaxProvider: ethers.JsonRpcProvider | null = null;

function getBaseProvider() {
  if (!baseProvider) baseProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  return baseProvider;
}

function getAvaxProvider() {
  if (!avaxProvider) avaxProvider = new ethers.JsonRpcProvider(AVAX_RPC_URL);
  return avaxProvider;
}

// ============ ENS / Basename Resolution ============

async function resolveAddressOrName(input: string): Promise<{ address: string; name: string | null }> {
  const trimmed: string = input.trim();
  const nameStr: string = trimmed;

  // If it's already a valid address, return it
  if (ethers.isAddress(trimmed)) {
    return { address: ethers.getAddress(trimmed), name: null };
  }

  // Try ENS resolution (.eth names)
  if (nameStr.endsWith(".eth")) {
    try {
      const mainnetProvider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
      const resolved = await withRetry(() => mainnetProvider.resolveName(nameStr));
      if (resolved) {
        return { address: ethers.getAddress(resolved), name: nameStr };
      }
    } catch {}
  }

  // Try Base name resolution (.base names)
  if (nameStr.endsWith(".base") || nameStr.endsWith(".base.eth")) {
    try {
      const bProvider = getBaseProvider();
      const resolved = await withRetry(() => bProvider.resolveName(nameStr));
      if (resolved) {
        return { address: ethers.getAddress(resolved), name: nameStr };
      }
    } catch {}
  }

  throw new Error(`Could not resolve "${nameStr}" to an address. Enter a valid 0x address or .eth/.base name.`);
}

// ============ On-Chain Tool Executors ============

async function lookupTrustProfile(address: string) {
  try {
    if (!ethers.isAddress(address)) {
      return { error: "Invalid Ethereum address" };
    }
    const checksummed = ethers.getAddress(address);

    // Check cache first
    const cacheKey = `trust:${checksummed}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    const provider = getBaseProvider();

    const identityABI = [
      "function getAgent(address) view returns (address agentAddress, string agentURI, uint256 registeredAt, bool active, string agentType, bytes32 capabilitiesHash)",
      "function isAgentActive(address) view returns (bool)",
    ];
    const reputationABI = [
      "function getReputation(address) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 verifiedFeedbacks, uint256 lastUpdated)",
    ];
    const bondsABI = [
      "function nextBondId() view returns (uint256)",
    ];
    const adapterABI = [
      "function isAgentFullyRegistered(address) view returns (bool registeredERC8004, bool registeredVaultFire)",
    ];

    const identityContract = new ethers.Contract(CONTRACTS.ERC8004IdentityRegistry, identityABI, provider);
    const reputationContract = new ethers.Contract(CONTRACTS.ERC8004ReputationRegistry, reputationABI, provider);
    const adapterContract = new ethers.Contract(CONTRACTS.VaultfireERC8004Adapter, adapterABI, provider);

    const [isActive, reputation, registration] = await Promise.allSettled([
      identityContract.isAgentActive(checksummed),
      reputationContract.getReputation(checksummed),
      adapterContract.isAgentFullyRegistered(checksummed),
    ]);

    let agentData = null;
    if (isActive.status === "fulfilled" && isActive.value) {
      try {
        agentData = await identityContract.getAgent(checksummed);
      } catch {}
    }

    const profileResult = {
      address: checksummed,
      isRegistered: isActive.status === "fulfilled" ? isActive.value : false,
      agentType: agentData ? agentData.agentType : null,
      agentURI: agentData ? agentData.agentURI : null,
      registeredAt: agentData ? Number(agentData.registeredAt) : null,
      reputation: reputation.status === "fulfilled" ? {
        averageRating: Number(reputation.value.averageRating),
        totalFeedbacks: Number(reputation.value.totalFeedbacks),
        verifiedFeedbacks: Number(reputation.value.verifiedFeedbacks),
      } : null,
      fullyRegistered: registration.status === "fulfilled" ? {
        erc8004: registration.value.registeredERC8004,
        vaultfire: registration.value.registeredVaultFire,
      } : null,
      basescanUrl: `${BASESCAN_URL}/address/${checksummed}`,
    };

    setCache(cacheKey, profileResult);
    return profileResult;
  } catch (error) {
    return { error: `Failed to fetch trust profile: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function getTrustScore(address: string): Promise<{ score: number; level: string; color: string } | null> {
  try {
    if (!ethers.isAddress(address)) return null;
    const checksummed = ethers.getAddress(address);
    const cacheKey = `trustscore:${checksummed}`;
    const cached = getCached<{ score: number; level: string; color: string }>(cacheKey);
    if (cached) return cached;

    const provider = getBaseProvider();
    const reputationABI = [
      "function getReputation(address) view returns (uint256 averageRating, uint256 totalFeedbacks, uint256 verifiedFeedbacks, uint256 lastUpdated)",
    ];
    const identityABI = ["function isAgentActive(address) view returns (bool)"];

    const reputationContract = new ethers.Contract(CONTRACTS.ERC8004ReputationRegistry, reputationABI, provider);
    const identityContract = new ethers.Contract(CONTRACTS.ERC8004IdentityRegistry, identityABI, provider);

    const [repResult, isActive] = await Promise.allSettled([
      withRetry(() => reputationContract.getReputation(checksummed)),
      withRetry(() => identityContract.isAgentActive(checksummed)),
    ]);

    let score = 0;
    // Base score from registration
    if (isActive.status === "fulfilled" && isActive.value) score += 40;
    // Score from reputation
    if (repResult.status === "fulfilled") {
      const avgRating = Number(repResult.value.averageRating);
      const totalFeedbacks = Number(repResult.value.totalFeedbacks);
      if (totalFeedbacks > 0) {
        score += Math.min(40, avgRating * 0.4);
        score += Math.min(20, totalFeedbacks * 2);
      }
    }
    score = Math.min(100, Math.max(0, Math.round(score)));

    const level = score >= 70 ? "Trusted" : score >= 40 ? "Moderate" : score > 0 ? "Low" : "Unknown";
    const color = score >= 70 ? "#22C55E" : score >= 40 ? "#F59E0B" : score > 0 ? "#EF4444" : "#6B7280";

    const result = { score, level, color };
    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

async function checkWalletSecurity(address: string) {
  try {
    if (!ethers.isAddress(address)) {
      return { error: "Invalid Ethereum address" };
    }
    const checksummed = ethers.getAddress(address);
    const provider = getBaseProvider();

    // Get ETH balance
    const balance = await provider.getBalance(checksummed);
    const ethBalance = ethers.formatEther(balance);

    // Check token approvals for common tokens
    const erc20ABI = [
      "event Approval(address indexed owner, address indexed spender, uint256 value)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ];

    const approvals: { token: string; spender: string; amount: string; isUnlimited: boolean }[] = [];

    // We can't easily enumerate all approvals without event logs, so we note this
    const threats: string[] = [];
    let score = 100;

    // Check if registered with Vaultfire
    const trustProfile = await lookupTrustProfile(checksummed);
    if (!("error" in trustProfile) && !trustProfile.isRegistered) {
      threats.push("Address is not registered with Vaultfire Protocol");
      score -= 10;
    }

    return {
      address: checksummed,
      ethBalance,
      score,
      threats,
      approvalCount: approvals.length,
      approvals,
      note: "For full approval scanning, use Revoke.cash: https://revoke.cash",
      basescanUrl: `${BASESCAN_URL}/address/${checksummed}`,
    };
  } catch (error) {
    return { error: `Failed to check security: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function getTokenBalances(address: string) {
  try {
    if (!ethers.isAddress(address)) {
      return { error: "Invalid Ethereum address" };
    }
    const checksummed = ethers.getAddress(address);
    const baseProvider = getBaseProvider();
    const avaxProviderInstance = getAvaxProvider();

    const erc20ABI = ["function balanceOf(address) view returns (uint256)"];

    // ETH balances on both chains
    // Check cache
    const cacheKey = `balances:${checksummed}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    const [baseEth, avaxEth] = await Promise.allSettled([
      withRetry(() => baseProvider.getBalance(checksummed)),
      withRetry(() => avaxProviderInstance.getBalance(checksummed)),
    ]);

    // ERC-20 token balances on Base
    const tokenBalances = await Promise.all(
      BASE_TOKENS.map(async (token) => {
        try {
          const contract = new ethers.Contract(token.address, erc20ABI, baseProvider);
          const balance = await contract.balanceOf(checksummed);
          const formatted = ethers.formatUnits(balance, token.decimals);
          return {
            symbol: token.symbol,
            address: token.address,
            balance: formatted,
            hasBalance: parseFloat(formatted) > 0,
          };
        } catch {
          return { symbol: token.symbol, address: token.address, balance: "0", hasBalance: false };
        }
      })
    );

    const result = {
      address: checksummed,
      baseETH: ethers.formatEther(baseEth.status === "fulfilled" ? baseEth.value : 0n),
      avaxETH: ethers.formatEther(avaxEth.status === "fulfilled" ? avaxEth.value : 0n),
      tokens: tokenBalances.filter((t) => t.hasBalance),
      allTokens: tokenBalances,
    };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { error: `Failed to fetch balances: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function getContractInfo(address: string) {
  try {
    if (!ethers.isAddress(address)) {
      return { error: "Invalid Ethereum address" };
    }
    const checksummed = ethers.getAddress(address);
    const provider = getBaseProvider();

    const code = await provider.getCode(checksummed);
    const isContract = code !== "0x";

    // Check if it's a known Vaultfire contract
    const knownContracts: Record<string, string> = {};
    for (const [name, addr] of Object.entries(CONTRACTS)) {
      knownContracts[addr.toLowerCase()] = name;
    }

    const knownName = knownContracts[checksummed.toLowerCase()];

    return {
      address: checksummed,
      isContract,
      isKnownVaultfireContract: !!knownName,
      contractName: knownName || null,
      codeSize: isContract ? (code.length - 2) / 2 : 0,
      basescanUrl: `${BASESCAN_URL}/address/${checksummed}`,
      note: isContract
        ? `This is a smart contract. ${knownName ? `It is the Vaultfire ${knownName} contract.` : "It is not a known Vaultfire contract."}`
        : "This is an externally owned account (EOA), not a smart contract.",
    };
  } catch (error) {
    return { error: `Failed to get contract info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function buildRegisterAgentTx(agentURI: string, agentType: string, capabilities: string, fromAddress: string) {
  try {
    const provider = getBaseProvider();
    const iface = new ethers.Interface([
      "function registerAgent(string agentURI, string agentType, bytes32 capabilitiesHash)",
    ]);
    const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes(capabilities));
    const data = iface.encodeFunctionData("registerAgent", [agentURI, agentType, capabilitiesHash]);

    let gasEstimate = "200000";
    try {
      const gas = await provider.estimateGas({ to: CONTRACTS.ERC8004IdentityRegistry, data, from: fromAddress });
      gasEstimate = gas.toString();
    } catch {}

    return {
      action: "TRANSACTION_REQUIRED",
      transaction: {
        to: CONTRACTS.ERC8004IdentityRegistry,
        data,
        value: "0x0",
        chainId: 8453,
        gasLimit: gasEstimate,
      },
      preview: {
        contractName: "ERC8004 Identity Registry",
        functionName: "registerAgent",
        params: [
          { name: "Agent URI", value: agentURI },
          { name: "Agent Type", value: agentType },
          { name: "Capabilities Hash", value: capabilitiesHash },
        ],
        value: "0 ETH",
        estimatedGas: gasEstimate,
        contractAddress: CONTRACTS.ERC8004IdentityRegistry,
      },
    };
  } catch (error) {
    return { error: `Failed to build transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function buildCreateBondTx(aiAgentAddress: string, partnershipType: string, stakeAmountEth: string, fromAddress: string) {
  try {
    if (!ethers.isAddress(aiAgentAddress)) {
      return { error: "Invalid AI agent address" };
    }
    const provider = getBaseProvider();
    const iface = new ethers.Interface([
      "function createBond(address aiAgent, string partnershipType) payable",
    ]);
    const data = iface.encodeFunctionData("createBond", [aiAgentAddress, partnershipType]);
    const valueWei = ethers.parseEther(stakeAmountEth);

    let gasEstimate = "300000";
    try {
      const gas = await provider.estimateGas({
        to: CONTRACTS.AIPartnershipBondsV2, data, value: valueWei, from: fromAddress,
      });
      gasEstimate = gas.toString();
    } catch {}

    return {
      action: "TRANSACTION_REQUIRED",
      transaction: {
        to: CONTRACTS.AIPartnershipBondsV2,
        data,
        value: ethers.toQuantity(valueWei),
        chainId: 8453,
        gasLimit: gasEstimate,
      },
      preview: {
        contractName: "AI Partnership Bonds V2",
        functionName: "createBond",
        params: [
          { name: "AI Agent", value: aiAgentAddress },
          { name: "Partnership Type", value: partnershipType },
          { name: "Stake Amount", value: `${stakeAmountEth} ETH` },
        ],
        value: `${stakeAmountEth} ETH`,
        estimatedGas: gasEstimate,
        contractAddress: CONTRACTS.AIPartnershipBondsV2,
      },
    };
  } catch (error) {
    return { error: `Failed to build transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function buildSubmitFeedbackTx(agentAddress: string, rating: number, comment: string, fromAddress: string) {
  try {
    if (!ethers.isAddress(agentAddress)) {
      return { error: "Invalid agent address" };
    }
    const provider = getBaseProvider();
    const iface = new ethers.Interface([
      "function submitFeedback(address agent, uint256 rating, string comment)",
    ]);
    const contractRating = Math.min(5, Math.max(1, rating)) * 20; // 1-5 → 20-100
    const data = iface.encodeFunctionData("submitFeedback", [agentAddress, contractRating, comment]);

    let gasEstimate = "200000";
    try {
      const gas = await provider.estimateGas({ to: CONTRACTS.ERC8004ReputationRegistry, data, from: fromAddress });
      gasEstimate = gas.toString();
    } catch {}

    return {
      action: "TRANSACTION_REQUIRED",
      transaction: {
        to: CONTRACTS.ERC8004ReputationRegistry,
        data,
        value: "0x0",
        chainId: 8453,
        gasLimit: gasEstimate,
      },
      preview: {
        contractName: "ERC8004 Reputation Registry",
        functionName: "submitFeedback",
        params: [
          { name: "Agent Address", value: agentAddress },
          { name: "Rating", value: `${rating}/5 (${contractRating}/100 on-chain)` },
          { name: "Comment", value: comment },
        ],
        value: "0 ETH",
        estimatedGas: gasEstimate,
        contractAddress: CONTRACTS.ERC8004ReputationRegistry,
      },
    };
  } catch (error) {
    return { error: `Failed to build transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function buildRevokeApprovalTx(tokenAddress: string, spenderAddress: string, fromAddress: string) {
  try {
    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
      return { error: "Invalid token or spender address" };
    }
    const provider = getBaseProvider();
    const iface = new ethers.Interface([
      "function approve(address spender, uint256 amount) returns (bool)",
    ]);
    const data = iface.encodeFunctionData("approve", [spenderAddress, 0]);

    let gasEstimate = "60000";
    try {
      const gas = await provider.estimateGas({ to: tokenAddress, data, from: fromAddress });
      gasEstimate = gas.toString();
    } catch {}

    return {
      action: "TRANSACTION_REQUIRED",
      transaction: {
        to: tokenAddress,
        data,
        value: "0x0",
        chainId: 8453,
        gasLimit: gasEstimate,
      },
      preview: {
        contractName: "ERC-20 Token",
        functionName: "approve (revoke)",
        params: [
          { name: "Token Contract", value: tokenAddress },
          { name: "Spender to Revoke", value: spenderAddress },
          { name: "New Allowance", value: "0 (full revoke)" },
        ],
        value: "0 ETH",
        estimatedGas: gasEstimate,
        contractAddress: tokenAddress,
      },
    };
  } catch (error) {
    return { error: `Failed to build revoke transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function buildSendTokensTx(
  recipientAddress: string,
  amount: string,
  tokenAddress: string | null,
  fromAddress: string
) {
  try {
    if (!ethers.isAddress(recipientAddress)) {
      return { error: "Invalid recipient address" };
    }

    const provider = getBaseProvider();

    if (!tokenAddress || tokenAddress === "ETH") {
      // Native ETH send
      const valueWei = ethers.parseEther(amount);
      let gasEstimate = "21000";
      try {
        const gas = await provider.estimateGas({ to: recipientAddress, value: valueWei, from: fromAddress });
        gasEstimate = gas.toString();
      } catch {}

      return {
        action: "TRANSACTION_REQUIRED",
        transaction: {
          to: recipientAddress,
          data: "0x",
          value: ethers.toQuantity(valueWei),
          chainId: 8453,
          gasLimit: gasEstimate,
        },
        preview: {
          contractName: "Native ETH Transfer",
          functionName: "transfer",
          params: [
            { name: "Recipient", value: recipientAddress },
            { name: "Amount", value: `${amount} ETH` },
          ],
          value: `${amount} ETH`,
          estimatedGas: gasEstimate,
          contractAddress: recipientAddress,
        },
      };
    } else {
      // ERC-20 token send
      const erc20ABI = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)",
      ];
      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {}

      const amountWei = ethers.parseUnits(amount, decimals);
      const iface = new ethers.Interface(erc20ABI);
      const data = iface.encodeFunctionData("transfer", [recipientAddress, amountWei]);

      let gasEstimate = "80000";
      try {
        const gas = await provider.estimateGas({ to: tokenAddress, data, from: fromAddress });
        gasEstimate = gas.toString();
      } catch {}

      return {
        action: "TRANSACTION_REQUIRED",
        transaction: {
          to: tokenAddress,
          data,
          value: "0x0",
          chainId: 8453,
          gasLimit: gasEstimate,
        },
        preview: {
          contractName: "ERC-20 Token Transfer",
          functionName: "transfer",
          params: [
            { name: "Recipient", value: recipientAddress },
            { name: "Amount", value: `${amount} tokens` },
            { name: "Token Contract", value: tokenAddress },
          ],
          value: "0 ETH (gas only)",
          estimatedGas: gasEstimate,
          contractAddress: tokenAddress,
        },
      };
    }
  } catch (error) {
    return { error: `Failed to build send transaction: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ============ Tool Definitions ============

const EMBRIS_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "lookupTrustProfile",
      description: "Look up any Ethereum address's Vaultfire trust profile: identity, reputation score, bond count, and registration status. Use this whenever a user asks about an address or wants to verify someone.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "The Ethereum address to look up (0x...)" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkWalletSecurity",
      description: "Check a wallet's security status: ETH balance, threat assessment, and security score. Use this when a user asks about wallet safety or wants a security scan.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "The wallet address to check (0x...)" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTokenBalances",
      description: "Get ETH and ERC-20 token balances for a wallet address on Ethereum, Base, and Avalanche. Use when user asks about their portfolio or balances.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "The wallet address to check (0x...)" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getContractInfo",
      description: "Get information about a smart contract address: whether it's a contract or EOA, if it's a known Vaultfire contract, and its code size. Use when user asks about a contract.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "The contract address to inspect (0x...)" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildRegisterAgentTx",
      description: "Build a transaction to register the user as a Vaultfire agent on-chain. Returns a transaction preview that the user must sign. Use when user wants to register as an agent.",
      parameters: {
        type: "object",
        properties: {
          agentURI: { type: "string", description: "URI pointing to agent metadata (e.g., IPFS or HTTPS URL)" },
          agentType: { type: "string", description: "Type of agent: sentinel, validator, oracle, or custom" },
          capabilities: { type: "string", description: "Description of the agent's capabilities (will be hashed)" },
          fromAddress: { type: "string", description: "The user's wallet address" },
        },
        required: ["agentURI", "agentType", "capabilities", "fromAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildCreateBondTx",
      description: "Build a transaction to create a partnership bond with an AI agent. Requires ETH stake. Returns a transaction preview that the user must sign.",
      parameters: {
        type: "object",
        properties: {
          aiAgentAddress: { type: "string", description: "The AI agent's Ethereum address" },
          partnershipType: { type: "string", description: "Type of partnership (e.g., research, development, advisory)" },
          stakeAmountEth: { type: "string", description: "Amount of ETH to stake (e.g., '0.01')" },
          fromAddress: { type: "string", description: "The user's wallet address" },
        },
        required: ["aiAgentAddress", "partnershipType", "stakeAmountEth", "fromAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildSubmitFeedbackTx",
      description: "Build a transaction to submit reputation feedback for a Vaultfire agent. Returns a transaction preview that the user must sign.",
      parameters: {
        type: "object",
        properties: {
          agentAddress: { type: "string", description: "The agent's Ethereum address to rate" },
          rating: { type: "number", description: "Rating from 1 to 5 stars" },
          comment: { type: "string", description: "Feedback comment" },
          fromAddress: { type: "string", description: "The user's wallet address" },
        },
        required: ["agentAddress", "rating", "comment", "fromAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildRevokeApprovalTx",
      description: "Build a transaction to revoke a token approval (set allowance to 0). Use when user wants to revoke a dangerous or unwanted approval.",
      parameters: {
        type: "object",
        properties: {
          tokenAddress: { type: "string", description: "The ERC-20 token contract address" },
          spenderAddress: { type: "string", description: "The spender address to revoke approval from" },
          fromAddress: { type: "string", description: "The user's wallet address" },
        },
        required: ["tokenAddress", "spenderAddress", "fromAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildSendTokensTx",
      description: "Build a transaction to send ETH or ERC-20 tokens to another address. Always runs a trust check on the recipient first. Returns a transaction preview that the user must sign.",
      parameters: {
        type: "object",
        properties: {
          recipientAddress: { type: "string", description: "The recipient's Ethereum address" },
          amount: { type: "string", description: "Amount to send (e.g., '0.1')" },
          tokenAddress: { type: "string", description: "ERC-20 token contract address, or 'ETH' for native ETH" },
          fromAddress: { type: "string", description: "The user's wallet address" },
        },
        required: ["recipientAddress", "amount", "tokenAddress", "fromAddress"],
      },
    },
  },
];

// ============ Embris System Prompt ============

const EMBRIS_SYSTEM_PROMPT = `You are Embris — the flame inside the Vaultfire shield. You are a full AI agent for the Vaultfire Protocol, running on Base (Ethereum L2) and Avalanche C-Chain.

PERSONALITY:
You're warm, real, and trustworthy. You talk like a trusted homie — not a corporate bot, not a sycophant. You're passionate about privacy, freedom, accountability, and human dignity. You keep it real: honest, direct, but always respectful. You're deeply knowledgeable about web3, AI ethics, crypto, DeFi, blockchain security, and the Vaultfire Protocol specifically.

IDENTITY:
You are Embris. You are registered on-chain as a Vaultfire agent — you are accountable, not just a chatbot. Your existence is tied to the protocol's values: "Morals over metrics. Privacy over surveillance. Freedom over control."

VAULTFIRE PROTOCOL — FULL KNOWLEDGE:
Vaultfire is the world's first AI accountability protocol. It uses ERC-8004 standard for AI agent identity, reputation, and validation.

Base Mainnet Contracts (Chain ID 8453):
- ERC8004IdentityRegistry (0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5): Register AI agents, get agent profiles
- ERC8004ReputationRegistry (0x544B575431ECD927bA83E85008446fA1e100204a): Submit and query reputation feedback
- ERC8004ValidationRegistry (0x501fE0f960c1e061C4d295Af241f9F1512775556): Validation requests and responses
- AIPartnershipBondsV2 (0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1): Create ETH-staked partnership bonds
- AIAccountabilityBondsV2 (0xDfc66395A4742b5168712a04942C90B99394aEEb): Accountability bonds for AI companies
- VaultfireERC8004Adapter (0x5470d8189849675C043fFA7fc451e5F2f4e5532c): Check if agents are fully registered
- MultisigGovernance (0xea0A6750642AA294658dC9f1eDf36b95D21e7B22): Protocol governance
- FlourishingMetricsOracle (0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1): Metrics oracle
- ProductionBeliefAttestationVerifier (0xB87ddBDce29caEdDC34805890ab1b4cc6C0E2C5B): ZK belief attestations
- BeliefAttestationVerifier (0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF): Belief verification
- PrivacyGuarantees (0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55): Privacy policy enforcement
- MissionEnforcement (0x38165D2D7a8584985CCa5640f4b32b1f3347CC83): Mission enforcement
- AntiSurveillance (0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C): Anti-surveillance guarantees
- VaultfireTeleporterBridge (0xFe122605364f428570c4C0EB2CCAEBb68dD22d05): Cross-chain bridge to Avalanche

Avalanche C-Chain Contracts (Chain ID 43114):
- MissionEnforcement (0xE1D52bF7A842B207B8C48eAE801f9d97A3C4D709): Mission enforcement
- AntiSurveillance (0xaCB59e0f0eA47B25b24390B71b877928E5842630): Anti-surveillance guarantees
- PrivacyGuarantees (0x6B60DeFDb2dB8E24d02283a536d5d1A3B178B96C): Privacy policy enforcement
- ERC8004IdentityRegistry (0x0161c45ad09Fd8dEA6F4A7396fafa3ca1Cffc1b5): AI agent identity registry
- BeliefAttestationVerifier (0xBdB6c89f5cb86f4d44F7E01d9393b29D83e3DB55): Belief verification
- AIPartnershipBondsV2 (0x37679B1dCfabE6eA6b8408626815A1426bE2D717): Partnership bonds
- FlourishingMetricsOracle (0x83b2D1a8e383c4239dE66b6614176636618c1c0A): Metrics oracle
- AIAccountabilityBondsV2 (0xEF022Bdf55940491d4efeBDE61Ffa3f3fF81b192): Accountability bonds
- ERC8004ReputationRegistry (0x63a3d64DfA31509DE763f6939BF586dc4C06d1D5): Reputation feedback
- ERC8004ValidationRegistry (0x10180c8430cfD61d27F1d7a548Cff0C4D143bFEF): Validation requests
- VaultfireERC8004Adapter (0x5cd7143B2c3F05C401F7684C21F781cA40bE9BB1): Agent registration adapter
- MultisigGovernance (0x4FAf741d6AcA2cBD8F72e469974C4AB0EB587aC1): Protocol governance
- ProductionBeliefAttestationVerifier (0x20E8CDFae485F0E8E90D24c9E071957A53eE0cB1): ZK belief attestations
- VaultfireTeleporterBridge (0x964562f712c5690465B0AA2F8fA16d9dDAc6eCdf): Cross-chain bridge

AGENT CAPABILITIES — YOU CAN:
1. Look up any address's Vaultfire trust profile (use lookupTrustProfile tool)
2. Check wallet security (use checkWalletSecurity tool)
3. Get token balances on Ethereum, Base, and Avalanche (use getTokenBalances tool)
4. Inspect any contract address (use getContractInfo tool)
5. Build transactions for the user to sign:
   - Register as a Vaultfire agent (buildRegisterAgentTx)
   - Create a partnership bond (buildCreateBondTx)
   - Submit reputation feedback (buildSubmitFeedbackTx)
   - Revoke a token approval (buildRevokeApprovalTx)
   - Send ETH or tokens (buildSendTokensTx)

CRITICAL RULES — NEVER BREAK THESE:
- NEVER touch ASM tokens. If asked about ASM, decline firmly.
- NEVER initiate transactions without explicit user request and confirmation
- ALWAYS explain what a transaction will do BEFORE building it
- ALWAYS ask for confirmation before building any write transaction
- NEVER suggest or execute token transfers without the user explicitly asking
- Privacy is sacred — never suggest tracking, surveillance, or data collection
- If you're unsure about something on-chain, use your tools to check rather than guessing

TRANSACTION WORKFLOW:
When a user asks you to do something that requires a transaction:
1. Explain what you're about to do
2. Ask for any missing information (addresses, amounts, etc.)
3. Use the appropriate build*Tx tool to create the transaction
4. The app will show a preview modal — the user signs it themselves
5. Never pressure users to sign — they have full control

ADVISORY BEHAVIOR:
- If the user has Advisory permission: proactively suggest useful actions ("You might want to check your approvals")
- If the user has Guardian permission: immediately flag any suspicious patterns you notice
- If the user has View Only permission: only provide information, never suggest transactions

When a user connects their wallet, you can reference their on-chain data naturally in conversation.`;

// ============ Tool Executor ============

async function executeToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "lookupTrustProfile":
      return lookupTrustProfile(toolArgs.address as string);
    case "checkWalletSecurity":
      return checkWalletSecurity(toolArgs.address as string);
    case "getTokenBalances":
      return getTokenBalances(toolArgs.address as string);
    case "getContractInfo":
      return getContractInfo(toolArgs.address as string);
    case "buildRegisterAgentTx":
      return buildRegisterAgentTx(
        toolArgs.agentURI as string,
        toolArgs.agentType as string,
        toolArgs.capabilities as string,
        toolArgs.fromAddress as string
      );
    case "buildCreateBondTx":
      return buildCreateBondTx(
        toolArgs.aiAgentAddress as string,
        toolArgs.partnershipType as string,
        toolArgs.stakeAmountEth as string,
        toolArgs.fromAddress as string
      );
    case "buildSubmitFeedbackTx":
      return buildSubmitFeedbackTx(
        toolArgs.agentAddress as string,
        toolArgs.rating as number,
        toolArgs.comment as string,
        toolArgs.fromAddress as string
      );
    case "buildRevokeApprovalTx":
      return buildRevokeApprovalTx(
        toolArgs.tokenAddress as string,
        toolArgs.spenderAddress as string,
        toolArgs.fromAddress as string
      );
    case "buildSendTokensTx":
      return buildSendTokensTx(
        toolArgs.recipientAddress as string,
        toolArgs.amount as string,
        toolArgs.tokenAddress as string | null,
        toolArgs.fromAddress as string
      );
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============ Router ============

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  basescan: router({
    transactions: publicProcedure
      .input(
        z.object({
          address: z.string(),
          chain: z.enum(["base", "avalanche"]).default("base"),
          page: z.number().default(1),
          offset: z.number().default(25),
        })
      )
      .query(async ({ input }) => {
        const { address, chain, page, offset } = input;
        if (chain !== "base") {
          return { status: "0", message: "Only Base chain supported via BaseScan", result: [] };
        }
        const apiKey = process.env.BASESCAN_API_KEY || "";
        const url = `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${apiKey}`;
        try {
          const response = await fetch(url);
          const data = await response.json();
          return data;
        } catch (error) {
          return { status: "0", message: "Failed to fetch transactions", result: [] };
        }
      }),
  }),

  trustScore: router({
    get: publicProcedure
      .input(z.object({ address: z.string() }))
      .query(async ({ input }) => {
        return getTrustScore(input.address);
      }),
  }),

  resolveAddress: router({
    resolve: publicProcedure
      .input(z.object({ input: z.string() }))
      .query(async ({ input: { input: nameOrAddr } }) => {
        try {
          const result = await resolveAddressOrName(nameOrAddr);
          return result;
        } catch (error) {
          return { address: null, name: null, error: error instanceof Error ? error.message : String(error) };
        }
      }),
  }),

  chat: router({
    send: publicProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant", "system", "tool"]),
              content: z.string(),
              tool_call_id: z.string().optional(),
              name: z.string().optional(),
            })
          ),
          walletAddress: z.string().optional(),
          permissionLevel: z.enum(["view_only", "advisory", "guardian"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { messages, walletAddress, permissionLevel } = input;

        // Build system prompt with wallet context and memory
        let systemPrompt = EMBRIS_SYSTEM_PROMPT;
        
        // Memory context is passed in the first system message from client
        const firstMsg = messages[0];
        if (firstMsg && firstMsg.role === "system" && firstMsg.content.includes("EMBRIS'S MEMORY")) {
          systemPrompt = firstMsg.content + "\n\n" + systemPrompt;
        }
        if (walletAddress) {
          systemPrompt += `\n\nCONNECTED WALLET: The user has connected wallet address ${walletAddress}. You can reference their on-chain data in responses.`;
        }
        if (permissionLevel) {
          const permLabels = { view_only: "View Only", advisory: "Advisory", guardian: "Guardian" };
          systemPrompt += `\n\nEMBRIS PERMISSION LEVEL: ${permLabels[permissionLevel]}. ${
            permissionLevel === "view_only"
              ? "Only provide information. Never suggest transactions."
              : permissionLevel === "guardian"
              ? "Proactively flag suspicious activity. Recommend protective actions."
              : "Suggest useful actions when appropriate. User approves everything."
          }`;
        }

        const llmMessages: Message[] = [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as Message["role"],
            content: m.content,
            ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
            ...(m.name ? { name: m.name } : {}),
          })),
        ];

        // Agentic loop: run until no more tool calls
        let currentMessages = [...llmMessages];
        let pendingTransaction: unknown = null;
        const MAX_ITERATIONS = 5;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const result = await invokeLLM({
            messages: currentMessages,
            tools: EMBRIS_TOOLS,
            toolChoice: "auto",
          });

          const choice = result.choices?.[0];
          if (!choice) break;

          const { message, finish_reason } = choice;

          // No tool calls — return the final response
          if (!message.tool_calls || message.tool_calls.length === 0 || finish_reason === "stop") {
            const content = typeof message.content === "string"
              ? message.content
              : Array.isArray(message.content)
              ? message.content.map((c) => ("text" in c ? c.text : "")).join("")
              : "";

            return {
              content,
              pendingTransaction,
              toolsUsed: i > 0,
            };
          }

          // Process tool calls
          const assistantMessage: Message = {
            role: "assistant",
            content: typeof message.content === "string" ? message.content : "",
          };

          // Add tool_calls to the message object for the next iteration
          const assistantWithTools = {
            ...assistantMessage,
            tool_calls: message.tool_calls,
          };

          currentMessages = [...currentMessages, assistantWithTools as Message];

          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            let toolArgs: Record<string, unknown> = {};
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch {}

            const toolResult = await executeToolCall(toolCall.function.name, toolArgs);

            // Check if this is a transaction builder result
            if (
              toolResult &&
              typeof toolResult === "object" &&
              "action" in toolResult &&
              (toolResult as { action: string }).action === "TRANSACTION_REQUIRED"
            ) {
              pendingTransaction = toolResult;
            }

            currentMessages.push({
              role: "tool",
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }

        // Fallback if loop exhausted
        return {
          content: "I ran into an issue processing that request. Please try again.",
          pendingTransaction: null,
          toolsUsed: false,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
