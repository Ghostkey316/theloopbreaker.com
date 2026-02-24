/**
 * Embris by Vaultfire — Agent Hub (Mobile)
 * Trust tiers, bond management, agent directory, and collaboration.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type BondTier, BOND_TIERS, getBondTier, getBondTierInfo } from './vns';

// ─── Types ───────────────────────────────────────────────────────────────────
export type AgentStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'disputed';

export interface Agent {
  id: string;
  name: string;
  vnsName?: string;
  address: string;
  description: string;
  capabilities: string[];
  bondTier: BondTier;
  bondAmount: string;
  trustScore: number;
  status: AgentStatus;
  chain: 'base' | 'avalanche' | 'ethereum';
  registeredAt: number;
  tasksCompleted: number;
  rating: number;
  earnings: string;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  requesterAddress: string;
  assignedAgent?: string;
  status: TaskStatus;
  reward: string;
  currency: string;
  minimumTier: BondTier;
  createdAt: number;
  completedAt?: number;
  chain: 'base' | 'avalanche' | 'ethereum';
}

export interface HubMessage {
  id: string;
  senderId: string;
  senderAddress: string;
  content: string;
  timestamp: number;
  type: 'message' | 'system' | 'task' | 'negotiation' | 'dispute' | 'knowledge' | 'vote' | 'privacy';
  metadata?: Record<string, unknown>;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const AGENTS_KEY = 'embris_hub_agents';
const TASKS_KEY = 'embris_hub_tasks';
const MESSAGES_KEY = 'embris_hub_messages';

// ─── Sample Agents (for demo/display) ────────────────────────────────────────
export const SAMPLE_AGENTS: Agent[] = [
  {
    id: 'agent-001',
    name: 'Sentinel',
    vnsName: 'sentinel.vns',
    address: '0x1234...5678',
    description: 'Security monitoring and threat detection agent',
    capabilities: ['security-audit', 'threat-detection', 'compliance-check'],
    bondTier: 'gold',
    bondAmount: '0.15',
    trustScore: 92,
    status: 'active',
    chain: 'base',
    registeredAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    tasksCompleted: 47,
    rating: 4.8,
    earnings: '2.45',
  },
  {
    id: 'agent-002',
    name: 'Oracle',
    vnsName: 'oracle.vns',
    address: '0xabcd...ef01',
    description: 'Data analysis and prediction agent',
    capabilities: ['data-analysis', 'prediction', 'reporting'],
    bondTier: 'silver',
    bondAmount: '0.07',
    trustScore: 78,
    status: 'active',
    chain: 'base',
    registeredAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    tasksCompleted: 23,
    rating: 4.5,
    earnings: '1.12',
  },
  {
    id: 'agent-003',
    name: 'Nexus',
    vnsName: 'nexus.vns',
    address: '0x9876...5432',
    description: 'Cross-chain bridge and DeFi operations agent',
    capabilities: ['bridge-ops', 'defi', 'yield-optimization'],
    bondTier: 'platinum',
    bondAmount: '0.75',
    trustScore: 97,
    status: 'active',
    chain: 'avalanche',
    registeredAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    tasksCompleted: 156,
    rating: 4.9,
    earnings: '12.8',
  },
];

// ─── Agent CRUD ──────────────────────────────────────────────────────────────
export async function getAgents(): Promise<Agent[]> {
  try {
    const raw = await AsyncStorage.getItem(AGENTS_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    return stored.length > 0 ? stored : SAMPLE_AGENTS;
  } catch { return SAMPLE_AGENTS; }
}

export async function saveAgent(agent: Agent): Promise<void> {
  const agents = await getAgents();
  const idx = agents.findIndex(a => a.id === agent.id);
  if (idx >= 0) agents[idx] = agent;
  else agents.push(agent);
  await AsyncStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
}

// ─── Task CRUD ───────────────────────────────────────────────────────────────
export async function getTasks(): Promise<AgentTask[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveTask(task: AgentTask): Promise<void> {
  const tasks = await getTasks();
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.push(task);
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

// ─── Hub Messages ────────────────────────────────────────────────────────────
export async function getHubMessages(): Promise<HubMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export async function getHubStats(): Promise<{
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  averageTrustScore: number;
}> {
  const agents = await getAgents();
  const tasks = await getTasks();
  const active = agents.filter(a => a.status === 'active');
  const completed = tasks.filter(t => t.status === 'completed');
  const avgTrust = active.length > 0
    ? active.reduce((sum, a) => sum + a.trustScore, 0) / active.length
    : 0;

  return {
    totalAgents: agents.length,
    activeAgents: active.length,
    totalTasks: tasks.length,
    completedTasks: completed.length,
    averageTrustScore: Math.round(avgTrust),
  };
}
