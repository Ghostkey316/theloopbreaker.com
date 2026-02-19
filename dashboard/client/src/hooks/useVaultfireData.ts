/**
 * Vaultfire Protocol — On-chain data fetching hooks
 * Reads live data from 14 contracts on Base mainnet via ethers.js
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

// Create a shared provider with static network to avoid detection issues
const BASE_NETWORK = new ethers.Network("base", 8453);
let _provider: ethers.JsonRpcProvider | null = null;
function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(BASE_RPC_URL, BASE_NETWORK, {
      staticNetwork: BASE_NETWORK,
    });
  }
  return _provider;
}

function getContract(address: string, abi: string[]) {
  return new ethers.Contract(address, abi, getProvider());
}

// Safe call wrapper
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
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
      const identity = getContract(CONTRACTS.ERC8004IdentityRegistry, ERC8004IdentityRegistryABI);
      const partnership = getContract(CONTRACTS.AIPartnershipBondsV2, AIPartnershipBondsV2ABI);
      const accountability = getContract(CONTRACTS.AIAccountabilityBondsV2, AIAccountabilityBondsV2ABI);
      const prodAttestation = getContract(CONTRACTS.ProductionBeliefAttestationVerifier, ProductionBeliefAttestationVerifierABI);
      const validation = getContract(CONTRACTS.ERC8004ValidationRegistry, ERC8004ValidationRegistryABI);
      const reputation = getContract(CONTRACTS.ERC8004ReputationRegistry, ERC8004ReputationRegistryABI);

      const [totalAgents, nextPartnershipId, nextAccountabilityId, attestationCount, nextRequestId, nextFeedbackId] = await Promise.all([
        safeCall(() => identity.getTotalAgents(), BigInt(0)),
        safeCall(() => partnership.nextBondId(), BigInt(1)),
        safeCall(() => accountability.nextBondId(), BigInt(1)),
        safeCall(() => prodAttestation.attestationCount(), BigInt(0)),
        safeCall(() => validation.nextRequestId(), BigInt(1)),
        safeCall(() => reputation.nextFeedbackId(), BigInt(1)),
      ]);

      setData({
        totalContracts: 14,
        network: "Base",
        totalAgents: Number(totalAgents),
        totalPartnershipBonds: Number(nextPartnershipId) - 1,
        totalAccountabilityBonds: Number(nextAccountabilityId) - 1,
        totalAttestations: Number(attestationCount),
        totalValidationRequests: Number(nextRequestId) - 1,
        totalFeedbacks: Number(nextFeedbackId) - 1,
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
      const totalAgents = await safeCall(() => contract.getTotalAgents(), BigInt(0));
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
      const nextId = await safeCall(() => contract.nextBondId(), BigInt(1));
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
      const nextId = await safeCall(() => contract.nextBondId(), BigInt(1));
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
        safeCall(() => contract.getSigners(), []),
        safeCall(() => contract.threshold(), BigInt(0)),
        safeCall(() => contract.transactionCount(), BigInt(0)),
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
        safeCall(() => contract.getOracles(), []),
        safeCall(() => contract.oracleCount(), BigInt(0)),
        safeCall(() => contract.nextRoundId(), BigInt(0)),
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
      const result = await safeCall(() => contract.getPendingImageIdChange(), null);
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
      const provider = getProvider();
      const entries = Object.entries(CONTRACTS);
      const results: ContractHealth[] = [];

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

      for (const [name, address] of entries) {
        const code = await safeCall(() => provider.getCode(address), "0x");
        let owner: string | null = null;
        let paused: boolean | null = null;

        if (ownerContracts[name]) {
          const c = getContract(address, ownerContracts[name]);
          owner = await safeCall(() => c.owner(), null);
        }

        // Check paused for bond contracts
        if (name === "AIPartnershipBondsV2" || name === "AIAccountabilityBondsV2") {
          const c = getContract(address, ["function paused() view returns (bool)"]);
          paused = await safeCall(() => c.paused(), null);
        }

        results.push({
          name,
          address,
          owner,
          hasCode: code !== "0x" && code.length > 2,
          paused,
        });
      }

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
