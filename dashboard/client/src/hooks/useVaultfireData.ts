/**
 * Vaultfire Protocol — On-chain data fetching hooks
 * Reads live data from 14 contracts on Base mainnet via ethers.js
 *
 * Resilience strategy:
 * - Multiple public RPC fallbacks to handle rate-limiting
 * - safeCallWithRetry: retries once with delay before returning fallback
 * - Parallel eth_getCode via raw fetch (bypasses ethers.js provider queue)
 * - Individual contract failures do not block other contracts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  BASE_RPC_URL,
  CONTRACTS,
  ERC8004IdentityRegistryABI,
  AIPartnershipBondsV2ABI,
  AIAccountabilityBondsV2ABI,
  ERC8004ReputationRegistryABI,
  MultisigGovernanceABI,
  FlourishingMetricsOracleABI,
  ProductionBeliefAttestationVerifierABI,
  BeliefAttestationVerifierABI,
  ERC8004ValidationRegistryABI,
  MissionEnforcementABI,
  AntiSurveillanceABI,
  OwnerABI,
} from "@/lib/contracts";

// ============ RPC Provider pool with fallbacks ============

const RPC_URLS = [
  BASE_RPC_URL,                                   // https://mainnet.base.org
  "https://base.publicnode.com",                  // PublicNode (no rate limit)
  "https://base-rpc.publicnode.com",              // PublicNode alt
  "https://1rpc.io/base",                         // 1RPC
];

const BASE_NETWORK = new ethers.Network("base", 8453);

// Provider pool — one per RPC URL, created lazily
const _providers: Map<string, ethers.JsonRpcProvider> = new Map();

function getProvider(rpcUrl: string = RPC_URLS[0]): ethers.JsonRpcProvider {
  if (!_providers.has(rpcUrl)) {
    _providers.set(
      rpcUrl,
      new ethers.JsonRpcProvider(rpcUrl, BASE_NETWORK, { staticNetwork: BASE_NETWORK })
    );
  }
  return _providers.get(rpcUrl)!;
}

// Primary provider (first in list)
function getPrimaryProvider(): ethers.JsonRpcProvider {
  return getProvider(RPC_URLS[0]);
}

function getContract(address: string, abi: string[], rpcUrl?: string): ethers.Contract {
  // Normalize to EIP-55 checksum address to prevent INVALID_ARGUMENT errors
  const checksumAddr = ethers.getAddress(address.toLowerCase());
  return new ethers.Contract(checksumAddr, abi, getProvider(rpcUrl));
}

// ============ Safe call helpers ============

const RETRY_DELAY_MS = 600;

/** Try fn(), on failure wait RETRY_DELAY_MS and try once more, then return fallback */
async function safeCallWithRetry<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    // Wait and retry once
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }
}

/** Try fn() with each RPC URL in order until one succeeds */
async function safeCallWithFallback<T>(
  fnFactory: (rpcUrl: string) => () => Promise<T>,
  fallback: T
): Promise<T> {
  for (const rpcUrl of RPC_URLS) {
    try {
      return await fnFactory(rpcUrl)();
    } catch {
      // Try next RPC
    }
  }
  return fallback;
}

/** Simple safe call — no retry */
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ============ Raw JSON-RPC helpers (bypass ethers.js for getCode) ============

/** Call eth_getCode via raw fetch, trying each RPC URL in order */
async function rawGetCode(address: string): Promise<string> {
  const checksumAddr = ethers.getAddress(address.toLowerCase());
  for (const rpcUrl of RPC_URLS) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getCode",
          params: [checksumAddr, "latest"],
          id: 1,
        }),
      });
      const data = await res.json();
      if (data.result && data.result !== "0x") {
        return data.result;
      }
      if (data.result === "0x") {
        return "0x"; // Confirmed empty — no need to try fallback
      }
    } catch {
      // Try next RPC
    }
  }
  return "0x";
}

/** Call an eth_call via raw fetch with fallback RPCs */
async function rawEthCall(address: string, data: string): Promise<string> {
  const checksumAddr = ethers.getAddress(address.toLowerCase());
  for (const rpcUrl of RPC_URLS) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: checksumAddr, data }, "latest"],
          id: 1,
        }),
      });
      const json = await res.json();
      if (json.result && json.result !== "0x" && !json.error) {
        return json.result;
      }
    } catch {
      // Try next RPC
    }
  }
  return "0x";
}

// ============ Types ============

export interface AgentInfo {
  address: string;
  agentURI: string;
  registeredAt: number;
  active: boolean;
  agentType: string;
  capabilitiesHash: string;
}

export interface PartnershipBond {
  bondId: number;
  human: string;
  aiAgent: string;
  partnershipType: string;
  stakeAmount: bigint;
  createdAt: number;
  distributionPending: boolean;
  active: boolean;
}

export interface AccountabilityBond {
  bondId: number;
  aiCompany: string;
  companyName: string;
  quarterlyRevenue: bigint;
  stakeAmount: bigint;
  createdAt: number;
  distributionPending: boolean;
  active: boolean;
}

export interface GovernanceTransaction {
  txId: number;
  to: string;
  value: bigint;
  data: string;
  executed: boolean;
  confirmationCount: number;
  proposedAt: number;
  isReady: boolean;
}

export interface OracleRound {
  roundId: number;
  metricId: string;
  startTime: number;
  deadline: number;
  consensusValue: bigint;
  finalized: boolean;
  submissionCount: number;
}

export interface ContractHealth {
  name: string;
  address: string;
  owner: string | null;
  hasCode: boolean;
  paused: boolean | null;
}

export interface ProtocolOverview {
  totalContracts: number;
  network: string;
  totalAgents: number;
  totalPartnershipBonds: number;
  totalAccountabilityBonds: number;
  totalAttestations: number;
  totalValidationRequests: number;
  totalFeedbacks: number;
}

export interface TimelockInfo {
  pendingImageId: string;
  effectiveAt: number;
  isReady: boolean;
}

// ============ Hooks ============

export function useProtocolOverview() {
  const [data, setData] = useState<ProtocolOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);

      // Use raw eth_call with fallback RPCs for maximum reliability
      // Function selectors (keccak256 of signature, first 4 bytes):
      const SEL_getTotalAgents  = "0x3731a16f"; // getTotalAgents()
      const SEL_nextBondId      = "0xee53a423"; // nextBondId()
      const SEL_attestationCount = "0xa15b9321"; // attestationCount()
      const SEL_nextRequestId   = "0x6a84a985"; // nextRequestId()
      const SEL_nextFeedbackId  = "0x98928e15"; // nextFeedbackId()

      const [
        agentsRaw,
        partnershipRaw,
        accountabilityRaw,
        attestationRaw,
        requestRaw,
        feedbackRaw,
      ] = await Promise.all([
        rawEthCall(CONTRACTS.ERC8004IdentityRegistry, SEL_getTotalAgents),
        rawEthCall(CONTRACTS.AIPartnershipBondsV2, SEL_nextBondId),
        rawEthCall(CONTRACTS.AIAccountabilityBondsV2, SEL_nextBondId),
        rawEthCall(CONTRACTS.ProductionBeliefAttestationVerifier, SEL_attestationCount),
        rawEthCall(CONTRACTS.ERC8004ValidationRegistry, SEL_nextRequestId),
        rawEthCall(CONTRACTS.ERC8004ReputationRegistry, SEL_nextFeedbackId),
      ]);

      const toNum = (hex: string, fallback = 0) => {
        try { return parseInt(hex, 16); } catch { return fallback; }
      };

      const totalAgents     = toNum(agentsRaw);
      const nextPartnership = toNum(partnershipRaw, 1);
      const nextAccount     = toNum(accountabilityRaw, 1);
      const attestations    = toNum(attestationRaw);
      const nextRequest     = toNum(requestRaw, 1);
      const nextFeedback    = toNum(feedbackRaw, 1);

      setData({
        totalContracts: 14,
        network: "Base",
        totalAgents,
        totalPartnershipBonds: Math.max(0, nextPartnership - 1),
        totalAccountabilityBonds: Math.max(0, nextAccount - 1),
        totalAttestations: attestations,
        totalValidationRequests: Math.max(0, nextRequest - 1),
        totalFeedbacks: Math.max(0, nextFeedback - 1),
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch protocol overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useRegisteredAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.ERC8004IdentityRegistry, ERC8004IdentityRegistryABI);
      const totalAgents = await safeCallWithRetry(() => contract.getTotalAgents(), BigInt(0));
      const count = Number(totalAgents);

      if (count === 0) {
        setAgents([]);
        setError(null);
        return;
      }

      const agentList: AgentInfo[] = [];
      const batchSize = Math.min(count, 20); // Limit to first 20

      for (let i = 0; i < batchSize; i++) {
        try {
          const addr = await contract.registeredAgents(i);
          const info = await contract.getAgent(addr);
          agentList.push({
            address: addr,
            agentURI: info.agentURI || info[1],
            registeredAt: Number(info.registeredAt || info[2]),
            active: info.active ?? info[3],
            agentType: info.agentType || info[4],
            capabilitiesHash: info.capabilitiesHash || info[5],
          });
        } catch {
          // Skip failed entries
        }
      }

      setAgents(agentList);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { agents, loading, error, refetch: fetch };
}

export function usePartnershipBonds() {
  const [bonds, setBonds] = useState<PartnershipBond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.AIPartnershipBondsV2, AIPartnershipBondsV2ABI);
      const nextId = await safeCallWithRetry(() => contract.nextBondId(), BigInt(1));
      const count = Number(nextId) - 1;

      if (count <= 0) {
        setBonds([]);
        setError(null);
        return;
      }

      const bondList: PartnershipBond[] = [];
      const batchSize = Math.min(count, 20);

      for (let i = 1; i <= batchSize; i++) {
        try {
          const b = await contract.bonds(i);
          bondList.push({
            bondId: Number(b[0] ?? b.bondId),
            human: b[1] ?? b.human,
            aiAgent: b[2] ?? b.aiAgent,
            partnershipType: b[3] ?? b.partnershipType,
            stakeAmount: b[4] ?? b.stakeAmount,
            createdAt: Number(b[5] ?? b.createdAt),
            distributionPending: b[7] ?? b.distributionPending,
            active: b[8] ?? b.active,
          });
        } catch {
          // Skip
        }
      }

      setBonds(bondList);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch partnership bonds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { bonds, loading, error, refetch: fetch };
}

export function useAccountabilityBonds() {
  const [bonds, setBonds] = useState<AccountabilityBond[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.AIAccountabilityBondsV2, AIAccountabilityBondsV2ABI);
      const nextId = await safeCallWithRetry(() => contract.nextBondId(), BigInt(1));
      const count = Number(nextId) - 1;

      if (count <= 0) {
        setBonds([]);
        setError(null);
        return;
      }

      const bondList: AccountabilityBond[] = [];
      const batchSize = Math.min(count, 20);

      for (let i = 1; i <= batchSize; i++) {
        try {
          const b = await contract.bonds(i);
          bondList.push({
            bondId: Number(b[0] ?? b.bondId),
            aiCompany: b[1] ?? b.aiCompany,
            companyName: b[2] ?? b.companyName,
            quarterlyRevenue: b[3] ?? b.quarterlyRevenue,
            stakeAmount: b[4] ?? b.stakeAmount,
            createdAt: Number(b[5] ?? b.createdAt),
            distributionPending: b[7] ?? b.distributionPending,
            active: b[8] ?? b.active,
          });
        } catch {
          // Skip
        }
      }

      setBonds(bondList);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch accountability bonds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { bonds, loading, error, refetch: fetch };
}

export function useGovernance() {
  const [signers, setSigners] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [transactions, setTransactions] = useState<GovernanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.MultisigGovernance, MultisigGovernanceABI);

      const [signerList, thresh, txCount] = await Promise.all([
        safeCallWithRetry(() => contract.getSigners(), []),
        safeCallWithRetry(() => contract.threshold(), BigInt(0)),
        safeCallWithRetry(() => contract.transactionCount(), BigInt(0)),
      ]);

      setSigners(signerList);
      setThreshold(Number(thresh));

      const count = Number(txCount);
      const txList: GovernanceTransaction[] = [];
      const batchSize = Math.min(count, 10);

      for (let i = count - 1; i >= Math.max(0, count - batchSize); i--) {
        try {
          const tx = await contract.getTransaction(i);
          const ready = await safeCall(() => contract.isTransactionReady(i), false);
          txList.push({
            txId: i,
            to: tx[0],
            value: tx[1],
            data: tx[2],
            executed: tx[3],
            confirmationCount: Number(tx[4]),
            proposedAt: Number(tx[5]),
            isReady: ready,
          });
        } catch {
          // Skip
        }
      }

      setTransactions(txList);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch governance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { signers, threshold, transactions, loading, error, refetch: fetch };
}

export function useOracleStatus() {
  const [oracles, setOracles] = useState<string[]>([]);
  const [rounds, setRounds] = useState<OracleRound[]>([]);
  const [oracleCount, setOracleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.FlourishingMetricsOracle, FlourishingMetricsOracleABI);

      const [oracleList, count, nextRound] = await Promise.all([
        safeCallWithRetry(() => contract.getOracles(), []),
        safeCallWithRetry(() => contract.oracleCount(), BigInt(0)),
        safeCallWithRetry(() => contract.nextRoundId(), BigInt(0)),
      ]);

      setOracles(oracleList);
      setOracleCount(Number(count));

      const roundCount = Number(nextRound);
      const roundList: OracleRound[] = [];
      const batchSize = Math.min(roundCount, 10);

      for (let i = roundCount - 1; i >= Math.max(0, roundCount - batchSize); i--) {
        try {
          const r = await contract.getRound(i);
          roundList.push({
            roundId: Number(r.roundId ?? r[0]),
            metricId: r.metricId ?? r[1],
            startTime: Number(r.startTime ?? r[2]),
            deadline: Number(r.deadline ?? r[3]),
            consensusValue: r.consensusValue ?? r[4],
            finalized: r.finalized ?? r[5],
            submissionCount: Number(r.submissionCount ?? r[6]),
          });
        } catch {
          // Skip
        }
      }

      setRounds(roundList);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch oracle status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { oracles, oracleCount, rounds, loading, error, refetch: fetch };
}

export function useTimelockInfo() {
  const [timelockInfo, setTimelockInfo] = useState<TimelockInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const contract = getContract(CONTRACTS.ProductionBeliefAttestationVerifier, ProductionBeliefAttestationVerifierABI);
      const result = await safeCallWithRetry(() => contract.getPendingImageIdChange(), null);
      if (result) {
        setTimelockInfo({
          pendingImageId: result[0] ?? result.pendingId,
          effectiveAt: Number(result[1] ?? result.effectiveAt),
          isReady: result[2] ?? result.isReady,
        });
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { timelockInfo, loading, refetch: fetch };
}

export function useContractHealth() {
  const [contracts, setContracts] = useState<ContractHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const entries = Object.entries(CONTRACTS);

      // Contracts that have owner()
      const ownerContracts: Record<string, string[]> = {
        MissionEnforcement: MissionEnforcementABI,
        AntiSurveillance: AntiSurveillanceABI,
        AIPartnershipBondsV2: AIPartnershipBondsV2ABI,
        AIAccountabilityBondsV2: AIAccountabilityBondsV2ABI,
        FlourishingMetricsOracle: FlourishingMetricsOracleABI,
        ProductionBeliefAttestationVerifier: ProductionBeliefAttestationVerifierABI,
        VaultfireTeleporterBridge: ["function owner() external view returns (address)"],
      };

      // Check all 14 contracts in parallel using raw fetch (avoids ethers.js rate limiting)
      const results = await Promise.all(
        entries.map(async ([name, address]) => {
          // Raw fetch for getCode — most reliable, bypasses ethers.js provider queue
          const code = await rawGetCode(address);
          const hasCode = code !== "0x" && code.length > 2;

          let owner: string | null = null;
          let paused: boolean | null = null;

          if (ownerContracts[name]) {
            const c = getContract(address, ownerContracts[name]);
            owner = await safeCallWithRetry(() => c.owner(), null);
          }

          // Check paused for bond contracts
          if (name === "AIPartnershipBondsV2" || name === "AIAccountabilityBondsV2") {
            const c = getContract(address, ["function paused() view returns (bool)"]);
            paused = await safeCallWithRetry(() => c.paused(), null);
          }

          return { name, address, owner, hasCode, paused };
        })
      );

      setContracts(results);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { contracts, loading, refetch: fetch };
}

// Auto-refresh hook
export function useAutoRefresh(refetchFns: (() => void)[], intervalMs = 30000) {
  const fnsRef = useRef(refetchFns);
  fnsRef.current = refetchFns;

  useEffect(() => {
    const id = setInterval(() => {
      fnsRef.current.forEach(fn => fn());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
