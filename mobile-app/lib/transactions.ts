/**
 * Vaultfire Transaction Service
 *
 * Builds unsigned transactions for Vaultfire Protocol contracts.
 * The user's external wallet signs and broadcasts them.
 * NEVER touches ERC-20 tokens or ASM. Only Vaultfire Protocol contracts.
 */

import { ethers } from "ethers";
import { getBaseProvider } from "./provider";
import {
  CONTRACTS,
  BASE_CHAIN_ID,
  BASESCAN_URL,
  ERC8004IdentityRegistryABI,
  AIPartnershipBondsV2ABI,
  ERC8004ReputationRegistryABI,
} from "./contracts_config";

// ============ Types ============

export type TxStatus = "idle" | "preview" | "signing" | "pending" | "confirmed" | "failed";

export interface TransactionRequest {
  to: string;
  data: string;
  value: string; // hex string
  chainId: number;
  gasLimit?: string;
}

export interface TransactionPreview {
  contractName: string;
  functionName: string;
  params: { name: string; value: string }[];
  value: string; // ETH amount
  estimatedGas: string;
  contractAddress: string;
}

export interface TransactionResult {
  status: TxStatus;
  txHash?: string;
  error?: string;
  basescanUrl?: string;
  blockNumber?: number;
}

// ============ Transaction Builders ============

/**
 * Build a registerAgent transaction for ERC8004IdentityRegistry
 */
export async function buildRegisterAgentTx(
  agentURI: string,
  agentType: string,
  capabilities: string
): Promise<{ tx: TransactionRequest; preview: TransactionPreview }> {
  const provider = getBaseProvider();
  const iface = new ethers.Interface(ERC8004IdentityRegistryABI);
  const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes(capabilities));

  const data = iface.encodeFunctionData("registerAgent", [
    agentURI,
    agentType,
    capabilitiesHash,
  ]);

  const tx: TransactionRequest = {
    to: CONTRACTS.ERC8004IdentityRegistry,
    data,
    value: "0x0",
    chainId: BASE_CHAIN_ID,
  };

  // Estimate gas
  let estimatedGas = "200000";
  try {
    const gasEstimate = await provider.estimateGas({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    estimatedGas = gasEstimate.toString();
  } catch {
    // Use default estimate
  }

  const preview: TransactionPreview = {
    contractName: "ERC8004 Identity Registry",
    functionName: "registerAgent",
    params: [
      { name: "Agent URI", value: agentURI },
      { name: "Agent Type", value: agentType },
      { name: "Capabilities Hash", value: capabilitiesHash },
      { name: "Capabilities", value: capabilities },
    ],
    value: "0 ETH",
    estimatedGas,
    contractAddress: CONTRACTS.ERC8004IdentityRegistry,
  };

  return { tx, preview };
}

/**
 * Build a createBond transaction for AIPartnershipBondsV2
 */
export async function buildCreateBondTx(
  aiAgentAddress: string,
  partnershipType: string,
  stakeAmountEth: string
): Promise<{ tx: TransactionRequest; preview: TransactionPreview }> {
  const provider = getBaseProvider();
  const iface = new ethers.Interface(AIPartnershipBondsV2ABI);

  const data = iface.encodeFunctionData("createBond", [
    aiAgentAddress,
    partnershipType,
  ]);

  const valueWei = ethers.parseEther(stakeAmountEth);

  const tx: TransactionRequest = {
    to: CONTRACTS.AIPartnershipBondsV2,
    data,
    value: ethers.toQuantity(valueWei),
    chainId: BASE_CHAIN_ID,
  };

  let estimatedGas = "300000";
  try {
    const gasEstimate = await provider.estimateGas({
      to: tx.to,
      data: tx.data,
      value: valueWei,
    });
    estimatedGas = gasEstimate.toString();
  } catch {
    // Use default estimate
  }

  const preview: TransactionPreview = {
    contractName: "AI Partnership Bonds V2",
    functionName: "createBond",
    params: [
      { name: "AI Agent", value: aiAgentAddress },
      { name: "Partnership Type", value: partnershipType },
      { name: "Stake Amount", value: `${stakeAmountEth} ETH` },
    ],
    value: `${stakeAmountEth} ETH`,
    estimatedGas,
    contractAddress: CONTRACTS.AIPartnershipBondsV2,
  };

  return { tx, preview };
}

/**
 * Build a submitFeedback transaction for ERC8004ReputationRegistry
 */
export async function buildSubmitFeedbackTx(
  agentAddress: string,
  rating: number,
  comment: string
): Promise<{ tx: TransactionRequest; preview: TransactionPreview }> {
  const provider = getBaseProvider();
  const iface = new ethers.Interface(ERC8004ReputationRegistryABI);

  // Rating is 1-5 in UI, but contract expects 0-100 scale
  const contractRating = rating * 20;

  const data = iface.encodeFunctionData("submitFeedback", [
    agentAddress,
    contractRating,
    comment,
  ]);

  const tx: TransactionRequest = {
    to: CONTRACTS.ERC8004ReputationRegistry,
    data,
    value: "0x0",
    chainId: BASE_CHAIN_ID,
  };

  let estimatedGas = "200000";
  try {
    const gasEstimate = await provider.estimateGas({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    estimatedGas = gasEstimate.toString();
  } catch {
    // Use default estimate
  }

  const preview: TransactionPreview = {
    contractName: "ERC8004 Reputation Registry",
    functionName: "submitFeedback",
    params: [
      { name: "Agent Address", value: agentAddress },
      { name: "Rating", value: `${rating}/5 (${contractRating}/100 on-chain)` },
      { name: "Comment", value: comment },
    ],
    value: "0 ETH",
    estimatedGas,
    contractAddress: CONTRACTS.ERC8004ReputationRegistry,
  };

  return { tx, preview };
}

// ============ Helpers ============

export function basescanTxUrl(txHash: string): string {
  return `${BASESCAN_URL}/tx/${txHash}`;
}

export function basescanAddressUrl(address: string): string {
  return `${BASESCAN_URL}/address/${address}`;
}

/**
 * Format gas estimate to a human-readable string
 */
export function formatGas(gas: string): string {
  const gasNum = parseInt(gas, 10);
  if (gasNum > 1_000_000) {
    return `${(gasNum / 1_000_000).toFixed(2)}M`;
  }
  if (gasNum > 1_000) {
    return `${(gasNum / 1_000).toFixed(1)}K`;
  }
  return gas;
}
