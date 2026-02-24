# Embris Full System Audit

## AUDIT FINDINGS

### 1. memory.ts — ISSUES FOUND
- **AI extraction API URL hardcoded to manus proxy** — This uses `https://api.manus.im/api/llm-proxy/v1/chat/completions` which is the same as stream-chat.ts. Consistent, OK.
- **Content-Type is 'text/plain'** — Consistent with stream-chat.ts to avoid CORS. OK.
- **extractMemoriesWithAI takes apiKey param** — But Chat.tsx passes API_KEY from stream-chat.ts. OK.
- **deduplicateMemories** — Works but substring matching could be aggressive. OK for now.
- **getMemories() calls migrateLegacyMemories() on empty** — Could cause unnecessary writes. Minor.
- **ISSUE: Chat.tsx user message rendering** — In Chat.tsx line 579-582, user messages render as plain text while assistant messages use MarkdownText. This is actually correct UX.
- **OK overall** — Memory extraction, saving, loading, formatting all properly wired.

### 2. self-learning.ts — ISSUES FOUND
- **runSelfLearning orchestrator** — Properly called from Chat.tsx with 1500ms delay. OK.
- **isPatternSynthesisDue()** — Logic: `totalConversations - (patternSynthesisCount * 5) >= 5`. This works correctly.
- **generateReflection** — Saves reflections properly. OK.
- **detectAndCorrect** — Saves corrected memories and updates growth stats. OK.
- **synthesizePatterns** — Saves patterns and updates growth stats. OK.
- **generateInsights** — Saves insights and updates growth stats. OK.
- **formatSelfLearningForPrompt** — Properly formats all data. OK.
- **OK overall** — Well wired.

### 3. stream-chat.ts — ISSUES FOUND
- **buildSystemPrompt** — Properly includes ALL enhancement blocks. OK.
- **ISSUE: Token limit concern** — max_tokens is 32768 for response, but the system prompt could get very long with all blocks. The model context window should handle it, but we should be aware.
- **ISSUE: No prompt length management** — If a user has 200 memories + 100 reflections + 50 patterns + 50 insights + goals + summaries + contract data, the system prompt could exceed reasonable limits. Should add truncation.
- **OK overall** — Properly wired, but could benefit from prompt size management.

### 4. Chat.tsx — ISSUES FOUND
- **ISSUE: Race condition in onDone** — After regex extraction, AI extraction runs immediately, then self-learning at 1500ms, then goals at 2000ms. The AI extraction is async and could still be running when self-learning starts. However, they operate on different data stores, so this is actually fine.
- **ISSUE: handleClear clears EVERYTHING** — This clears all memories, self-learning, emotional data, sessions, goals, personality. This is very destructive. The "Clear" button should probably only clear chat history, not the entire brain. But this is a design choice, not a bug.
- **ISSUE: Session summary on clear** — generateSessionSummary runs before clear, which is good. But if it fails, clear still proceeds. OK.
- **ISSUE: No error boundary** — If any enhancement system throws, it could crash the chat. But all are wrapped in try/catch. OK.
- **OK overall** — Orchestration is correct.

### 5. emotional-intelligence.ts — OK
- analyzeMood is called synchronously before sending. OK.
- formatEmotionalContextForPrompt checks for recency (5 min) and confidence. OK.
- State is saved to localStorage. OK.

### 6. goal-tracking.ts — ISSUES FOUND
- **extractGoalsFromMessage** — Called with 2000ms delay. OK.
- **ISSUE: Goal extraction only gets userMessage, not assistantResponse** — The function signature takes userMessage and existingGoals. It doesn't see what Embris said about the goal. This is actually fine since goals come from user intent.
- **processGoalExtraction** — Properly adds new goals and processes updates. OK.
- **formatGoalsForPrompt** — Properly formats with stale warnings. OK.

### 7. personality-tuning.ts — OK
- applyPersonalityFeedback called synchronously before sending. OK.
- detectPersonalityFeedback properly detects adjustment commands. OK.
- formatPersonalityForPrompt properly generates instructions. OK.
- Settings persist in localStorage. OK.

### 8. conversation-summaries.ts — OK
- updateCurrentSession called on each message. OK.
- generateSessionSummary called before clear. OK.
- formatSessionSummariesForPrompt shows last 5 sessions. OK.

### 9. localStorage Keys — AUDIT
All keys used across the system:
- `embris_memories_v2` (memory.ts)
- `ember_memories` (memory.ts - legacy)
- `ember_chat_history` (memory.ts)
- `embris_reflections_v1` (self-learning.ts)
- `embris_patterns_v1` (self-learning.ts)
- `embris_insights_v1` (self-learning.ts)
- `embris_growth_v1` (self-learning.ts)
- `embris_emotional_state_v1` (emotional-intelligence.ts)
- `embris_emotional_history_v1` (emotional-intelligence.ts)
- `embris_goals_v1` (goal-tracking.ts)
- `embris_personality_v1` (personality-tuning.ts)
- `embris_session_summaries_v1` (conversation-summaries.ts)
- `embris_current_session_v1` (conversation-summaries.ts)
- `embris_last_suggestion_time` (proactive-suggestions.ts)
- `vaultfire_wallet_pk` (wallet.ts)
- `vaultfire_wallet_mnemonic` (wallet.ts)
- `vaultfire_wallet_address` (wallet.ts)
- `vaultfire_wallet_created` (wallet.ts)

**No conflicts found.** All keys are unique and consistently named.

### 10. CRITICAL ISSUES TO FIX
1. **Prompt size management** — Need to add truncation to prevent system prompt from exceeding model limits
2. **handleClear is too destructive** — Should separate "clear chat" from "reset brain"
3. **No session summary generation on natural session end** — Only generates on clear, not on page close/refresh

### 11. THINGS THAT WORK CORRECTLY
- Memory extraction (regex + AI) ✓
- Memory deduplication ✓
- Memory formatting for prompt ✓
- Self-learning orchestration ✓
- Reflection generation ✓
- Pattern synthesis timing ✓
- Insight generation ✓
- Self-correction ✓
- Growth tracking ✓
- Mood detection ✓
- Emotional context in prompt ✓
- Goal extraction ✓
- Goal tracking ✓
- Personality detection ✓
- Personality persistence ✓
- Session tracking ✓
- Session summaries ✓
- Proactive suggestions context ✓
- Contract knowledge base ✓
- Export/import ✓
