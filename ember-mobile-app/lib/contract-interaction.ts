/**
 * Embris Contract Interaction System (Mobile)
 * Handles on-chain reads triggered by user queries to Embris.
 * Uses the existing contract-reader.ts and blockchain.ts modules.
 */

import { CHAINS, BASE_CONTRACTS, AVALANCHE_CONTRACTS, ALL_CONTRACTS } from "@/constants/contracts";
import { checkContractAlive, getRegistryData, getGovernanceData, getTeleporterBridgeStats } from "./contract-reader";
import { checkAllChains } from "./blockchain";

export type ContractQueryType =
  | "check_registration"
  | "agent_count"
  | "contract_status"
  | "chain_status"
  | "bridge_status"
  | "governance_status"
  | "general_contract";

export interface ContractQueryResult {
  type: ContractQueryType;
  success: boolean;
  data: string;
  raw?: unknown;
}

export function detectContractQuery(message: string): ContractQueryType | null {
  const lower = message.toLowerCase();

  if (/(?:am i registered|my registration|registration status)/i.test(lower)) {
    return "check_registration";
  }
  if (/(?:how many agents|agent count|registered agents|how many.*registered)/i.test(lower)) {
    return "agent_count";
  }
  if (/(?:contract.*(?:alive|status|active|deployed)|is.*contract.*(?:live|working))/i.test(lower)) {
    return "contract_status";
  }
  if (/(?:chain.*(?:status|alive|connected)|network.*status|rpc.*status)/i.test(lower)) {
    return "chain_status";
  }
  if (/(?:bridge.*(?:status|active|messages)|teleporter)/i.test(lower)) {
    return "bridge_status";
  }
  if (/(?:governance.*(?:status|proposals|threshold)|multisig)/i.test(lower)) {
    return "governance_status";
  }
  if (/(?:verify.*contract|check.*contract|contract.*(?:info|data|read))/i.test(lower)) {
    return "general_contract";
  }

  return null;
}

export async function executeContractQuery(
  queryType: ContractQueryType,
  walletAddress?: string | null
): Promise<ContractQueryResult> {
  try {
    switch (queryType) {
      case "chain_status": {
        const results = await checkAllChains();
        let data = "🔗 **Chain Status Report**\n\n";
        for (const [chain, result] of Object.entries(results)) {
          const status = result.success ? "✅ Connected" : "❌ Offline";
          data += `**${chain.charAt(0).toUpperCase() + chain.slice(1)}**: ${status}`;
          if (result.success) {
            data += ` | Block #${result.blockNumber?.toLocaleString()} | ${result.latency}ms latency`;
          }
          data += "\n";
        }
        return { type: queryType, success: true, data, raw: results };
      }

      case "contract_status": {
        let data = "📋 **Contract Status**\n\n";
        const baseChecks = await Promise.all(
          BASE_CONTRACTS.slice(0, 5).map(async (c) => ({
            name: c.name,
            alive: await checkContractAlive("base", c.address),
          }))
        );
        const avaxChecks = await Promise.all(
          AVALANCHE_CONTRACTS.slice(0, 5).map(async (c) => ({
            name: c.name,
            alive: await checkContractAlive("avalanche", c.address),
          }))
        );

        data += "**Base Contracts:**\n";
        baseChecks.forEach((c) => {
          data += `${c.alive ? "✅" : "❌"} ${c.name}\n`;
        });
        data += `\n**Avalanche Contracts:**\n`;
        avaxChecks.forEach((c) => {
          data += `${c.alive ? "✅" : "❌"} ${c.name}\n`;
        });
        data += `\n_Showing top 5 per chain. Total: ${ALL_CONTRACTS.length} contracts._`;

        return { type: queryType, success: true, data };
      }

      case "agent_count": {
        const baseIdentity = BASE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry");
        const avaxIdentity = AVALANCHE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry");

        let data = "👥 **Registered Agents**\n\n";

        if (baseIdentity) {
          const reg = await getRegistryData("base", baseIdentity.address);
          data += `**Base**: ${reg.entryCount !== null ? reg.entryCount : "Unable to read"} entries\n`;
        }
        if (avaxIdentity) {
          const reg = await getRegistryData("avalanche", avaxIdentity.address);
          data += `**Avalanche**: ${reg.entryCount !== null ? reg.entryCount : "Unable to read"} entries\n`;
        }

        return { type: queryType, success: true, data };
      }

      case "check_registration": {
        if (!walletAddress) {
          return {
            type: queryType,
            success: false,
            data: "No wallet connected. Please connect your wallet first to check registration status.",
          };
        }

        let data = `🔍 **Registration Check for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}**\n\n`;
        data += "Checking on-chain identity registries...\n\n";

        const baseIdentity = BASE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry");
        const avaxIdentity = AVALANCHE_CONTRACTS.find((c) => c.name === "ERC8004IdentityRegistry");

        if (baseIdentity) {
          const alive = await checkContractAlive("base", baseIdentity.address);
          data += `**Base Identity Registry**: ${alive ? "✅ Active" : "❌ Unreachable"}\n`;
        }
        if (avaxIdentity) {
          const alive = await checkContractAlive("avalanche", avaxIdentity.address);
          data += `**Avalanche Identity Registry**: ${alive ? "✅ Active" : "❌ Unreachable"}\n`;
        }

        return { type: queryType, success: true, data };
      }

      case "bridge_status": {
        const baseBridge = BASE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");
        const avaxBridge = AVALANCHE_CONTRACTS.find((c) => c.name === "VaultfireTeleporterBridge");

        let data = "🌉 **Bridge Status**\n\n";

        if (baseBridge) {
          const stats = await getTeleporterBridgeStats("base", baseBridge.address);
          data += `**Base Bridge**: ${stats.isAlive ? "✅ Active" : "❌ Inactive"}`;
          if (stats.messageCount !== null) data += ` | Messages: ${stats.messageCount}`;
          if (stats.paused !== null) data += ` | ${stats.paused ? "⏸ Paused" : "▶ Running"}`;
          data += "\n";
        }
        if (avaxBridge) {
          const stats = await getTeleporterBridgeStats("avalanche", avaxBridge.address);
          data += `**Avalanche Bridge**: ${stats.isAlive ? "✅ Active" : "❌ Inactive"}`;
          if (stats.messageCount !== null) data += ` | Messages: ${stats.messageCount}`;
          if (stats.paused !== null) data += ` | ${stats.paused ? "⏸ Paused" : "▶ Running"}`;
          data += "\n";
        }

        return { type: queryType, success: true, data };
      }

      case "governance_status": {
        const baseGov = BASE_CONTRACTS.find((c) => c.name === "MultisigGovernance");
        const avaxGov = AVALANCHE_CONTRACTS.find((c) => c.name === "MultisigGovernance");

        let data = "🏛 **Governance Status**\n\n";

        if (baseGov) {
          const gov = await getGovernanceData("base", baseGov.address);
          data += `**Base Governance**: ${gov.isAlive ? "✅ Active" : "❌ Inactive"}`;
          if (gov.proposalCount !== null) data += ` | Proposals: ${gov.proposalCount}`;
          if (gov.threshold !== null) data += ` | Threshold: ${gov.threshold}`;
          data += "\n";
        }
        if (avaxGov) {
          const gov = await getGovernanceData("avalanche", avaxGov.address);
          data += `**Avalanche Governance**: ${gov.isAlive ? "✅ Active" : "❌ Inactive"}`;
          if (gov.proposalCount !== null) data += ` | Proposals: ${gov.proposalCount}`;
          if (gov.threshold !== null) data += ` | Threshold: ${gov.threshold}`;
          data += "\n";
        }

        return { type: queryType, success: true, data };
      }

      default:
        return {
          type: queryType,
          success: false,
          data: "Query type not supported yet.",
        };
    }
  } catch (error) {
    return {
      type: queryType,
      success: false,
      data: `Error executing query: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
