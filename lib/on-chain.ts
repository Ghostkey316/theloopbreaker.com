import { ethers } from "ethers";
import { getContract } from "./provider";
import {
  CONTRACTS,
  ERC8004IdentityRegistryABI,
  ERC8004ReputationRegistryABI,
  AIPartnershipBondsV2ABI,
  AIAccountabilityBondsV2ABI,
  ERC8004ValidationRegistryABI,
  VaultfireERC8004AdapterABI,
  VaultfireTeleporterBridgeABI,
} from "./contracts_config";

export interface IdentityData {
  address: string;
  agentType: string;
  registeredAt: number;
  active: boolean;
  agentURI: string;
}

export interface ReputationData {
  averageRating: number;
  totalFeedbacks: number;
  verifiedFeedbacks: number;
  lastUpdated: number;
}

export interface BondData {
  partnershipBonds: number;
  accountabilityBonds: number;
  totalStaked: string;
}

export interface ValidationData {
  requestCount: number;
  responseCount: number;
}

export interface BridgeData {
  recognized: boolean;
  syncedOnAvalanche: boolean;
}

export interface TrustProfile {
  address: string;
  identity: IdentityData | null;
  reputation: ReputationData | null;
  bonds: BondData;
  validation: ValidationData;
  bridge: BridgeData;
  fullyRegistered: boolean;
}

export async function fetchTrustProfile(address: string): Promise<TrustProfile> {
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid Ethereum address");
  }

  const checksummed = ethers.getAddress(address);

  try {
    const [identity, reputation, bonds, validation, adapter, bridge] = await Promise.all([
      fetchIdentity(checksummed),
      fetchReputation(checksummed),
      fetchBonds(checksummed),
      fetchValidation(checksummed),
      fetchAdapterStatus(checksummed),
      fetchBridgeStatus(checksummed),
    ]);

    return {
      address: checksummed,
      identity,
      reputation,
      bonds,
      validation,
      bridge,
      fullyRegistered: adapter.fullyRegistered,
    };
  } catch (error) {
    console.error("Error fetching trust profile:", error);
    throw error;
  }
}

async function fetchIdentity(address: string): Promise<IdentityData | null> {
  try {
    const contract = getContract(
      CONTRACTS.ERC8004IdentityRegistry,
      ERC8004IdentityRegistryABI
    );
    const agent = await contract.getAgent(address);
    if (!agent || !agent.agentAddress) return null;

    return {
      address: agent.agentAddress,
      agentType: agent.agentType || "Unknown",
      registeredAt: Number(agent.registeredAt),
      active: agent.active,
      agentURI: agent.agentURI || "",
    };
  } catch (error) {
    console.error("Error fetching identity:", error);
    return null;
  }
}

async function fetchReputation(address: string): Promise<ReputationData | null> {
  try {
    const contract = getContract(
      CONTRACTS.ERC8004ReputationRegistry,
      ERC8004ReputationRegistryABI
    );
    const rep = await contract.getReputation(address);
    if (!rep) return null;

    return {
      averageRating: Number(rep.averageRating),
      totalFeedbacks: Number(rep.totalFeedbacks),
      verifiedFeedbacks: Number(rep.verifiedFeedbacks),
      lastUpdated: Number(rep.lastUpdated),
    };
  } catch (error) {
    console.error("Error fetching reputation:", error);
    return null;
  }
}

async function fetchBonds(address: string): Promise<BondData> {
  try {
    const partnershipContract = getContract(
      CONTRACTS.AIPartnershipBondsV2,
      AIPartnershipBondsV2ABI
    );
    const accountabilityContract = getContract(
      CONTRACTS.AIAccountabilityBondsV2,
      AIAccountabilityBondsV2ABI
    );

    const [nextPartnershipId, nextAccountabilityId] = await Promise.all([
      partnershipContract.nextBondId(),
      accountabilityContract.nextBondId(),
    ]);

    let partnershipCount = 0;
    let accountabilityCount = 0;
    let totalStaked = ethers.toBigInt(0);

    for (let i = 0; i < Number(nextPartnershipId); i++) {
      try {
        const bond = await partnershipContract.bonds(i);
        if (bond.human === address || bond.aiAgent === address) {
          partnershipCount++;
          totalStaked += ethers.toBigInt(bond.stakeAmount || 0);
        }
      } catch {
        // Bond might not exist
      }
    }

    for (let i = 0; i < Number(nextAccountabilityId); i++) {
      try {
        const bond = await accountabilityContract.bonds(i);
        if (bond.aiCompany === address) {
          accountabilityCount++;
          totalStaked += ethers.toBigInt(bond.stakeAmount || 0);
        }
      } catch {
        // Bond might not exist
      }
    }

    return {
      partnershipBonds: partnershipCount,
      accountabilityBonds: accountabilityCount,
      totalStaked: ethers.formatEther(totalStaked),
    };
  } catch (error) {
    console.error("Error fetching bonds:", error);
    return {
      partnershipBonds: 0,
      accountabilityBonds: 0,
      totalStaked: "0",
    };
  }
}

async function fetchValidation(address: string): Promise<ValidationData> {
  try {
    const contract = getContract(
      CONTRACTS.ERC8004ValidationRegistry,
      ERC8004ValidationRegistryABI
    );
    const requestCount = await contract.getAgentValidationRequestsCount(address);

    return {
      requestCount: Number(requestCount),
      responseCount: 0, // Not directly queryable, would need event logs
    };
  } catch (error) {
    console.error("Error fetching validation:", error);
    return {
      requestCount: 0,
      responseCount: 0,
    };
  }
}

async function fetchAdapterStatus(
  address: string
): Promise<{ fullyRegistered: boolean }> {
  try {
    const contract = getContract(
      CONTRACTS.VaultfireERC8004Adapter,
      VaultfireERC8004AdapterABI
    );
    const registered = await contract.isAgentFullyRegistered(address);

    return { fullyRegistered: registered };
  } catch (error) {
    console.error("Error fetching adapter status:", error);
    return { fullyRegistered: false };
  }
}

async function fetchBridgeStatus(address: string): Promise<BridgeData> {
  try {
    const contract = getContract(
      CONTRACTS.VaultfireTeleporterBridge,
      VaultfireTeleporterBridgeABI
    );
    const recognized = await contract.isAgentRecognized(address);

    return {
      recognized,
      syncedOnAvalanche: recognized,
    };
  } catch (error) {
    console.error("Error fetching bridge status:", error);
    return {
      recognized: false,
      syncedOnAvalanche: false,
    };
  }
}

export interface SecurityAssessment {
  score: number; // 0-100
  level: "critical" | "warning" | "safe";
  threats: string[];
  approvalCount: number;
}

export async function assessWalletSecurity(address: string): Promise<SecurityAssessment> {
  // This is a simplified security assessment
  // In production, you'd integrate with revoke.cash API or similar
  // For now, we'll return a basic assessment based on on-chain data

  try {
    const profile = await fetchTrustProfile(address);

    let score = 100;
    const threats: string[] = [];

    // Deduct points for lack of identity registration
    if (!profile.identity || !profile.identity.active) {
      score -= 20;
      threats.push("Not registered as Vaultfire agent");
    }

    // Deduct points for no reputation
    if (!profile.reputation || profile.reputation.totalFeedbacks === 0) {
      score -= 15;
      threats.push("No reputation history");
    }

    // Deduct points for low reputation score
    if (profile.reputation && profile.reputation.averageRating < 50) {
      score -= 25;
      threats.push("Low reputation score");
    }

    // Deduct points for no bonds
    if (profile.bonds.partnershipBonds === 0 && profile.bonds.accountabilityBonds === 0) {
      score -= 10;
      threats.push("No active bonds");
    }

    // Deduct points for not recognized on bridge
    if (!profile.bridge.recognized) {
      score -= 5;
    }

    score = Math.max(0, Math.min(100, score));

    let level: "critical" | "warning" | "safe";
    if (score < 40) {
      level = "critical";
    } else if (score < 70) {
      level = "warning";
    } else {
      level = "safe";
    }

    return {
      score,
      level,
      threats,
      approvalCount: 0, // Would be fetched from revoke.cash API
    };
  } catch (error) {
    console.error("Error assessing wallet security:", error);
    return {
      score: 0,
      level: "critical",
      threats: ["Unable to assess wallet security"],
      approvalCount: 0,
    };
  }
}
