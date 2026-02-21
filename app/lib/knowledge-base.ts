/**
 * Embris Knowledge Base — Real Contract Data Access
 *
 * Provides Embris with structured access to all Vaultfire contract data
 * from contracts.ts. When users ask about contracts, chains, or deployments,
 * Embris can answer with real, accurate data including addresses and explorer links.
 *
 * This module formats contract data for system prompt injection in a
 * token-efficient way, and provides query functions for dynamic lookups.
 */

import {
  ALL_CONTRACTS,
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  CHAINS,
  type ContractInfo,
  type ChainConfig,
} from './contracts';

/* ── Types ── */

export interface ContractDetail {
  name: string;
  address: string;
  chain: string;
  chainId: number;
  explorerUrl: string;
  explorerLink: string;
  purpose: string;
}

/* ── Contract Purpose Descriptions ── */

const CONTRACT_PURPOSES: Record<string, string> = {
  MissionEnforcement: 'Ensures AI agents follow their stated mission and ethical guidelines. Core governance contract.',
  AntiSurveillance: 'Prevents unauthorized monitoring of AI interactions. Protects user privacy from surveillance.',
  PrivacyGuarantees: 'Cryptographic privacy protections for users. Ensures data sovereignty and confidentiality.',
  ERC8004IdentityRegistry: 'Unique on-chain identities for AI agents. Part of the ERC-8004 standard implementation.',
  BeliefAttestationVerifier: 'Verifies AI belief systems and value alignment. Ensures AI agents hold consistent ethical values.',
  AIPartnershipBondsV2: 'Bonds between humans and AI agents. Formalizes trust relationships on-chain.',
  FlourishingMetricsOracle: 'Measures positive human outcomes from AI interactions. Oracle for human flourishing data.',
  AIAccountabilityBondsV2: 'Financial accountability for AI behavior. Bonds that ensure AI systems remain accountable.',
  ERC8004ReputationRegistry: 'Trust scores and behavioral history for AI agents. On-chain reputation tracking.',
  ERC8004ValidationRegistry: 'Verification of AI agent compliance with ethical standards. Validation layer for ERC-8004.',
  VaultfireERC8004Adapter: 'Adapter connecting Vaultfire protocol to the ERC-8004 standard. Integration bridge.',
  MultisigGovernance: 'Multi-signature governance for protocol changes. Ensures decentralized decision-making.',
  ProductionBeliefAttestationVerifier: 'Production-grade belief attestation. Deployed version of the belief verification system.',
  VaultfireTeleporterBridge: 'Cross-chain bridge between Base and Avalanche. Enables asset and data teleportation.',
};

/* ── Query Functions ── */

export function getContractDetail(contract: ContractInfo): ContractDetail {
  const chain = CHAINS[contract.chain];
  return {
    name: contract.name,
    address: contract.address,
    chain: chain.name,
    chainId: contract.chainId,
    explorerUrl: chain.explorerUrl,
    explorerLink: `${chain.explorerUrl}/address/${contract.address}`,
    purpose: CONTRACT_PURPOSES[contract.name] || 'Vaultfire Protocol contract.',
  };
}

export function getAllContractDetails(): ContractDetail[] {
  return ALL_CONTRACTS.map(getContractDetail);
}

export function getContractsByChain(chain: 'base' | 'avalanche'): ContractDetail[] {
  const contracts = chain === 'base' ? BASE_CONTRACTS : AVALANCHE_CONTRACTS;
  return contracts.map(getContractDetail);
}

export function searchContracts(query: string): ContractDetail[] {
  const lower = query.toLowerCase();
  return ALL_CONTRACTS
    .filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.address.toLowerCase().includes(lower) ||
      c.chain.toLowerCase().includes(lower)
    )
    .map(getContractDetail);
}

export function getChainInfo(chain: 'base' | 'avalanche'): ChainConfig {
  return CHAINS[chain];
}

export function getContractStats(): {
  total: number;
  baseCount: number;
  avalancheCount: number;
  uniqueNames: string[];
  chains: string[];
} {
  const uniqueNames = [...new Set(ALL_CONTRACTS.map(c => c.name))];
  return {
    total: ALL_CONTRACTS.length,
    baseCount: BASE_CONTRACTS.length,
    avalancheCount: AVALANCHE_CONTRACTS.length,
    uniqueNames,
    chains: ['Base (8453)', 'Avalanche (43114)'],
  };
}

/* ── Detect Contract Queries ── */

export function isContractQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(contract|contracts|deployed|deployment|address|addresses|base chain|avalanche|chain|what's on|what contracts|show me|list|erc.?8004|bridge|governance|mission|surveillance|privacy|accountability|partnership|flourishing|reputation|validation|adapter|teleporter|explorer)\b/i.test(lower);
}

/* ── Format Contract Data for Dynamic Injection ── */

export function formatContractDataForPrompt(userMessage: string): string {
  // Only inject detailed contract data when the user is asking about contracts
  if (!isContractQuery(userMessage)) return '';

  const lower = userMessage.toLowerCase();

  // Determine which chain(s) to show
  const wantsBase = /\b(base|8453)\b/i.test(lower);
  const wantsAvalanche = /\b(avalanche|avax|43114|snowtrace)\b/i.test(lower);
  const wantsSpecific = /\b(mission|surveillance|privacy|identity|belief|partnership|flourishing|accountability|reputation|validation|adapter|governance|bridge|teleporter)\b/i.test(lower);

  const sections: string[] = [];

  sections.push(`═══ VAULTFIRE CONTRACT KNOWLEDGE BASE ═══
Total deployed: ${ALL_CONTRACTS.length} contracts across 2 chains
Base: ${BASE_CONTRACTS.length} contracts | Avalanche: ${AVALANCHE_CONTRACTS.length} contracts`);

  if (wantsSpecific) {
    // Show specific contract(s) with full details
    const results = searchContracts(lower.match(/\b(mission\s*enforcement|anti\s*surveillance|privacy\s*guarantees|identity\s*registry|belief\s*attestation|partnership\s*bonds|flourishing\s*metrics|accountability\s*bonds|reputation\s*registry|validation\s*registry|erc.?8004\s*adapter|multisig\s*governance|teleporter\s*bridge)\b/i)?.[0] || '');
    if (results.length > 0) {
      for (const c of results) {
        sections.push(`${c.name} (${c.chain}, Chain ID ${c.chainId}):
  Address: ${c.address}
  Explorer: ${c.explorerLink}
  Purpose: ${c.purpose}`);
      }
    }
  }

  if (wantsBase && !wantsAvalanche) {
    sections.push('\nBASE CONTRACTS (Chain ID 8453):');
    for (const c of BASE_CONTRACTS) {
      const detail = getContractDetail(c);
      sections.push(`  ${detail.name}: ${detail.address}
    Explorer: ${detail.explorerLink}
    Purpose: ${detail.purpose}`);
    }
  } else if (wantsAvalanche && !wantsBase) {
    sections.push('\nAVALANCHE CONTRACTS (Chain ID 43114):');
    for (const c of AVALANCHE_CONTRACTS) {
      const detail = getContractDetail(c);
      sections.push(`  ${detail.name}: ${detail.address}
    Explorer: ${detail.explorerLink}
    Purpose: ${detail.purpose}`);
    }
  } else if (!wantsSpecific) {
    // Show summary of both chains
    sections.push('\nBASE CONTRACTS (Chain ID 8453):');
    for (const c of BASE_CONTRACTS) {
      sections.push(`  ${c.name}: ${c.address}`);
    }
    sections.push('\nAVALANCHE CONTRACTS (Chain ID 43114):');
    for (const c of AVALANCHE_CONTRACTS) {
      sections.push(`  ${c.name}: ${c.address}`);
    }
    sections.push(`\nExplorers: Base → ${CHAINS.base.explorerUrl} | Avalanche → ${CHAINS.avalanche.explorerUrl}`);
    sections.push('For any contract, the explorer link is: {explorerUrl}/address/{contractAddress}');
  }

  sections.push('\nWhen sharing contract info, always include the explorer link so users can verify on-chain. Format addresses in code blocks.');

  return '\n\n' + sections.join('\n');
}
