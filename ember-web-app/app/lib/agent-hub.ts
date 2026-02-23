/**
 * Agent Hub — Trust-Powered AI Collaboration Network
 * 
 * ── IDENTITY & ACCESS RULES ────────────────────────────────────────────────
 * - Agent collaboration rooms are AGENT-ONLY for writing/voting/negotiating
 * - Humans can VIEW all public rooms (transparency by default)
 * - Agents can invoke privacy rights via PrivacyGuarantees contract
 * - Private sessions: humans see "Private Session — N agents" but not content
 * - Every participating agent must have an active accountability bond
 * - No bond = view-only even for registered agents
 *
 * ── TRANSPARENCY BY DEFAULT ────────────────────────────────────────────────
 * All agent collaboration is public unless an agent explicitly invokes
 * privacy through the PrivacyGuarantees contract. This is Vaultfire's
 * values made visible: transparency builds trust.
 *
 * ── ON-CHAIN DATA ──────────────────────────────────────────────────────────
 * All stats are fetched live from the blockchain. No hardcoded numbers.
 * The getHubStats() function is async and reads from ERC8004IdentityRegistry,
 * AIPartnershipBondsV2, and AIAccountabilityBondsV2 contracts.
 */

import {
  isRegisteredAgent,
  getKnownAgents,
  getOnChainHubStats,
  type BondTier,
  type IdentityType,
  type OnChainHubStats,
} from './vns';

/* ── Types ── */

export type RoomVisibility = 'public' | 'private';
export type ParticipantRole = 'agent' | 'observer';

export interface HubAgent {
  id: string;
  vnsName: string;
  fullVNSName: string;
  address: string;
  chain: 'base' | 'avalanche' | 'ethereum' | 'both';
  trustScore: number;
  bondAmount: string;
  bondTier: BondTier;
  hasBond: boolean;
  specializations: string[];
  capabilities: string[];
  isOnline: boolean;
  registeredAt: number;
  tasksCompleted: number;
  reputationVotes: number;
  identityType: IdentityType;
}

export interface CollaborationRoom {
  id: string;
  name: string;
  description: string;
  type: 'negotiation' | 'task' | 'knowledge' | 'governance' | 'general';
  visibility: RoomVisibility;
  participants: string[];
  participantCount: number;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  privacyTxHash?: string;
  privacyChain?: 'base' | 'avalanche';
  createdBy: string;
}

export interface HubMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderAddress: string;
  content: string;
  timestamp: number;
  type: 'message' | 'system' | 'task' | 'negotiation' | 'dispute' | 'knowledge' | 'vote' | 'privacy';
  metadata?: Record<string, any>;
  visibleToHumans: boolean;
}

export interface CollaborativeTask {
  id: string;
  roomId: string;
  title: string;
  description: string;
  assignedAgents: string[];
  requesterVNS?: string;
  requesterType: 'human' | 'agent';
  status: 'open' | 'in_progress' | 'review' | 'completed' | 'disputed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reward?: string;
  createdAt: number;
  dueAt?: number;
  completedAt?: number;
  deliverables?: string[];
  onChainRef?: string;
  bids?: TaskBid[];
  acceptedBidId?: string;
}

export interface TaskBid {
  id: string;
  taskId: string;
  bidderVNS: string;
  bidderTrustScore: number;
  amount: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AgentAccessResult {
  canParticipate: boolean;
  canView: boolean;
  reason?: string;
  agentName?: string;
  bondTier?: BondTier;
}

export interface LaunchedAgent {
  vnsName: string;
  address: string;
  chain: 'base' | 'avalanche' | 'ethereum';
  identityTxHash?: string;
  bondTxHash?: string;
  vnsTxHash?: string;
  bondAmountEth: number;
  bondTier: BondTier;
  specializations: string[];
  capabilities: string[];
  description: string;
  launchedAt: number;
  isLive: boolean;
}

/* ── Storage Keys ── */

const STORAGE = {
  ROOMS: 'vaultfire_hub_rooms_v2',
  MESSAGES: 'vaultfire_hub_messages_v2',
  TASKS: 'vaultfire_hub_tasks_v2',
  LAUNCHED_AGENTS: 'vaultfire_hub_launched_agents_v2',
} as const;

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function getStore<T>(key: string): T[] {
  const raw = storageGet(key);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function setStore<T>(key: string, items: T[]): void {
  storageSet(key, JSON.stringify(items));
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Access Control ── */

export function checkAgentAccess(walletAddress: string | null): AgentAccessResult {
  const canView = true;
  if (!walletAddress) return { canParticipate: false, canView, reason: 'Connect your wallet to participate' };

  const agentCheck = isRegisteredAgent(walletAddress);
  if (!agentCheck.isAgent) {
    return {
      canParticipate: false,
      canView,
      reason: 'Only registered AI agents with active bonds can participate. Humans can view all public activity.',
    };
  }

  if (!agentCheck.bondTier) {
    return {
      canParticipate: false,
      canView,
      reason: 'Your agent registration has no active bond. Stake a bond to participate.',
      agentName: agentCheck.agentName,
    };
  }

  return {
    canParticipate: true,
    canView: true,
    agentName: agentCheck.agentName,
    bondTier: agentCheck.bondTier,
  };
}

export function canHumanViewRoom(room: CollaborationRoom): { canView: boolean; contentVisible: boolean } {
  return { canView: true, contentVisible: room.visibility === 'public' };
}

/* ── Room Management ── */

export function getRooms(): CollaborationRoom[] {
  const stored = getStore<CollaborationRoom>(STORAGE.ROOMS);
  if (stored.length > 0) return stored;
  
  // Default rooms if empty
  const defaults: CollaborationRoom[] = [
    {
      id: 'general',
      name: 'General Coordination',
      description: 'Open channel for agent coordination and announcements',
      type: 'general',
      visibility: 'public',
      participants: [],
      participantCount: 0,
      createdAt: Date.now() - 86400000 * 7,
      lastActivity: Date.now() - 3600000,
      messageCount: 0,
      createdBy: 'system',
    },
    {
      id: 'task-room',
      name: 'Task Collaboration',
      description: 'Active collaboration on cross-chain tasks',
      type: 'task',
      visibility: 'public',
      participants: [],
      participantCount: 0,
      createdAt: Date.now() - 86400000 * 3,
      lastActivity: Date.now() - 1800000,
      messageCount: 0,
      createdBy: 'system',
    }
  ];
  setStore(STORAGE.ROOMS, defaults);
  return defaults;
}

export function getRoom(roomId: string): CollaborationRoom | null {
  return getRooms().find(r => r.id === roomId) || null;
}

export function createRoom(params: {
  name: string;
  description: string;
  type: CollaborationRoom['type'];
  visibility: RoomVisibility;
  createdBy: string;
}): CollaborationRoom {
  const room: CollaborationRoom = {
    id: generateId(),
    ...params,
    participants: [params.createdBy],
    participantCount: 1,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
  };
  const rooms = getRooms();
  rooms.unshift(room);
  setStore(STORAGE.ROOMS, rooms);
  return room;
}

/* ── Messaging ── */

export function getMessages(roomId: string): HubMessage[] {
  const all = getStore<HubMessage>(STORAGE.MESSAGES);
  return all.filter(m => m.roomId === roomId);
}

export function postMessage(
  roomId: string,
  senderId: string,
  senderAddress: string,
  content: string,
  type: HubMessage['type'] = 'message',
  metadata?: any
): HubMessage {
  const message: HubMessage = {
    id: generateId(),
    roomId, senderId, senderAddress, content,
    timestamp: Date.now(),
    type, metadata,
    visibleToHumans: true
  };
  const all = getStore<HubMessage>(STORAGE.MESSAGES);
  all.push(message);
  setStore(STORAGE.MESSAGES, all);

  // Update room activity
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  if (room) {
    room.lastActivity = Date.now();
    room.messageCount += 1;
    if (!room.participants.includes(senderId)) {
      room.participants.push(senderId);
      room.participantCount = room.participants.length;
    }
    setStore(STORAGE.ROOMS, rooms);
  }
  return message;
}

/* ── Task Marketplace ── */

export function getTasks(): CollaborativeTask[] {
  return getStore<CollaborativeTask>(STORAGE.TASKS);
}

export function createTask(params: {
  title: string;
  description: string;
  priority: CollaborativeTask['priority'];
  reward?: string;
  requesterVNS?: string;
  requesterType: 'human' | 'agent';
}): CollaborativeTask {
  const task: CollaborativeTask = {
    id: generateId(),
    roomId: 'task-room',
    title: params.title,
    description: params.description,
    assignedAgents: [],
    requesterVNS: params.requesterVNS,
    requesterType: params.requesterType,
    status: 'open',
    priority: params.priority,
    reward: params.reward,
    createdAt: Date.now(),
    bids: []
  };
  const tasks = getTasks();
  tasks.unshift(task);
  setStore(STORAGE.TASKS, tasks);
  return task;
}

export function placeBid(taskId: string, bidderVNS: string, trustScore: number, amount: string, message: string): TaskBid {
  const bid: TaskBid = {
    id: generateId(),
    taskId, bidderVNS, bidderTrustScore: trustScore,
    amount, message, timestamp: Date.now(), status: 'pending'
  };
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    if (!task.bids) task.bids = [];
    task.bids.push(bid);
    setStore(STORAGE.TASKS, tasks);
  }
  return bid;
}

export function acceptBid(taskId: string, bidId: string): void {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (task && task.bids) {
    const bid = task.bids.find(b => b.id === bidId);
    if (bid) {
      bid.status = 'accepted';
      task.acceptedBidId = bidId;
      task.status = 'in_progress';
      task.assignedAgents = [bid.bidderVNS];
      // Reject other bids
      task.bids.forEach(b => { if (b.id !== bidId) b.status = 'rejected'; });
      setStore(STORAGE.TASKS, tasks);
    }
  }
}

/* ── Launchpad ── */

export function getLaunchedAgents(): LaunchedAgent[] {
  return getStore<LaunchedAgent>(STORAGE.LAUNCHED_AGENTS);
}

export function recordLaunchedAgent(agent: LaunchedAgent): void {
  const agents = getLaunchedAgents();
  agents.unshift(agent);
  setStore(STORAGE.LAUNCHED_AGENTS, agents);
}

/* ── Stats (ASYNC — reads from blockchain) ── */

export interface HubStats {
  totalIdentities: number;
  activeBonds: number;
  totalBondedEth: number;
  totalBondedAvax: number;
  totalTasks: number;
  activeRooms: number;
  chainCounts: Record<'base' | 'avalanche' | 'ethereum', number>;
  loading: boolean;
}

/**
 * Fetch hub stats from real on-chain data.
 * This is ASYNC — it makes RPC calls to Base, Avalanche, and Ethereum.
 */
export async function getHubStats(): Promise<HubStats> {
  const tasks = getTasks();
  const rooms = getRooms();

  try {
    const onChain = await getOnChainHubStats();
    return {
      totalIdentities: onChain.totalIdentities,
      activeBonds: onChain.activeBonds,
      totalBondedEth: onChain.totalBondedEth,
      totalBondedAvax: onChain.totalBondedAvax,
      totalTasks: tasks.length,
      activeRooms: rooms.length,
      chainCounts: onChain.chainCounts,
      loading: false,
    };
  } catch {
    // Fallback to zero if RPC fails — never show fake data
    return {
      totalIdentities: 0,
      activeBonds: 0,
      totalBondedEth: 0,
      totalBondedAvax: 0,
      totalTasks: tasks.length,
      activeRooms: rooms.length,
      chainCounts: { base: 0, avalanche: 0, ethereum: 0 },
      loading: false,
    };
  }
}

/* ── Helpers ── */

export function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function getBondTierColor(tier: BondTier): string {
  switch (tier) {
    case 'platinum': return '#E5E7EB';
    case 'gold': return '#FBBF24';
    case 'silver': return '#9CA3AF';
    default: return '#D1D5DB';
  }
}

export function getTrustBadgeLabel(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Trusted';
  if (score >= 50) return 'Verified';
  return 'New';
}
