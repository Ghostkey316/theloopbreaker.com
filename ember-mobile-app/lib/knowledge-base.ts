/**
 * Embris Knowledge Base (Mobile)
 * Provides formatted contract data for Embris prompt injection.
 * Mirrors the web app knowledge-base.ts.
 */

import {
  BASE_CONTRACTS,
  AVALANCHE_CONTRACTS,
  ETHEREUM_CONTRACTS,
  ALL_CONTRACTS,
  CHAINS,
} from "@/constants/contracts";

const CONTRACT_KEYWORDS: Record<string, string[]> = {
  mission: ["mission", "enforcement", "alignment"],
  surveillance: ["surveillance", "anti-surveillance", "monitoring", "privacy"],
  identity: ["identity", "registry", "erc-8004", "erc8004", "registration"],
  reputation: ["reputation", "trust", "score"],
  validation: ["validation", "verify", "validator"],
  governance: ["governance", "multisig", "proposal", "vote"],
  bridge: ["bridge", "teleporter", "cross-chain", "transfer"],
  bonds: ["bond", "partnership", "accountability"],
  flourishing: ["flourishing", "metrics", "oracle", "human"],
  adapter: ["adapter", "erc8004adapter"],
  privacy: ["privacy", "guarantee", "private"],
  attestation: ["attestation", "belief", "attest"],
};

export function formatContractDataForPrompt(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  // Check if the message is about contracts at all
  const isContractQuery =
    /(?:contract|address|deployed|chain|base|avalanche|erc-?8004|verify|bridge|governance)/i.test(
      userMessage
    );

  if (!isContractQuery) return "";

  let block = `\n\n═══ VAULTFIRE CONTRACT KNOWLEDGE BASE ═══\n`;
  block += `Total Contracts: ${ALL_CONTRACTS.length}\n`;
  block += `Chains: Base (${CHAINS.base.chainId}), Avalanche (${CHAINS.avalanche.chainId})\n\n`;

  // Find relevant contracts
  const relevantCategories = Object.entries(CONTRACT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([cat]) => cat);

  if (relevantCategories.length > 0) {
    block += "RELEVANT CONTRACTS:\n";
    const relevant = ALL_CONTRACTS.filter((c) => {
      const name = c.name.toLowerCase();
      return relevantCategories.some((cat) =>
        CONTRACT_KEYWORDS[cat].some((kw) => name.includes(kw))
      );
    });

    relevant.forEach((c) => {
      const chain = CHAINS[c.chain as keyof typeof CHAINS];
      const explorerUrl = chain?.explorerUrl ?? 'https://etherscan.io';
      block += `- ${c.name} (${c.chain}): ${c.address}\n  Explorer: ${explorerUrl}/address/${c.address}\n`;
    });
  } else {
    // General query — show all
    block += "BASE CONTRACTS:\n";
    BASE_CONTRACTS.forEach((c) => {
      block += `- ${c.name}: ${c.address}\n`;
    });
    block += "\nAVALANCHE CONTRACTS:\n";
    AVALANCHE_CONTRACTS.forEach((c) => {
      block += `- ${c.name}: ${c.address}\n`;
    });
    block += "\nETHEREUM CONTRACTS:\n";
    ETHEREUM_CONTRACTS.forEach((c) => {
      block += `- ${c.name}: ${c.address}\n`;
    });
  }

  return block;
}
