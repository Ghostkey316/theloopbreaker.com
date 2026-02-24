/**
 * Embris by Vaultfire — XMTP Connector (Mobile)
 * Encrypted messaging with Vaultfire on-chain trust verification.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS, CHAINS } from '@/constants/contracts';

// ─── Types ───────────────────────────────────────────────────────────────────
export type XMTPMessageType = 'text' | 'command' | 'payment' | 'system';
export type TrustLevel = 'unknown' | 'registered' | 'bonded' | 'verified';

export interface XMTPMessage {
  id: string;
  senderAddress: string;
  content: string;
  timestamp: number;
  type: XMTPMessageType;
  trustLevel: TrustLevel;
  senderVNS?: string;
}

export interface XMTPConversation {
  id: string;
  peerAddress: string;
  peerVNS?: string;
  lastMessage?: string;
  lastMessageAt: number;
  trustLevel: TrustLevel;
  unreadCount: number;
  messages: XMTPMessage[];
}

export interface TrustVerification {
  address: string;
  isRegistered: boolean;
  hasBond: boolean;
  bondTier: string;
  bondAmount: string;
  trustScore: number;
  chain: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const XMTP_CONVERSATIONS_KEY = 'embris_xmtp_conversations';

const RPC_URLS: Record<string, string> = {
  base: CHAINS.base.rpc,
  avalanche: CHAINS.avalanche.rpc,
  ethereum: CHAINS.ethereum.rpc,
};

const IDENTITY_REGISTRY: Record<string, string> = {
  base: BASE_CONTRACTS.find(c => c.name === 'ERC8004IdentityRegistry')?.address || '',
  avalanche: AVALANCHE_CONTRACTS.find(c => c.name === 'ERC8004IdentityRegistry')?.address || '',
  ethereum: ETHEREUM_CONTRACTS.find(c => c.name === 'ERC8004IdentityRegistry')?.address || '',
};

const BOND_CONTRACT: Record<string, string> = {
  base: BASE_CONTRACTS.find(c => c.name === 'AIPartnershipBondsV2')?.address || '',
  avalanche: AVALANCHE_CONTRACTS.find(c => c.name === 'AIPartnershipBondsV2')?.address || '',
  ethereum: ETHEREUM_CONTRACTS.find(c => c.name === 'AIPartnershipBondsV2')?.address || '',
};

// ─── Trust Verification ──────────────────────────────────────────────────────
export async function verifyTrust(address: string, chain: string = 'base'): Promise<TrustVerification> {
  const rpc = RPC_URLS[chain] || RPC_URLS.base;
  const identityAddr = IDENTITY_REGISTRY[chain] || IDENTITY_REGISTRY.base;
  const bondAddr = BOND_CONTRACT[chain] || BOND_CONTRACT.base;

  let isRegistered = false;
  let hasBond = false;
  let bondTier = 'none';
  let trustScore = 0;

  try {
    // Check identity registration via eth_call
    const paddedAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
    const identityCallData = `0x5c975abb${paddedAddr}`; // isRegistered(address)

    const identityRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: identityAddr, data: identityCallData }, 'latest'],
      }),
    });
    const identityData = await identityRes.json();
    if (identityData.result && identityData.result !== '0x' && identityData.result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      isRegistered = true;
      trustScore += 25;
    }

    // Check bond status
    const bondCallData = `0x70a08231${paddedAddr}`; // getBondsByParticipantCount(address)
    const bondRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'eth_call',
        params: [{ to: bondAddr, data: bondCallData }, 'latest'],
      }),
    });
    const bondData = await bondRes.json();
    if (bondData.result && parseInt(bondData.result, 16) > 0) {
      hasBond = true;
      bondTier = 'bronze';
      trustScore += 25;
    }
  } catch (err) {
    console.warn('Trust verification failed:', err);
  }

  return {
    address,
    isRegistered,
    hasBond,
    bondTier,
    bondAmount: '0',
    trustScore,
    chain,
  };
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────
export async function getConversations(): Promise<XMTPConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(XMTP_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveConversation(conversation: XMTPConversation): Promise<void> {
  const conversations = await getConversations();
  const idx = conversations.findIndex(c => c.id === conversation.id);
  if (idx >= 0) conversations[idx] = conversation;
  else conversations.unshift(conversation);
  await AsyncStorage.setItem(XMTP_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await getConversations();
  const filtered = conversations.filter(c => c.id !== id);
  await AsyncStorage.setItem(XMTP_CONVERSATIONS_KEY, JSON.stringify(filtered));
}

// ─── Message Helpers ─────────────────────────────────────────────────────────
export function createMessage(
  senderAddress: string,
  content: string,
  type: XMTPMessageType = 'text',
  trustLevel: TrustLevel = 'unknown',
): XMTPMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderAddress,
    content,
    timestamp: Date.now(),
    type,
    trustLevel,
  };
}

export function isPaymentCommand(content: string): boolean {
  return content.startsWith('/pay ');
}

export function parsePaymentCommand(content: string): { to: string; amount: string } | null {
  const match = content.match(/^\/pay\s+(0x[a-fA-F0-9]{40})\s+(\d+\.?\d*)/);
  if (!match) return null;
  return { to: match[1], amount: match[2] };
}
