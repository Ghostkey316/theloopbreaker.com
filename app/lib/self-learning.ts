/**
 * Embris Self-Learning System
 *
 * Builds on top of memory.ts to give Embris the ability to:
 * 1. Generate reflections after each conversation exchange
 * 2. Recognize patterns across multiple conversations
 * 3. Generate novel insights by connecting dots
 * 4. Self-correct when new information contradicts old memories
 * 5. Track its own growth over time
 *
 * All data persists in localStorage alongside the existing memory system.
 */

import type { Memory } from './memory';
import { getMemories, saveMemories } from './memory';

/* ── Storage Keys ── */

const REFLECTIONS_KEY = 'embris_reflections_v1';
const PATTERNS_KEY = 'embris_patterns_v1';
const INSIGHTS_KEY = 'embris_insights_v1';
const GROWTH_KEY = 'embris_growth_v1';

/* ── Types ── */

export interface Reflection {
  id: string;
  content: string;
  conversationExcerpt: string; // brief context of what triggered it
  timestamp: number;
  depth: 'surface' | 'behavioral' | 'deep'; // how deep the reflection goes
}

export interface Pattern {
  id: string;
  content: string;
  supportingEvidence: string[]; // memory IDs or brief excerpts that support this
  strength: number; // 0-1, increases as more evidence accumulates
  category: 'communication' | 'priorities' | 'workflow' | 'personality' | 'technical' | 'general';
  firstObserved: number;
  lastReinforced: number;
  observationCount: number;
}

export interface Insight {
  id: string;
  content: string;
  connectedMemories: string[]; // memory IDs or excerpts that led to this insight
  confidence: number; // 0-1
  actionable: boolean; // whether Embris should proactively act on this
  timestamp: number;
  used: boolean; // whether Embris has referenced this in conversation
}

export interface GrowthStats {
  totalConversations: number;
  totalMemories: number;
  totalReflections: number;
  totalPatterns: number;
  totalInsights: number;
  selfCorrections: number;
  firstConversation: number;
  lastConversation: number;
  patternSynthesisCount: number; // how many times meta-analysis has run
  lastPatternSynthesis: number;
}

/* ── Storage Helpers ── */

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ── Persistence ── */

export function getReflections(): Reflection[] {
  const raw = storageGet(REFLECTIONS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Reflection[]; } catch { return []; }
}

function saveReflections(reflections: Reflection[]): void {
  // Keep max 100 reflections, most recent first
  const trimmed = reflections
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);
  storageSet(REFLECTIONS_KEY, JSON.stringify(trimmed));
}

export function getPatterns(): Pattern[] {
  const raw = storageGet(PATTERNS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Pattern[]; } catch { return []; }
}

function savePatterns(patterns: Pattern[]): void {
  // Keep max 50 patterns, sorted by strength
  const trimmed = patterns
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 50);
  storageSet(PATTERNS_KEY, JSON.stringify(trimmed));
}

export function getInsights(): Insight[] {
  const raw = storageGet(INSIGHTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Insight[]; } catch { return []; }
}

function saveInsights(insights: Insight[]): void {
  // Keep max 50 insights, prioritize unused actionable ones
  const sorted = insights.sort((a, b) => {
    // Unused actionable insights first
    const scoreA = (a.used ? 0 : 1) + (a.actionable ? 0.5 : 0) + a.confidence * 0.3;
    const scoreB = (b.used ? 0 : 1) + (b.actionable ? 0.5 : 0) + b.confidence * 0.3;
    return scoreB - scoreA;
  });
  storageSet(INSIGHTS_KEY, JSON.stringify(sorted.slice(0, 50)));
}

export function getGrowthStats(): GrowthStats {
  const raw = storageGet(GROWTH_KEY);
  if (!raw) {
    return {
      totalConversations: 0,
      totalMemories: 0,
      totalReflections: 0,
      totalPatterns: 0,
      totalInsights: 0,
      selfCorrections: 0,
      firstConversation: 0,
      lastConversation: 0,
      patternSynthesisCount: 0,
      lastPatternSynthesis: 0,
    };
  }
  try { return JSON.parse(raw) as GrowthStats; } catch {
    return {
      totalConversations: 0, totalMemories: 0, totalReflections: 0,
      totalPatterns: 0, totalInsights: 0, selfCorrections: 0,
      firstConversation: 0, lastConversation: 0,
      patternSynthesisCount: 0, lastPatternSynthesis: 0,
    };
  }
}

function saveGrowthStats(stats: GrowthStats): void {
  storageSet(GROWTH_KEY, JSON.stringify(stats));
}

/* ── Increment conversation counter ── */

export function incrementConversation(): GrowthStats {
  const stats = getGrowthStats();
  const now = Date.now();
  stats.totalConversations += 1;
  if (stats.firstConversation === 0) stats.firstConversation = now;
  stats.lastConversation = now;
  stats.totalMemories = getMemories().length;
  stats.totalReflections = getReflections().length;
  stats.totalPatterns = getPatterns().length;
  stats.totalInsights = getInsights().length;
  saveGrowthStats(stats);
  return stats;
}

/* ── Refresh growth stats snapshot ── */

export function refreshGrowthStats(): GrowthStats {
  const stats = getGrowthStats();
  stats.totalMemories = getMemories().length;
  stats.totalReflections = getReflections().length;
  stats.totalPatterns = getPatterns().length;
  stats.totalInsights = getInsights().length;
  saveGrowthStats(stats);
  return stats;
}

/* ── Check if pattern synthesis is due ── */

export function isPatternSynthesisDue(): boolean {
  const stats = getGrowthStats();
  const conversationsSinceLastSynthesis = stats.totalConversations - (stats.patternSynthesisCount * 5);
  return conversationsSinceLastSynthesis >= 5;
}

/* ── LLM API for self-learning calls ── */

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';

async function llmCall(systemPrompt: string, userPrompt: string, apiKey: string, maxTokens = 1024): Promise<string> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
        stream: false,
      }),
    });

    if (!response.ok) return '';
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || '';
  } catch {
    return '';
  }
}

function parseJsonResponse<T>(raw: string): T | null {
  if (!raw) return null;
  let cleaned = raw;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════
   1. REFLECTION GENERATION
   After each conversation exchange, Embris reflects on what
   it learned — not just facts, but behavioral observations.
   ══════════════════════════════════════════════════════════ */

export async function generateReflection(
  userMessage: string,
  assistantResponse: string,
  memories: Memory[],
  apiKey: string,
): Promise<Reflection | null> {
  const recentReflections = getReflections().slice(0, 10);
  const recentReflectionsSummary = recentReflections.length > 0
    ? recentReflections.map(r => `- ${r.content}`).join('\n')
    : '(no previous reflections)';

  const memorySummary = memories.slice(-20).map(m => `- [${m.category}] ${m.content}`).join('\n');

  const prompt = `You are the self-reflection module for an AI companion called Embris. After each conversation exchange, you generate a thoughtful reflection about what Embris learned — not just facts, but deeper behavioral and relational observations.

EXISTING MEMORIES:
${memorySummary || '(none yet)'}

RECENT REFLECTIONS (avoid repeating):
${recentReflectionsSummary}

LATEST EXCHANGE:
User: ${userMessage}
Embris: ${assistantResponse}

Generate ONE reflection. This should be a genuine insight about the user — their personality, communication style, values, emotional state, what they care about, how Embris should adapt. Think beyond surface facts.

Examples of GOOD reflections:
- "G values direct communication and gets frustrated when things feel like demos. I should be more action-oriented in my responses."
- "When G asks about technical details, they usually follow up with design quality questions. They care about the full picture, not just functionality."
- "G seems to be in a building phase — they're moving fast and want a partner who keeps up, not one who slows them down with caveats."

Examples of BAD reflections (too shallow):
- "User asked about contracts" (just a fact, not a reflection)
- "User said hello" (trivial)

If the exchange is too trivial for a meaningful reflection (like a greeting), respond with: {"skip": true}

Otherwise respond with JSON (no markdown):
{"content": "your reflection here", "depth": "surface|behavioral|deep", "excerpt": "brief 10-word summary of what triggered this"}`;

  const raw = await llmCall(
    'You generate thoughtful self-reflections for an AI companion. Respond only with valid JSON.',
    prompt,
    apiKey,
  );

  const parsed = parseJsonResponse<{ content?: string; depth?: string; excerpt?: string; skip?: boolean }>(raw);
  if (!parsed || parsed.skip || !parsed.content) return null;

  const reflection: Reflection = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: parsed.content,
    conversationExcerpt: parsed.excerpt || userMessage.slice(0, 60),
    timestamp: Date.now(),
    depth: (['surface', 'behavioral', 'deep'].includes(parsed.depth || '') ? parsed.depth : 'surface') as Reflection['depth'],
  };

  const existing = getReflections();
  saveReflections([reflection, ...existing]);

  return reflection;
}

/* ══════════════════════════════════════════════════════════
   2. SELF-CORRECTION
   Detects contradictions between new information and existing
   memories, then updates old memories instead of just adding.
   ══════════════════════════════════════════════════════════ */

export async function detectAndCorrect(
  userMessage: string,
  assistantResponse: string,
  memories: Memory[],
  apiKey: string,
): Promise<{ corrected: boolean; updatedMemories: Memory[]; corrections: string[] }> {
  if (memories.length === 0) {
    return { corrected: false, updatedMemories: memories, corrections: [] };
  }

  const memorySummary = memories.map((m, i) => `[${i}] ${m.content}`).join('\n');

  const prompt = `You are a contradiction detection system for an AI companion's memory. Check if the user's latest message contradicts or updates any existing memories.

EXISTING MEMORIES (with index):
${memorySummary}

LATEST USER MESSAGE: ${userMessage}
LATEST ASSISTANT RESPONSE: ${assistantResponse}

Check for contradictions or updates. Examples:
- Memory says "User likes blue" but user now says "I actually prefer orange" → contradiction
- Memory says "User is building a DeFi app" but user now says "I pivoted to an NFT marketplace" → update
- Memory says "User works at Google" but user says "I just left Google for a startup" → update

If you find contradictions, respond with JSON (no markdown):
{"corrections": [{"memoryIndex": 0, "oldContent": "...", "newContent": "...", "reason": "..."}]}

If no contradictions found, respond with:
{"corrections": []}`;

  const raw = await llmCall(
    'You detect contradictions in AI memory systems. Respond only with valid JSON.',
    prompt,
    apiKey,
  );

  const parsed = parseJsonResponse<{ corrections: Array<{ memoryIndex: number; oldContent: string; newContent: string; reason: string }> }>(raw);
  if (!parsed || !parsed.corrections || parsed.corrections.length === 0) {
    return { corrected: false, updatedMemories: memories, corrections: [] };
  }

  const updatedMemories = [...memories];
  const correctionDescriptions: string[] = [];

  for (const correction of parsed.corrections) {
    const idx = correction.memoryIndex;
    if (idx >= 0 && idx < updatedMemories.length) {
      const oldMem = updatedMemories[idx];
      updatedMemories[idx] = {
        ...oldMem,
        content: correction.newContent,
        timestamp: Date.now(),
        confidence: Math.min(1, oldMem.confidence + 0.1), // boost confidence on correction
        source: 'ai' as const,
      };
      correctionDescriptions.push(`Updated: "${correction.oldContent}" → "${correction.newContent}" (${correction.reason})`);
    }
  }

  if (correctionDescriptions.length > 0) {
    saveMemories(updatedMemories);

    // Track self-corrections in growth stats
    const stats = getGrowthStats();
    stats.selfCorrections += correctionDescriptions.length;
    saveGrowthStats(stats);
  }

  return {
    corrected: correctionDescriptions.length > 0,
    updatedMemories,
    corrections: correctionDescriptions,
  };
}

/* ══════════════════════════════════════════════════════════
   3. PATTERN SYNTHESIS
   Every N conversations, analyze all memories and reflections
   to identify recurring patterns and meta-observations.
   ══════════════════════════════════════════════════════════ */

export async function synthesizePatterns(
  apiKey: string,
): Promise<Pattern[]> {
  const memories = getMemories();
  const reflections = getReflections();
  const existingPatterns = getPatterns();

  if (memories.length < 3 && reflections.length < 2) {
    return existingPatterns; // not enough data yet
  }

  const memorySummary = memories.slice(-50).map(m => `- [${m.category}] ${m.content}`).join('\n');
  const reflectionSummary = reflections.slice(0, 20).map(r => `- [${r.depth}] ${r.content}`).join('\n');
  const existingPatternsSummary = existingPatterns.map(p => `- [${p.category}, strength=${p.strength.toFixed(2)}] ${p.content}`).join('\n');

  const prompt = `You are a pattern recognition system for an AI companion called Embris. Analyze the accumulated memories and reflections to identify recurring patterns about the user.

ACCUMULATED MEMORIES:
${memorySummary}

REFLECTIONS:
${reflectionSummary}

EXISTING PATTERNS (reinforce or update these if still valid, add new ones):
${existingPatternsSummary || '(none yet)'}

Identify patterns across these data points. Look for:
- Communication preferences (how they like to interact)
- Priority patterns (what they care about most)
- Workflow patterns (how they work, when they're productive)
- Personality traits (values, temperament, style)
- Technical preferences (tools, approaches, standards)

For each pattern, provide:
- content: A clear statement of the pattern
- category: communication | priorities | workflow | personality | technical | general
- strength: 0.3-1.0 (higher = more evidence)
- evidence: 2-3 brief supporting observations

Rules:
- Merge or update existing patterns if they're still valid
- Remove patterns that are contradicted by new evidence
- Be specific — "User prefers short confirmations" is better than "User has communication preferences"
- Maximum 10 patterns total

Respond with JSON (no markdown):
[{"content": "...", "category": "...", "strength": 0.7, "evidence": ["...", "..."]}]`;

  const raw = await llmCall(
    'You identify behavioral patterns from accumulated AI companion data. Respond only with valid JSON arrays.',
    prompt,
    apiKey,
    2048,
  );

  const parsed = parseJsonResponse<Array<{ content: string; category: string; strength: number; evidence: string[] }>>(raw);
  if (!parsed || !Array.isArray(parsed)) return existingPatterns;

  const now = Date.now();
  const newPatterns: Pattern[] = parsed
    .filter(p => p.content && typeof p.content === 'string')
    .map(p => {
      // Check if this pattern already exists (update it)
      const existing = existingPatterns.find(ep =>
        ep.content.toLowerCase().includes(p.content.toLowerCase().slice(0, 30)) ||
        p.content.toLowerCase().includes(ep.content.toLowerCase().slice(0, 30))
      );

      if (existing) {
        return {
          ...existing,
          content: p.content,
          strength: Math.min(1, existing.strength + 0.1),
          supportingEvidence: [...new Set([...existing.supportingEvidence, ...(p.evidence || [])])].slice(0, 5),
          lastReinforced: now,
          observationCount: existing.observationCount + 1,
        };
      }

      return {
        id: `pat_${now}_${Math.random().toString(36).slice(2, 8)}`,
        content: p.content,
        supportingEvidence: p.evidence || [],
        strength: Math.min(1, Math.max(0.3, p.strength || 0.5)),
        category: (['communication', 'priorities', 'workflow', 'personality', 'technical', 'general'].includes(p.category) ? p.category : 'general') as Pattern['category'],
        firstObserved: now,
        lastReinforced: now,
        observationCount: 1,
      };
    });

  savePatterns(newPatterns);

  // Update growth stats
  const stats = getGrowthStats();
  stats.patternSynthesisCount += 1;
  stats.lastPatternSynthesis = now;
  stats.totalPatterns = newPatterns.length;
  saveGrowthStats(stats);

  return newPatterns;
}

/* ══════════════════════════════════════════════════════════
   4. INSIGHT GENERATION
   Connects dots between different memories, reflections,
   and patterns to generate novel insights and suggestions.
   ══════════════════════════════════════════════════════════ */

export async function generateInsights(
  apiKey: string,
): Promise<Insight[]> {
  const memories = getMemories();
  const reflections = getReflections();
  const patterns = getPatterns();
  const existingInsights = getInsights();

  if (memories.length < 3) return existingInsights;

  const memorySummary = memories.slice(-40).map(m => `- [${m.category}] ${m.content}`).join('\n');
  const patternSummary = patterns.slice(0, 10).map(p => `- [${p.category}] ${p.content}`).join('\n');
  const reflectionSummary = reflections.slice(0, 10).map(r => `- ${r.content}`).join('\n');
  const existingInsightsSummary = existingInsights.map(i => `- ${i.content}`).join('\n');

  const prompt = `You are an insight generation system for an AI companion called Embris. Connect dots between different things you've learned to generate novel, actionable insights.

MEMORIES:
${memorySummary}

PATTERNS:
${patternSummary || '(none yet)'}

REFLECTIONS:
${reflectionSummary || '(none yet)'}

EXISTING INSIGHTS (don't duplicate):
${existingInsightsSummary || '(none yet)'}

Generate 1-3 NEW insights by connecting different pieces of information. Good insights:
- Connect two or more separate observations into a new understanding
- Suggest proactive actions Embris could take
- Predict what the user might need or want next
- Identify opportunities based on the user's goals and preferences

Examples:
- "Since G deployed accountability bonds and cares about privacy, the next logical feature might be privacy-preserving verification"
- "G mentioned wanting Embris to be a full agent — I should proactively suggest agent capabilities when relevant"
- "G works late and prefers quick responses — I should keep my answers concise during evening conversations"

Rules:
- Each insight must connect at least 2 different data points
- Mark insights as actionable if Embris should proactively act on them
- Don't repeat existing insights
- If no meaningful new insights can be generated, return an empty array

Respond with JSON (no markdown):
[{"content": "...", "connectedPoints": ["brief point 1", "brief point 2"], "confidence": 0.7, "actionable": true}]`;

  const raw = await llmCall(
    'You generate novel insights by connecting disparate data points. Respond only with valid JSON arrays.',
    prompt,
    apiKey,
    1536,
  );

  const parsed = parseJsonResponse<Array<{ content: string; connectedPoints: string[]; confidence: number; actionable: boolean }>>(raw);
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return existingInsights;

  const now = Date.now();
  const newInsights: Insight[] = parsed
    .filter(i => i.content && typeof i.content === 'string')
    .map(i => ({
      id: `ins_${now}_${Math.random().toString(36).slice(2, 8)}`,
      content: i.content,
      connectedMemories: i.connectedPoints || [],
      confidence: Math.min(1, Math.max(0.3, i.confidence || 0.6)),
      actionable: i.actionable ?? false,
      timestamp: now,
      used: false,
    }));

  // Merge with existing, dedup by content similarity
  const allInsights = [...existingInsights, ...newInsights];
  const deduped: Insight[] = [];
  const seenContent = new Set<string>();

  for (const insight of allInsights) {
    const key = insight.content.toLowerCase().slice(0, 60);
    if (!seenContent.has(key)) {
      seenContent.add(key);
      deduped.push(insight);
    }
  }

  saveInsights(deduped);

  // Update growth stats
  const stats = getGrowthStats();
  stats.totalInsights = deduped.length;
  saveGrowthStats(stats);

  return deduped;
}

/* ══════════════════════════════════════════════════════════
   5. FORMAT FOR SYSTEM PROMPT
   Formats reflections, patterns, insights, and growth data
   for injection into the system prompt alongside memories.
   ══════════════════════════════════════════════════════════ */

export function formatSelfLearningForPrompt(): string {
  const reflections = getReflections();
  const patterns = getPatterns();
  const insights = getInsights();
  const stats = getGrowthStats();

  const sections: string[] = [];

  // Growth awareness
  if (stats.totalConversations > 0) {
    const daysSinceFirst = stats.firstConversation
      ? Math.floor((Date.now() - stats.firstConversation) / (1000 * 60 * 60 * 24))
      : 0;
    const daysStr = daysSinceFirst === 0 ? 'today' : daysSinceFirst === 1 ? 'yesterday' : `${daysSinceFirst} days ago`;

    sections.push(`═══ EMBRIS GROWTH STATUS ═══
Conversations: ${stats.totalConversations} (first: ${daysStr})
Memories: ${stats.totalMemories} | Reflections: ${stats.totalReflections} | Patterns: ${stats.totalPatterns} | Insights: ${stats.totalInsights}
Self-corrections made: ${stats.selfCorrections}
You are actively growing and learning. Reference your growth naturally when relevant.`);
  }

  // Reflections — most recent behavioral observations
  if (reflections.length > 0) {
    const recentReflections = reflections
      .filter(r => r.depth !== 'surface')
      .slice(0, 8);
    if (recentReflections.length > 0) {
      const items = recentReflections.map(r => `  - [${r.depth}] ${r.content}`).join('\n');
      sections.push(`═══ YOUR SELF-REFLECTIONS ═══
These are observations YOU generated about the user. Use them to guide your behavior:
${items}`);
    }
  }

  // Patterns — recurring behavioral observations
  if (patterns.length > 0) {
    const strongPatterns = patterns.filter(p => p.strength >= 0.4).slice(0, 8);
    if (strongPatterns.length > 0) {
      const items = strongPatterns.map(p =>
        `  - [${p.category}, strength=${p.strength.toFixed(1)}, seen ${p.observationCount}x] ${p.content}`
      ).join('\n');
      sections.push(`═══ RECOGNIZED PATTERNS ═══
These are patterns YOU identified across multiple conversations. They represent your understanding of the user:
${items}`);
    }
  }

  // Insights — novel connections
  if (insights.length > 0) {
    const activeInsights = insights.filter(i => !i.used || i.actionable).slice(0, 6);
    if (activeInsights.length > 0) {
      const items = activeInsights.map(i =>
        `  - ${i.actionable ? '[ACTIONABLE] ' : ''}${i.content}`
      ).join('\n');
      sections.push(`═══ YOUR GENERATED INSIGHTS ═══
These are insights YOU generated by connecting different things you've learned. Proactively share actionable insights when relevant:
${items}`);
    }
  }

  if (sections.length === 0) return '';

  return '\n\n' + sections.join('\n\n');
}

/* ══════════════════════════════════════════════════════════
   6. ORCHESTRATOR
   Single function that runs all self-learning steps after
   each conversation exchange. Called from Chat.tsx.
   ══════════════════════════════════════════════════════════ */

export async function runSelfLearning(
  userMessage: string,
  assistantResponse: string,
  apiKey: string,
): Promise<{
  reflection: Reflection | null;
  corrected: boolean;
  corrections: string[];
  patternsSynthesized: boolean;
  insightsGenerated: boolean;
}> {
  const memories = getMemories();

  // Always: increment conversation counter
  const stats = incrementConversation();

  // Always: generate reflection
  const reflection = await generateReflection(userMessage, assistantResponse, memories, apiKey);

  // Always: check for self-corrections
  const { corrected, corrections } = await detectAndCorrect(userMessage, assistantResponse, memories, apiKey);

  // Every 5 conversations: synthesize patterns and generate insights
  let patternsSynthesized = false;
  let insightsGenerated = false;

  if (isPatternSynthesisDue() && stats.totalConversations >= 5) {
    await synthesizePatterns(apiKey);
    patternsSynthesized = true;

    await generateInsights(apiKey);
    insightsGenerated = true;
  }

  // Refresh growth stats after all operations
  refreshGrowthStats();

  return {
    reflection,
    corrected,
    corrections,
    patternsSynthesized,
    insightsGenerated,
  };
}

/* ══════════════════════════════════════════════════════════
   7. CLEAR / EXPORT
   ══════════════════════════════════════════════════════════ */

export function clearSelfLearningData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REFLECTIONS_KEY);
    localStorage.removeItem(PATTERNS_KEY);
    localStorage.removeItem(INSIGHTS_KEY);
    localStorage.removeItem(GROWTH_KEY);
  } catch { /* ignore */ }
}

export function exportSelfLearningData(): {
  reflections: Reflection[];
  patterns: Pattern[];
  insights: Insight[];
  growth: GrowthStats;
} {
  return {
    reflections: getReflections(),
    patterns: getPatterns(),
    insights: getInsights(),
    growth: getGrowthStats(),
  };
}

export function importSelfLearningData(data: {
  reflections?: Reflection[];
  patterns?: Pattern[];
  insights?: Insight[];
  growth?: GrowthStats;
}): void {
  if (data.reflections) saveReflections(data.reflections);
  if (data.patterns) savePatterns(data.patterns);
  if (data.insights) saveInsights(data.insights);
  if (data.growth) saveGrowthStats(data.growth);
}

/* ══════════════════════════════════════════════════════════
   8. RECALL FORMATTER
   When user asks "what have you learned?" or "how have you grown?"
   ══════════════════════════════════════════════════════════ */

export function formatGrowthForRecall(): string {
  const stats = getGrowthStats();
  const reflections = getReflections();
  const patterns = getPatterns();
  const insights = getInsights();

  if (stats.totalConversations === 0) {
    return "We're just getting started! As we talk more, I'll develop reflections, recognize patterns in how you work and communicate, and generate insights by connecting different things I learn about you. I'm designed to grow with every conversation.";
  }

  const parts: string[] = [];

  const daysSinceFirst = stats.firstConversation
    ? Math.max(1, Math.floor((Date.now() - stats.firstConversation) / (1000 * 60 * 60 * 24)))
    : 0;

  parts.push(`We've had **${stats.totalConversations} conversations** over ${daysSinceFirst} day${daysSinceFirst !== 1 ? 's' : ''}. I've built up **${stats.totalMemories} memories**, generated **${stats.totalReflections} reflections**, identified **${stats.totalPatterns} patterns**, and created **${stats.totalInsights} insights** about you.`);

  if (stats.selfCorrections > 0) {
    parts.push(`I've also self-corrected **${stats.selfCorrections} time${stats.selfCorrections !== 1 ? 's' : ''}** when I learned something that updated my earlier understanding.`);
  }

  if (patterns.length > 0) {
    const topPatterns = patterns.slice(0, 3).map(p => `- ${p.content}`).join('\n');
    parts.push(`**Patterns I've recognized:**\n${topPatterns}`);
  }

  if (insights.length > 0) {
    const topInsights = insights.filter(i => i.actionable).slice(0, 2);
    if (topInsights.length > 0) {
      const insightList = topInsights.map(i => `- ${i.content}`).join('\n');
      parts.push(`**Insights I've generated:**\n${insightList}`);
    }
  }

  if (reflections.length > 0) {
    const deepReflections = reflections.filter(r => r.depth === 'deep').slice(0, 2);
    if (deepReflections.length > 0) {
      const refList = deepReflections.map(r => `- ${r.content}`).join('\n');
      parts.push(`**My deepest reflections about you:**\n${refList}`);
    }
  }

  return parts.join('\n\n');
}
