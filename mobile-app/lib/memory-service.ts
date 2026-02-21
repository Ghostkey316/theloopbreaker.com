import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Memory Types ────────────────────────────────────────────────
export type MemoryCategory =
  | "user_profile"
  | "preference"
  | "context"
  | "interaction"
  | "trust_cache"
  | "milestone";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  source: "conversation" | "on_chain" | "system";
  timestamp: number;
  pinned: boolean;
}

export interface GrowthMetrics {
  firstUseDate: number;
  totalConversations: number;
  totalMessages: number;
  topicsAskedAbout: Record<string, number>;
  milestones: {
    firstChat: boolean;
    firstTrustLookup: boolean;
    firstBondCreated: boolean;
    firstRevoke: boolean;
    tenConversations: boolean;
    fiftyConversations: boolean;
  };
}

// ─── Storage Keys ────────────────────────────────────────────────
const MEMORY_KEY = "@embris_memory";
const GROWTH_KEY = "@embris_growth";
const MAX_MEMORIES = 50;

// ─── MemoryService ───────────────────────────────────────────────
class MemoryService {
  private memories: MemoryItem[] = [];
  private growth: GrowthMetrics | null = null;
  private loaded = false;

  // ── Load ─────────────────────────────────────────────────────
  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(MEMORY_KEY);
      this.memories = raw ? JSON.parse(raw) : [];
      const gRaw = await AsyncStorage.getItem(GROWTH_KEY);
      this.growth = gRaw ? JSON.parse(gRaw) : this.defaultGrowth();
      this.loaded = true;
    } catch {
      this.memories = [];
      this.growth = this.defaultGrowth();
      this.loaded = true;
    }
  }

  private defaultGrowth(): GrowthMetrics {
    return {
      firstUseDate: Date.now(),
      totalConversations: 0,
      totalMessages: 0,
      topicsAskedAbout: {},
      milestones: {
        firstChat: false,
        firstTrustLookup: false,
        firstBondCreated: false,
        firstRevoke: false,
        tenConversations: false,
        fiftyConversations: false,
      },
    };
  }

  // ── Persist ──────────────────────────────────────────────────
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(this.memories));
      if (this.growth) {
        await AsyncStorage.setItem(GROWTH_KEY, JSON.stringify(this.growth));
      }
    } catch {
      // silently fail — privacy first, no crash
    }
  }

  // ── Add Memory ───────────────────────────────────────────────
  async addMemory(
    category: MemoryCategory,
    key: string,
    value: string,
    source: MemoryItem["source"] = "conversation"
  ): Promise<MemoryItem> {
    await this.load();

    // Check for existing memory with same key — update instead of duplicate
    const existingIdx = this.memories.findIndex(
      (m) => m.category === category && m.key === key
    );
    const item: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      key,
      value,
      source,
      timestamp: Date.now(),
      pinned: false,
    };

    if (existingIdx >= 0) {
      // Update existing memory
      item.id = this.memories[existingIdx].id;
      item.pinned = this.memories[existingIdx].pinned;
      this.memories[existingIdx] = item;
    } else {
      // Enforce cap — remove oldest unpinned if at limit
      if (this.memories.length >= MAX_MEMORIES) {
        const unpinnedIdx = this.memories.findIndex((m) => !m.pinned);
        if (unpinnedIdx >= 0) {
          this.memories.splice(unpinnedIdx, 1);
        }
      }
      this.memories.push(item);
    }

    await this.save();
    return item;
  }

  // ── Get Memories ─────────────────────────────────────────────
  async getAll(): Promise<MemoryItem[]> {
    await this.load();
    return [...this.memories];
  }

  async getByCategory(category: MemoryCategory): Promise<MemoryItem[]> {
    await this.load();
    return this.memories.filter((m) => m.category === category);
  }

  getCount(): number {
    return this.memories.length;
  }

  // ── Delete Memory ────────────────────────────────────────────
  async deleteMemory(id: string): Promise<void> {
    await this.load();
    this.memories = this.memories.filter((m) => m.id !== id);
    await this.save();
  }

  async clearAll(): Promise<void> {
    this.memories = [];
    this.growth = this.defaultGrowth();
    await this.save();
  }

  // ── Pin/Unpin ────────────────────────────────────────────────
  async togglePin(id: string): Promise<void> {
    await this.load();
    const mem = this.memories.find((m) => m.id === id);
    if (mem) {
      mem.pinned = !mem.pinned;
      await this.save();
    }
  }

  // ── Growth Metrics ───────────────────────────────────────────
  async getGrowth(): Promise<GrowthMetrics> {
    await this.load();
    return this.growth || this.defaultGrowth();
  }

  async recordConversation(): Promise<void> {
    await this.load();
    if (!this.growth) this.growth = this.defaultGrowth();
    this.growth.totalConversations += 1;
    if (!this.growth.milestones.firstChat) {
      this.growth.milestones.firstChat = true;
    }
    if (this.growth.totalConversations >= 10) {
      this.growth.milestones.tenConversations = true;
    }
    if (this.growth.totalConversations >= 50) {
      this.growth.milestones.fiftyConversations = true;
    }
    await this.save();
  }

  async recordMessage(): Promise<void> {
    await this.load();
    if (!this.growth) this.growth = this.defaultGrowth();
    this.growth.totalMessages += 1;
    await this.save();
  }

  async recordTopic(topic: string): Promise<void> {
    await this.load();
    if (!this.growth) this.growth = this.defaultGrowth();
    this.growth.topicsAskedAbout[topic] =
      (this.growth.topicsAskedAbout[topic] || 0) + 1;
    await this.save();
  }

  async recordMilestone(
    milestone: keyof GrowthMetrics["milestones"]
  ): Promise<void> {
    await this.load();
    if (!this.growth) this.growth = this.defaultGrowth();
    this.growth.milestones[milestone] = true;
    await this.save();
  }

  // ── Build System Prompt Context ──────────────────────────────
  async buildMemoryContext(): Promise<string> {
    await this.load();
    if (this.memories.length === 0 && !this.growth) {
      return "";
    }

    const lines: string[] = [];
    lines.push("\n--- EMBRIS'S MEMORY (stored locally on user's device) ---");

    // User profile
    const profile = this.memories.filter((m) => m.category === "user_profile");
    if (profile.length > 0) {
      lines.push("\nAbout the user:");
      profile.forEach((m) => lines.push(`- ${m.key}: ${m.value}`));
    }

    // Preferences
    const prefs = this.memories.filter((m) => m.category === "preference");
    if (prefs.length > 0) {
      lines.push("\nUser preferences:");
      prefs.forEach((m) => lines.push(`- ${m.key}: ${m.value}`));
    }

    // Context from conversations
    const context = this.memories.filter((m) => m.category === "context");
    if (context.length > 0) {
      lines.push("\nThings the user has shared:");
      context.forEach((m) => lines.push(`- ${m.value}`));
    }

    // Trust cache
    const trust = this.memories.filter((m) => m.category === "trust_cache");
    if (trust.length > 0) {
      lines.push("\nCached trust profile:");
      trust.forEach((m) => lines.push(`- ${m.key}: ${m.value}`));
    }

    // Growth metrics
    if (this.growth) {
      const daysSinceFirst = Math.floor(
        (Date.now() - this.growth.firstUseDate) / (1000 * 60 * 60 * 24)
      );
      lines.push(`\nRelationship: ${daysSinceFirst} day(s) together`);
      lines.push(`Conversations: ${this.growth.totalConversations}`);
      lines.push(`Messages exchanged: ${this.growth.totalMessages}`);

      // Top topics
      const topics = Object.entries(this.growth.topicsAskedAbout)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (topics.length > 0) {
        lines.push(
          `Favorite topics: ${topics.map(([t, c]) => `${t} (${c}x)`).join(", ")}`
        );
      }

      // Milestones
      const achieved = Object.entries(this.growth.milestones)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (achieved.length > 0) {
        lines.push(`Milestones achieved: ${achieved.join(", ")}`);
      }
    }

    lines.push(
      "\nUse these memories naturally in conversation. Reference them when relevant, but don't list them all at once. Be warm and personal."
    );
    lines.push("--- END MEMORY ---\n");

    return lines.join("\n");
  }
}

// Singleton instance
export const memoryService = new MemoryService();

// ─── Memory Extraction ─────────────────────────────────────────
// Parse a conversation exchange and extract memories
export interface ExtractedMemory {
  category: MemoryCategory;
  key: string;
  value: string;
}

export function extractMemoriesLocally(
  userMessage: string,
  assistantMessage: string
): ExtractedMemory[] {
  const extracted: ExtractedMemory[] = [];
  const lower = userMessage.toLowerCase();

  // Name detection
  const namePatterns = [
    /my name is (\w+)/i,
    /i'm (\w+)/i,
    /call me (\w+)/i,
    /i go by (\w+)/i,
    /name's (\w+)/i,
  ];
  for (const pat of namePatterns) {
    const match = userMessage.match(pat);
    if (match && match[1].length > 1 && match[1].length < 20) {
      extracted.push({
        category: "user_profile",
        key: "name",
        value: match[1],
      });
      break;
    }
  }

  // Interest/topic detection
  const interestPatterns = [
    /i(?:'m| am) interested in (.+?)(?:\.|$)/i,
    /i care (?:deeply )?about (.+?)(?:\.|$)/i,
    /i love (.+?)(?:\.|$)/i,
    /i(?:'m| am) passionate about (.+?)(?:\.|$)/i,
    /i(?:'m| am) into (.+?)(?:\.|$)/i,
  ];
  for (const pat of interestPatterns) {
    const match = userMessage.match(pat);
    if (match) {
      extracted.push({
        category: "context",
        key: "interest",
        value: `User is interested in ${match[1].trim()}`,
      });
      break;
    }
  }

  // Risk tolerance
  if (
    lower.includes("conservative") &&
    (lower.includes("risk") || lower.includes("invest"))
  ) {
    extracted.push({
      category: "preference",
      key: "risk_tolerance",
      value: "conservative",
    });
  } else if (
    lower.includes("aggressive") &&
    (lower.includes("risk") || lower.includes("invest"))
  ) {
    extracted.push({
      category: "preference",
      key: "risk_tolerance",
      value: "aggressive",
    });
  }

  // Chain preference
  if (lower.includes("prefer base") || lower.includes("i use base")) {
    extracted.push({
      category: "preference",
      key: "preferred_chain",
      value: "Base",
    });
  } else if (
    lower.includes("prefer avalanche") ||
    lower.includes("i use avalanche") ||
    lower.includes("prefer avax")
  ) {
    extracted.push({
      category: "preference",
      key: "preferred_chain",
      value: "Avalanche",
    });
  }

  // Competition / event context
  if (
    lower.includes("competition") ||
    lower.includes("hackathon") ||
    lower.includes("build games")
  ) {
    extracted.push({
      category: "context",
      key: "event",
      value: `User mentioned participating in a competition/hackathon`,
    });
  }

  // Wallet mention
  const walletMatch = userMessage.match(/0x[a-fA-F0-9]{40}/);
  if (walletMatch) {
    extracted.push({
      category: "user_profile",
      key: "mentioned_wallet",
      value: walletMatch[0],
    });
  }

  // Topic classification for growth metrics
  const topicKeywords: Record<string, string[]> = {
    "ai_ethics": ["ai ethics", "ethical ai", "responsible ai", "ai safety"],
    "defi": ["defi", "yield", "liquidity", "swap", "amm"],
    "security": ["security", "hack", "exploit", "vulnerability", "audit"],
    "trust": ["trust", "reputation", "identity", "verification"],
    "bonds": ["bond", "partnership", "accountability"],
    "privacy": ["privacy", "surveillance", "tracking", "data"],
    "governance": ["governance", "vote", "proposal", "dao"],
    "web3": ["web3", "blockchain", "crypto", "decentralized"],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      extracted.push({
        category: "interaction",
        key: `topic_${topic}`,
        value: topic,
      });
    }
  }

  // Detect if Embris said "I'll remember that"
  if (
    assistantMessage.toLowerCase().includes("remember that") ||
    assistantMessage.toLowerCase().includes("i'll keep that in mind") ||
    assistantMessage.toLowerCase().includes("noted")
  ) {
    // The assistant acknowledged remembering — good signal
  }

  return extracted;
}
