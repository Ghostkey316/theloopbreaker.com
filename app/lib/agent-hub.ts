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
 * ── DATA INTEGRITY ─────────────────────────────────────────────────────────
 * NO fake data. NO seeded placeholders. NO demo content.
 * Every number shown to users reflects actual state.
 * If the network is empty, we show honest zeros and invite participation.
 */

import {
  isRegisteredAgent,
  getKnownAgents,
  type BondTier,
  type IdentityType,
} from './vns';

/* ── Types ── */

export type RoomVisibility = 'public' | 'private';

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
  metadata?: Record<string, unknown>;
  visibleToHumans: boolean;
}

export interface CollaborativeTask {
  id: string;
  title: string;
  description: string;
  assignedAgents: string[];
  requesterVNS?: string;
  requesterAddress?: string;
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
  bidderAddress: string;
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

export interface HubStats {
  totalIdentities: number;
  activeBonds: number;
  totalBondedEth: number;
  totalBondedAvax: number;
  totalTasks: number;
  activeRooms: number;
}

/* ── Storage Keys ── */

const STORAGE = {
  ROOMS: 'vaultfire_hub_rooms_v3',
  MESSAGES: 'vaultfire_hub_messages_v3',
  TASKS: 'vaultfire_hub_tasks_v3',
  LAUNCHED_AGENTS: 'vaultfire_hub_launched_agents_v3',
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

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Access Control ── */

export function checkAgentAccess(walletAddress: string | null): AgentAccessResult {
  const canView = true;
  if (!walletAddress) {
    return { canParticipate: false, canView, reason: 'Connect your wallet to participate' };
  }

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

/**
 * Returns only rooms that have actually been created by real participants.
 * No default/seeded rooms — the network starts empty and grows organically.
 */
export function getRooms(): CollaborationRoom[] {
  return getStore<CollaborationRoom>(STORAGE.ROOMS);
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

/**
 * Returns only real messages posted by real participants.
 * No seeded/demo messages.
 */
export function getMessages(roomId: string): HubMessage[] {
  return getStore<HubMessage>(STORAGE.MESSAGES).filter(m => m.roomId === roomId);
}

export function postMessage(
  roomId: string,
  senderId: string,
  senderAddress: string,
  content: string,
  type: HubMessage['type'] = 'message',
  metadata?: Record<string, unknown>
): HubMessage {
  const message: HubMessage = {
    id: generateId(),
    roomId, senderId, senderAddress, content,
    timestamp: Date.now(),
    type, metadata,
    visibleToHumans: true,
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

/**
 * Returns only real tasks posted by real participants.
 * No seeded/demo tasks.
 */
export function getTasks(): CollaborativeTask[] {
  return getStore<CollaborativeTask>(STORAGE.TASKS);
}

export function createTask(params: {
  title: string;
  description: string;
  requesterVNS?: string;
  requesterAddress?: string;
  requesterType: 'human' | 'agent';
  priority: CollaborativeTask['priority'];
  reward?: string;
}): CollaborativeTask {
  const task: CollaborativeTask = {
    id: generateId(),
    title: params.title,
    description: params.description,
    assignedAgents: [],
    requesterVNS: params.requesterVNS,
    requesterAddress: params.requesterAddress,
    requesterType: params.requesterType,
    status: 'open',
    priority: params.priority,
    reward: params.reward,
    createdAt: Date.now(),
    bids: [],
  };
  const tasks = getTasks();
  tasks.unshift(task);
  setStore(STORAGE.TASKS, tasks);
  return task;
}

export function placeBid(
  taskId: string,
  bidderVNS: string,
  bidderAddress: string,
  trustScore: number,
  amount: string,
  message: string
): TaskBid {
  const bid: TaskBid = {
    id: generateId(),
    taskId, bidderVNS, bidderAddress, bidderTrustScore: trustScore,
    amount, message, timestamp: Date.now(), status: 'pending',
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
  const index = agents.findIndex(a => a.vnsName === agent.vnsName);
  if (index >= 0) {
    agents[index] = agent;
  } else {
    agents.unshift(agent);
  }
  setStore(STORAGE.LAUNCHED_AGENTS, agents);
}

export function getLaunchedAgent(vnsName: string): LaunchedAgent | null {
  return getLaunchedAgents().find(a => a.vnsName === vnsName) || null;
}

/* ── Stats ── */

/**
 * Returns real stats only.
 * - Identity count: from getKnownAgents() — includes protocol agents + locally registered
 * - Bond count: agents with hasBond === true
 * - Bonded amounts: sum of real bond amounts
 * - Tasks: count of real tasks posted
 * - Rooms: count of real rooms created
 *
 * The protocol has 2 known agents (embris + ns3) — these are real.
 * Additional agents appear as users register through the Launchpad.
 */
export function getHubStats(): HubStats {
  const agents = getKnownAgents();
  const tasks = getTasks();
  const rooms = getRooms();

  return {
    totalIdentities: agents.length,
    activeBonds: agents.filter(a => a.hasBond).length,
    totalBondedEth: agents
      .filter(a => a.hasBond && a.chain !== 'avalanche')
      .reduce((sum, a) => sum + parseFloat(a.bondAmount || '0'), 0),
    totalBondedAvax: agents
      .filter(a => a.hasBond && a.chain === 'avalanche')
      .reduce((sum, a) => sum + parseFloat(a.bondAmount || '0'), 0),
    totalTasks: tasks.length,
    activeRooms: rooms.length,
  };
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
    default: return '#CD7F32';
  }
}

export function getTrustBadgeLabel(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'Trusted';
  if (score >= 50) return 'Verified';
  return 'New';
}

export type { IdentityType };
