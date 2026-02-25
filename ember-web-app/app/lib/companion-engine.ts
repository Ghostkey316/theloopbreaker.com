/**
 * Embris Companion Engine — Client-Side Bridge
 *
 * This is the client-side interface to Vaultfire's companion intelligence.
 * It bridges the LOCAL BRAIN (primary) with the server-side /api/companion/think API.
 *
 * ARCHITECTURE:
 * 1. LOCAL BRAIN (companion-brain.ts) = primary intelligence
 *    - Handles Vaultfire knowledge, casual conversation, personality, memory, learning
 *    - Detects when a task needs the execution engine
 * 2. THIS ENGINE = client-side bridge to server tools
 *    - Calls /api/companion/think for tasks the brain can't handle locally
 *    - Manages task state, narration, and result caching
 * 3. SERVER API (/api/companion/think) = tool execution
 *    - Real RPC calls, real API calls, real data
 *    - LLM is just ONE tool, not the brain
 * 4. PERSONALITY = applied to ALL responses
 *    - Every result gets filtered through the companion's soul
 *
 * The brain LEARNS from engine results — caching data for future use.
 */

import { getAllBalances, checkChainConnectivity, getGovernanceData, getTeleporterBridgeStats, getRegistryData } from './blockchain';
import { getCompanionAddress, getCompanionBondStatus } from './companion-agent';
import { getWalletAddress } from './wallet';
import { getGoals, addGoal, updateGoalStatus } from './goal-tracking';
import { getSoul } from './companion-soul';
import { getBrainStats, getTopicInterests, getUserPreferences, setUserPreference, saveBrainInsight } from './companion-brain';
import { PARTNERSHIP_BONDS, IDENTITY_REGISTRY, RPC_URLS, type SupportedChain } from './contracts';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data: string;
  toolName: string;
  executionTime: number;
  error?: string;
}

export interface ExecutionTask {
  type: 'check_balance' | 'web_search' | 'read_contract' | 'get_gas_price' | 'get_token_price' | 'tx_history' | 'manage_goal' | 'check_chain' | 'vns_lookup' | 'complex_reasoning';
  params: Record<string, any>;
  narration?: string;
}

export interface EngineResult {
  response: string;
  thinking: string;
  toolsUsed: string[];
  executionMs: number;
  usedLLM: boolean;
  cached: boolean;
  error?: string;
  extractedFacts?: { key: string; value: string; confidence: number; source: string }[];
}

export interface TaskDetection {
  isTask: boolean;
  taskType: string;
  confidence: number;
}

// ─── Task Detection (Client-Side) ───────────────────────────────────────────

/**
 * Detect if a user message requires the execution engine.
 * This runs BEFORE the local brain — if it's a task, we route to the engine.
 * If it's conversation/knowledge, the brain handles it.
 */
export function detectTask(message: string): TaskDetection {
  const lower = message.toLowerCase().trim();

  // Balance checks
  if (/(?:check|show|get|what(?:'s| is)|my) (?:.*)?balance/i.test(lower) ||
      /how much (?:do i have|eth|avax|funds|money|crypto)/i.test(lower) ||
      /(?:wallet|account) (?:balance|funds)/i.test(lower)) {
    return { isTask: true, taskType: 'check_balance', confidence: 0.95 };
  }

  // Gas price
  if (/(?:gas|gwei|gas price|gas fee|gas cost)/i.test(lower) && !/what is gas/i.test(lower)) {
    return { isTask: true, taskType: 'gas_price', confidence: 0.9 };
  }

  // Token price
  if (/(?:price|worth|cost|value) (?:of |for )?(?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche)/i.test(lower) ||
      /(?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche) (?:price|worth|cost|value)/i.test(lower) ||
      /how much is (?:eth|btc|avax|sol|matic|link|uni|aave|op|arb|bitcoin|ethereum|solana|avalanche)/i.test(lower)) {
    return { isTask: true, taskType: 'token_price', confidence: 0.9 };
  }

  // Block number
  if (/(?:block number|latest block|current block|what block)/i.test(lower)) {
    return { isTask: true, taskType: 'block_number', confidence: 0.85 };
  }

  // Chain status
  if (/(?:chain|network|rpc) (?:status|health|alive|online|down|up)/i.test(lower) ||
      /is (?:base|ethereum|avalanche|eth|avax) (?:up|down|online|alive|working)/i.test(lower)) {
    return { isTask: true, taskType: 'chain_status', confidence: 0.9 };
  }

  // Contract read
  if (/(?:read|check|inspect|look at|show me) (?:.*)?contract/i.test(lower) ||
      /contract (?:state|data|status|info)/i.test(lower)) {
    return { isTask: true, taskType: 'read_contract', confidence: 0.85 };
  }

  // Transaction history
  if (/(?:transaction|tx|txn) (?:history|list|recent|last)/i.test(lower) ||
      /(?:recent|last|latest) (?:transaction|tx|txn)/i.test(lower) ||
      /(?:show|get|check) (?:my )?(?:transaction|tx|txn)/i.test(lower)) {
    return { isTask: true, taskType: 'tx_history', confidence: 0.85 };
  }

  // Web search (lower confidence — only if explicitly asked)
  if (/^(?:search|look up|google|find out|research) /i.test(lower)) {
    return { isTask: true, taskType: 'web_search', confidence: 0.7 };
  }

  // Not a task — let the local brain handle it
  return { isTask: false, taskType: 'conversation', confidence: 0 };
}

// ─── Call Vaultfire's /api/companion/think ───────────────────────────────────

/**
 * Call Vaultfire's own API endpoint for tool execution and complex reasoning.
 * This is the bridge between the client-side brain and server-side tools.
 */
export async function callThinkAPI(
  message: string,
  options?: {
    conversationHistory?: { role: string; content: string }[];
    userWallet?: string;
    companionWallet?: string;
    companionName?: string;
  }
): Promise<EngineResult> {
  const start = Date.now();

  try {
    // Gather brain context (including preferences and known facts for personalization)
    let brainContext;
    try {
      const stats = getBrainStats();
      const interests = getTopicInterests();
      const prefs = getUserPreferences();
      brainContext = {
        knowledgeEntries: stats.knowledgeEntries,
        learnedInsights: stats.learnedInsights,
        memoriesCount: stats.memoriesCount,
        topTopics: interests.slice(0, 5).map(t => t.topic),
        userPreferences: prefs.slice(0, 10).map(p => ({ key: p.key, value: String(p.value) })),
        knownFacts: stats.knownFacts,
      };
    } catch { /* brain not available */ }

    // Gather soul context
    let soulContext;
    try {
      const soul = getSoul();
      soulContext = {
        name: soul.name,
        motto: soul.motto,
        traits: soul.traits.map(t => ({ name: t.name, strength: t.strength })),
        values: soul.values.map(v => ({ name: v.name, priority: v.priority })),
      };
    } catch { /* soul not available */ }

    const res = await fetch('/api/companion/think', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory: options?.conversationHistory?.slice(-8),
        brainContext,
        soulContext,
        userWallet: options?.userWallet,
        companionWallet: options?.companionWallet,
        companionName: options?.companionName,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();

    // Apply extracted facts to local brain immediately (fast learning)
    if (data.extractedFacts && Array.isArray(data.extractedFacts)) {
      try {
        for (const fact of data.extractedFacts) {
          if (fact.key && fact.value) {
            setUserPreference(fact.key, fact.value, fact.confidence || 0.8);
            if (fact.key === 'explicit_memory') {
              saveBrainInsight(`Remembered: ${fact.value}`, 'explicit_memory');
            }
          }
        }
      } catch { /* ignore brain update errors */ }
    }

    return {
      response: data.response || '',
      thinking: data.thinking || '',
      toolsUsed: data.toolsUsed || [],
      executionMs: data.executionMs || Date.now() - start,
      usedLLM: data.usedLLM || false,
      cached: false,
      error: data.error,
      extractedFacts: data.extractedFacts || [],
    };
  } catch (error) {
    return {
      response: '',
      thinking: '',
      toolsUsed: [],
      executionMs: Date.now() - start,
      usedLLM: false,
      cached: false,
      error: error instanceof Error ? error.message : 'Engine call failed',
    };
  }
}

// ─── Client-Side Tool Execution (for local tasks) ──────────────────────────

export async function checkBalance(address?: string): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const targetAddr = address || getWalletAddress() || getCompanionAddress();
    if (!targetAddr) {
      return { success: false, data: 'No wallet address found.', toolName: 'check_balance', executionTime: Date.now() - startTime, error: 'NO_ADDRESS' };
    }
    const balances = await getAllBalances(targetAddr);
    const formatted = balances.map(b =>
      `**${b.chain}**: ${b.balanceFormatted} ${b.symbol}${b.error ? ` (error: ${b.error})` : ''}`
    ).join('\n');
    return { success: true, data: `Multi-chain balances for \`${targetAddr.slice(0, 10)}...${targetAddr.slice(-6)}\`:\n${formatted}`, toolName: 'check_balance', executionTime: Date.now() - startTime };
  } catch (e) {
    return { success: false, data: 'Failed to check balances.', toolName: 'check_balance', executionTime: Date.now() - startTime, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getGasPrice(chain: SupportedChain): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const rpc = RPC_URLS[chain];
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_gasPrice', params: [] }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const gasPriceGwei = Number(BigInt(data.result)) / 1e9;
    return { success: true, data: `**Gas Price** on ${chain}: **${gasPriceGwei.toFixed(2)} Gwei**`, toolName: 'get_gas_price', executionTime: Date.now() - startTime };
  } catch (e) {
    return { success: false, data: 'Failed to fetch gas price.', toolName: 'get_gas_price', executionTime: Date.now() - startTime, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function readContractState(chain: SupportedChain, contractName: string): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    let result = '';
    if (contractName.toLowerCase().includes('governance')) {
      const govData = await getGovernanceData(chain, PARTNERSHIP_BONDS[chain]);
      result = `**Governance Data** (${chain}):\n- Alive: ${govData.isAlive}\n- Proposals: ${govData.proposalCount ?? 'N/A'}\n- Threshold: ${govData.threshold ?? 'N/A'}`;
    } else if (contractName.toLowerCase().includes('bridge')) {
      const bridgeData = await getTeleporterBridgeStats(chain, PARTNERSHIP_BONDS[chain]);
      result = `**Bridge Stats** (${chain}):\n- Alive: ${bridgeData.isAlive}\n- Messages: ${bridgeData.messageCount ?? 'N/A'}\n- Paused: ${bridgeData.paused !== null ? String(bridgeData.paused) : 'N/A'}`;
    } else if (contractName.toLowerCase().includes('registry')) {
      const regData = await getRegistryData(chain, IDENTITY_REGISTRY[chain]);
      result = `**Registry Data** (${chain}):\n- Alive: ${regData.isAlive}\n- Entries: ${regData.entryCount ?? 'N/A'}`;
    } else {
      result = `Contract read for **${contractName}** on **${chain}**`;
    }
    return { success: true, data: result, toolName: 'read_contract', executionTime: Date.now() - startTime };
  } catch (e) {
    return { success: false, data: 'Failed to read contract.', toolName: 'read_contract', executionTime: Date.now() - startTime, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkChainStatus(chain: SupportedChain): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const status = await checkChainConnectivity(chain);
    if (status.success) {
      return { success: true, data: `**${chain}** is online!\n- Block: #${status.blockNumber}\n- Chain ID: ${status.chainId}\n- Latency: ${status.latency}ms`, toolName: 'check_chain', executionTime: Date.now() - startTime };
    } else {
      return { success: false, data: `**${chain}** is unreachable.`, toolName: 'check_chain', executionTime: Date.now() - startTime, error: status.error };
    }
  } catch (e) {
    return { success: false, data: 'Failed to check chain.', toolName: 'check_chain', executionTime: Date.now() - startTime, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function manageGoal(action: 'list' | 'add' | 'update', params: any): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    let result = '';
    switch (action) {
      case 'list': {
        const goals = getGoals();
        if (goals.length === 0) { result = 'No goals yet.'; }
        else {
          const active = goals.filter(g => g.status === 'active');
          const completed = goals.filter(g => g.status === 'completed');
          result = `**Active** (${active.length}):\n${active.map(g => `- ${g.title} (${g.progress}%)`).join('\n')}\n**Completed** (${completed.length}):\n${completed.map(g => `- ✓ ${g.title}`).join('\n')}`;
        }
        break;
      }
      case 'add': {
        const goal = addGoal(params.title, params.description);
        result = `Added goal: **${goal.title}**`;
        break;
      }
      case 'update': {
        const updated = updateGoalStatus(params.goalId, params.status);
        result = updated ? `Updated goal to **${params.status}**` : 'Goal not found.';
        break;
      }
    }
    return { success: true, data: result, toolName: 'manage_goal', executionTime: Date.now() - startTime };
  } catch (e) {
    return { success: false, data: 'Failed to manage goal.', toolName: 'manage_goal', executionTime: Date.now() - startTime, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Main Execution Router ──────────────────────────────────────────────────

export async function executeTask(task: ExecutionTask): Promise<ToolResult> {
  switch (task.type) {
    case 'check_balance': return checkBalance(task.params.address);
    case 'get_gas_price': return getGasPrice(task.params.chain);
    case 'read_contract': return readContractState(task.params.chain, task.params.contractName);
    case 'check_chain': return checkChainStatus(task.params.chain);
    case 'manage_goal': return manageGoal(task.params.action, task.params);
    default:
      return { success: false, data: 'Unknown task type.', toolName: 'unknown', executionTime: 0, error: 'UNKNOWN_TASK' };
  }
}

// ─── Personality Filter ─────────────────────────────────────────────────────

export function filterResultThroughPersonality(toolResult: ToolResult, narration?: string): string {
  const soul = getSoul();
  if (toolResult.success) {
    let response = narration || 'Yo, I got that for you:\n\n';
    response += toolResult.data;
    if (toolResult.executionTime < 1000) response += `\n\n_Executed in ${toolResult.executionTime}ms_`;
    return response;
  } else {
    let response = narration || 'Hmm, I hit a snag:\n\n';
    response += `**Error**: ${toolResult.error || 'Unknown error'}\n${toolResult.data}`;
    if (soul.traits.find(t => t.name === 'Encouraging')) response += `\n\nBut hey, we'll figure this out. Want me to try a different approach?`;
    return response;
  }
}

// ─── Task Detection from User Message ───────────────────────────────────────

export function detectExecutableTasks(userMessage: string): ExecutionTask[] {
  const lower = userMessage.toLowerCase();
  const tasks: ExecutionTask[] = [];

  if (/(?:check|show|what.*balance|how much|eth|funds)/i.test(lower) && /balance/i.test(lower)) {
    tasks.push({ type: 'check_balance', params: {}, narration: '🔍 Let me check your balances across all chains...' });
  }
  if (/(?:gas price|gwei)/i.test(lower)) {
    const chainMatch = lower.match(/(base|ethereum|avalanche)/i);
    tasks.push({ type: 'get_gas_price', params: { chain: (chainMatch ? chainMatch[1].toLowerCase() : 'base') as SupportedChain }, narration: '⛽ Checking gas prices...' });
  }
  if (/(?:chain|network|online|status).*(?:base|ethereum|avalanche)/i.test(lower)) {
    const chainMatch = lower.match(/(base|ethereum|avalanche)/i);
    if (chainMatch) tasks.push({ type: 'check_chain', params: { chain: chainMatch[1].toLowerCase() as SupportedChain }, narration: `🌐 Checking if ${chainMatch[1]} is alive...` });
  }
  if (/(?:goals|goal|track|progress)/i.test(lower)) {
    tasks.push({ type: 'manage_goal', params: { action: 'list' }, narration: '📋 Let me pull up your goals...' });
  }

  return tasks;
}

// ─── Engine Stats ───────────────────────────────────────────────────────────

const ENGINE_STATS_KEY = 'embris_engine_stats_v1';

interface EngineStats {
  totalCalls: number;
  toolCalls: Record<string, number>;
  avgResponseMs: number;
  llmCallCount: number;
  localBrainHandled: number;
  lastCallAt: number;
}

function getEngineStatsInternal(): EngineStats {
  if (typeof window === 'undefined') return { totalCalls: 0, toolCalls: {}, avgResponseMs: 0, llmCallCount: 0, localBrainHandled: 0, lastCallAt: 0 };
  try {
    const raw = localStorage.getItem(ENGINE_STATS_KEY);
    return raw ? JSON.parse(raw) : { totalCalls: 0, toolCalls: {}, avgResponseMs: 0, llmCallCount: 0, localBrainHandled: 0, lastCallAt: 0 };
  } catch {
    return { totalCalls: 0, toolCalls: {}, avgResponseMs: 0, llmCallCount: 0, localBrainHandled: 0, lastCallAt: 0 };
  }
}

export function recordEngineCall(result: EngineResult): void {
  if (typeof window === 'undefined') return;
  try {
    const stats = getEngineStatsInternal();
    stats.totalCalls++;
    stats.lastCallAt = Date.now();
    if (result.usedLLM) stats.llmCallCount++;
    for (const tool of result.toolsUsed) {
      stats.toolCalls[tool] = (stats.toolCalls[tool] || 0) + 1;
    }
    stats.avgResponseMs = Math.round((stats.avgResponseMs * (stats.totalCalls - 1) + result.executionMs) / stats.totalCalls);
    localStorage.setItem(ENGINE_STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function recordLocalBrainHandled(): void {
  if (typeof window === 'undefined') return;
  try {
    const stats = getEngineStatsInternal();
    stats.localBrainHandled++;
    localStorage.setItem(ENGINE_STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function getEngineStats(): EngineStats {
  return getEngineStatsInternal();
}
