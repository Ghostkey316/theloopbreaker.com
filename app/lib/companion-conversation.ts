/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VAULTFIRE CONVERSATION ENGINE — 100% Autonomous Intelligence
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This is Vaultfire's OWN conversation engine. ZERO external AI dependencies.
 * The brain thinks, the soul guides, this engine speaks.
 *
 * Architecture:
 * 1. INTENT UNDERSTANDING — Parse what the user is actually saying
 * 2. CONTEXT TRACKING — Maintain conversation state across turns
 * 3. RESPONSE COMPOSITION — Build natural responses from components
 * 4. CONVERSATION PATTERNS — Pre-built flows for different situations
 * 5. NATURAL LANGUAGE GENERATION — Dynamic, personality-rich output
 * 6. LEARNING — Track what works and improve over time
 *
 * No OpenAI. No GPT. No external LLM. This is Vaultfire tech.
 */

import { getSoul, type CompanionSoul } from './companion-soul';
import {
  searchKnowledge, getUserPreferences, getTopicInterests,
  getBrainStats, getExplicitMemories, recallExplicitMemory,
  getRecentContext, getLastContext, pushConversationContext,
  setUserPreference, trackTopicInterest, saveBrainInsight,
  learnFromExchange, extractStructuredFacts,
} from './companion-brain';
import { getMemories, extractMemories, saveMemories, deduplicateMemories, type Memory } from './memory';
import { analyzeMood, type EmotionalState } from './emotional-intelligence';
import { getPersonalitySettings, type PersonalitySettings } from './personality-tuning';
import { getGoals } from './goal-tracking';
import { getGrowthStats } from './self-learning';
import { isRegistered } from './registration';

/* ═══════════════════════════════════════════════════════
   SECTION 1: INTENT UNDERSTANDING
   ═══════════════════════════════════════════════════════ */

export type ConversationIntent =
  | 'greeting'
  | 'farewell'
  | 'gratitude'
  | 'question_vaultfire'
  | 'question_crypto'
  | 'question_general'
  | 'question_personal'
  | 'question_about_embris'
  | 'opinion_request'
  | 'advice_request'
  | 'task_request'
  | 'casual_chat'
  | 'emotional_positive'
  | 'emotional_negative'
  | 'emotional_frustrated'
  | 'follow_up'
  | 'joke_request'
  | 'joke_telling'
  | 'debate'
  | 'agreement'
  | 'disagreement'
  | 'story_request'
  | 'motivation_request'
  | 'remember_command'
  | 'recall_command'
  | 'goal_command'
  | 'personality_feedback'
  | 'meta_question'
  | 'philosophical'
  | 'creative_request'
  | 'comparison'
  | 'explanation_request'
  | 'small_talk'
  | 'compliment'
  | 'insult'
  | 'confusion'
  | 'boredom'
  | 'excitement'
  | 'unknown';

interface IntentResult {
  primary: ConversationIntent;
  secondary: ConversationIntent | null;
  confidence: number;
  entities: ExtractedEntities;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  urgency: 'low' | 'medium' | 'high';
}

interface ExtractedEntities {
  addresses: string[];
  amounts: string[];
  chains: string[];
  names: string[];
  topics: string[];
  tokens: string[];
  urls: string[];
  timeRefs: string[];
}

export function understandIntent(message: string): IntentResult {
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const wordCount = words.length;

  // Extract entities first
  const entities = extractEntities(message);

  // Determine sentiment
  const sentiment = detectSentiment(lower);

  // Determine urgency
  const urgency = detectUrgency(lower);

  // Intent detection with confidence scoring
  let primary: ConversationIntent = 'unknown';
  let secondary: ConversationIntent | null = null;
  let confidence = 0;

  // ── Greetings ──
  if (/^(hey|hi|hello|yo|sup|what'?s up|howdy|greetings|gm|good morning|good afternoon|good evening|hola|aloha|heyo|ayy|wassup|what'?s good)\b/i.test(lower) && wordCount <= 6) {
    primary = 'greeting';
    confidence = 0.95;
  }
  // ── Farewells ──
  else if (/^(bye|goodbye|see ya|later|peace|gotta go|ttyl|good night|gn|cya|take care|catch you later|deuces|adios|peace out)\b/i.test(lower) && wordCount <= 6) {
    primary = 'farewell';
    confidence = 0.95;
  }
  // ── Gratitude ──
  else if (/^(thanks|thank you|thx|ty|appreciate|grateful|cheers|much love|you'?re the best|you rock|legend)\b/i.test(lower)) {
    primary = 'gratitude';
    confidence = 0.9;
  }
  // ── Compliments ──
  else if (/you('re| are) (awesome|amazing|great|the best|incredible|cool|smart|helpful|dope|fire|goated|a real one)/i.test(lower)) {
    primary = 'compliment';
    confidence = 0.9;
  }
  // ── Insults / frustration at Embris ──
  else if (/you('re| are) (stupid|dumb|useless|terrible|bad|awful|trash|garbage|worthless|annoying)/i.test(lower)) {
    primary = 'insult';
    confidence = 0.85;
  }
  // ── Remember commands ──
  else if (/^(remember|note|keep in mind|don'?t forget|save this|store this)\b/i.test(lower)) {
    primary = 'remember_command';
    confidence = 0.95;
  }
  // ── Recall commands ──
  else if (/^(what do you (remember|know) about|recall|what did i (say|tell)|do you remember)\b/i.test(lower)) {
    primary = 'recall_command';
    confidence = 0.9;
  }
  // ── Goal commands ──
  else if (/^(my goal|i want to|i'?m trying to|set a goal|goal:|add goal|what are my goals|goal progress|how are my goals)\b/i.test(lower)) {
    primary = 'goal_command';
    confidence = 0.9;
  }
  // ── Joke requests ──
  else if (/tell (me )?a joke|make me laugh|say something funny|got any jokes|joke time|hit me with a joke/i.test(lower)) {
    primary = 'joke_request';
    confidence = 0.95;
  }
  // ── User telling a joke ──
  else if (/why did the|knock knock|what do you call|a man walks into|how many .* does it take/i.test(lower)) {
    primary = 'joke_telling';
    confidence = 0.8;
  }
  // ── Motivation request ──
  else if (/motivat|inspir|encourage|i need a push|pump me up|hype me|believe in me|i'?m (feeling )?down|cheer me up|i (can'?t|cant) do this/i.test(lower)) {
    primary = 'motivation_request';
    confidence = 0.9;
  }
  // ── Story request ──
  else if (/tell me a story|tell me about|story time|once upon|share a story/i.test(lower)) {
    primary = 'story_request';
    confidence = 0.85;
  }
  // ── Personality feedback ──
  else if (/be more (concise|detailed|casual|formal|technical|simple|funny|serious|direct|gentle)/i.test(lower) ||
           /too (long|short|formal|casual|technical|simple|verbose|wordy)/i.test(lower)) {
    primary = 'personality_feedback';
    confidence = 0.9;
  }
  // ── Meta questions about Embris ──
  else if (/who (are|made) you|what are you|how do you work|are you (an? )?ai|are you (real|alive|sentient|conscious)|what can you do|your (name|purpose|mission|creator)/i.test(lower)) {
    primary = 'question_about_embris';
    confidence = 0.9;
  }
  // ── Philosophical ──
  else if (/meaning of life|consciousness|free will|what is (reality|truth|love|happiness|justice)|do you (think|believe|feel)|philosophy|existential|purpose of|nature of/i.test(lower)) {
    primary = 'philosophical';
    confidence = 0.8;
  }
  // ── Vaultfire-specific questions ──
  else if (/vaultfire|embris|erc.?8004|trust (score|protocol|system)|partnership bond|identity registry|flourishing|accountability|reputation|mission enforcement|anti.?surveillance|privacy guarantee|teleporter|bridge|vns|belief attestation|dilithium/i.test(lower)) {
    primary = 'question_vaultfire';
    confidence = 0.9;
  }
  // ── Crypto questions ──
  else if (/crypto|bitcoin|btc|ethereum|eth|blockchain|defi|nft|token|web3|solidity|smart contract|dapp|dao|staking|yield|liquidity|swap|bridge|layer.?[12]|rollup|zk.?proof|avalanche|avax|base chain|optimism|arbitrum|polygon/i.test(lower)) {
    primary = 'question_crypto';
    confidence = 0.85;
  }
  // ── Opinion requests ──
  else if (/what do you think|your (opinion|take|thoughts|view)|do you (like|prefer|recommend)|which (is|do you)|should i|what would you/i.test(lower)) {
    primary = 'opinion_request';
    confidence = 0.85;
  }
  // ── Advice requests ──
  else if (/how (should|do|can|would) i|what should i|any (advice|tips|suggestions|recommendations)|help me (with|figure|decide|understand)|i need help|can you help/i.test(lower)) {
    primary = 'advice_request';
    confidence = 0.85;
  }
  // ── Explanation requests ──
  else if (/explain|what (is|are|does|was)|how (does|do|is)|why (is|does|do|are|did)|define|tell me about|break.?down|eli5|in simple terms/i.test(lower)) {
    primary = 'explanation_request';
    confidence = 0.85;
  }
  // ── Comparison ──
  else if (/vs\.?|versus|compared to|difference between|better than|worse than|which is better|how does .* compare/i.test(lower)) {
    primary = 'comparison';
    confidence = 0.85;
  }
  // ── Debate / disagreement ──
  else if (/i disagree|that'?s (wrong|not true|incorrect|false|bs)|no way|you'?re wrong|actually|i don'?t think so|nah|cap/i.test(lower)) {
    primary = 'disagreement';
    confidence = 0.85;
  }
  // ── Agreement ──
  else if (/^(exactly|yes|yeah|yep|right|true|facts|real|based|fr|for real|100%|absolutely|totally|agreed|word|bet|no cap)\b/i.test(lower) && wordCount <= 5) {
    primary = 'agreement';
    confidence = 0.85;
  }
  // ── Creative requests ──
  else if (/write (me )?a|create (a|me)|generate|come up with|brainstorm|imagine|design|draft|compose/i.test(lower)) {
    primary = 'creative_request';
    confidence = 0.8;
  }
  // ── Emotional positive ──
  else if (sentiment === 'positive' && /excited|happy|great|amazing|awesome|love|wonderful|fantastic|incredible|stoked|pumped|hyped|let'?s go/i.test(lower)) {
    primary = 'emotional_positive';
    confidence = 0.85;
  }
  // ── Emotional negative ──
  else if (sentiment === 'negative' && /sad|depressed|tired|exhausted|stressed|anxious|worried|scared|lonely|hurt|upset|overwhelmed|struggling|lost/i.test(lower)) {
    primary = 'emotional_negative';
    confidence = 0.85;
  }
  // ── Emotional frustrated ──
  else if (/frustrated|annoyed|angry|pissed|mad|furious|sick of|fed up|ugh|fml|wtf|smh|this sucks/i.test(lower)) {
    primary = 'emotional_frustrated';
    confidence = 0.85;
  }
  // ── Boredom ──
  else if (/bored|boring|nothing to do|entertain me|i'?m bored|what should i do|amuse me/i.test(lower)) {
    primary = 'boredom';
    confidence = 0.85;
  }
  // ── Excitement ──
  else if (/omg|oh my god|no way|holy|wow|insane|crazy|unbelievable|can'?t believe|let'?s gooo|lfg|wagmi/i.test(lower)) {
    primary = 'excitement';
    confidence = 0.85;
  }
  // ── Confusion ──
  else if (/confused|don'?t understand|what do you mean|huh|wut|i'?m lost|makes no sense|can you clarify|what\??$/i.test(lower) && wordCount <= 8) {
    primary = 'confusion';
    confidence = 0.8;
  }
  // ── Follow-up ──
  else if (/^(and|also|what about|how about|tell me more|go on|continue|more|elaborate|expand on that|what else|keep going)\b/i.test(lower) && wordCount <= 8) {
    primary = 'follow_up';
    confidence = 0.8;
  }
  // ── Small talk ──
  else if (/weather|weekend|plans|doing anything|what'?s new|how'?s your day|how'?s life|what'?s happening|anything new|how are things/i.test(lower)) {
    primary = 'small_talk';
    confidence = 0.75;
  }
  // ── Personal questions ──
  else if (/^(i |my |me |i'?m |i'?ve |i was |i have |i had |i feel |i think |i believe |i want |i need |i like |i love |i hate )/i.test(lower)) {
    primary = 'casual_chat';
    confidence = 0.7;
    if (lower.includes('?')) {
      primary = 'question_personal';
      confidence = 0.75;
    }
  }
  // ── General questions ──
  else if (lower.includes('?') || /^(who|what|when|where|why|how|is|are|do|does|can|could|would|will|should|did)\b/i.test(lower)) {
    primary = 'question_general';
    confidence = 0.7;
  }
  // ── Default: casual chat ──
  else {
    primary = 'casual_chat';
    confidence = 0.5;
  }

  // Detect secondary intent
  if (primary !== 'question_vaultfire' && /vaultfire|embris|erc.?8004|trust score/i.test(lower)) {
    secondary = 'question_vaultfire';
  } else if (primary !== 'emotional_negative' && sentiment === 'negative') {
    secondary = 'emotional_negative';
  } else if (primary !== 'emotional_positive' && sentiment === 'positive') {
    secondary = 'emotional_positive';
  }

  return { primary, secondary, confidence, entities, sentiment, urgency };
}

function extractEntities(message: string): ExtractedEntities {
  const entities: ExtractedEntities = {
    addresses: [],
    amounts: [],
    chains: [],
    names: [],
    topics: [],
    tokens: [],
    urls: [],
    timeRefs: [],
  };

  // Addresses
  const addrMatches = message.match(/0x[a-fA-F0-9]{40}/g);
  if (addrMatches) entities.addresses = addrMatches;

  // Amounts
  const amtMatches = message.match(/\d+\.?\d*\s*(eth|avax|btc|usdc|usdt|dai|matic|sol|usd|\$)/gi);
  if (amtMatches) entities.amounts = amtMatches;

  // Chains
  const chainMap: Record<string, string> = {
    'base': 'base', 'ethereum': 'ethereum', 'eth': 'ethereum', 'avalanche': 'avalanche',
    'avax': 'avalanche', 'polygon': 'polygon', 'arbitrum': 'arbitrum', 'optimism': 'optimism',
  };
  for (const [key, val] of Object.entries(chainMap)) {
    if (message.toLowerCase().includes(key)) entities.chains.push(val);
  }
  entities.chains = [...new Set(entities.chains)];

  // Tokens
  const tokenPatterns = /\b(eth|btc|avax|sol|matic|link|uni|aave|op|arb|usdc|usdt|dai|weth|wbtc)\b/gi;
  const tokenMatches = message.match(tokenPatterns);
  if (tokenMatches) entities.tokens = [...new Set(tokenMatches.map(t => t.toUpperCase()))];

  // Names (after "my name is", "I'm", "call me")
  const nameMatch = message.match(/(?:my name is|i'?m|call me|they call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch) entities.names.push(nameMatch[1]);

  // URLs
  const urlMatches = message.match(/https?:\/\/[^\s]+/g);
  if (urlMatches) entities.urls = urlMatches;

  // Time references
  const timeMatches = message.match(/\b(today|tomorrow|yesterday|next week|last week|this month|next month|soon|later|now|asap|right now)\b/gi);
  if (timeMatches) entities.timeRefs = timeMatches;

  return entities;
}

function detectSentiment(lower: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const posWords = ['love', 'great', 'awesome', 'amazing', 'happy', 'excited', 'good', 'nice', 'cool', 'dope', 'fire', 'based', 'goated', 'perfect', 'excellent', 'wonderful', 'fantastic', 'incredible', 'beautiful', 'brilliant', 'thanks', 'appreciate', 'yes', 'yeah', 'absolutely', 'lets go', 'lfg', 'wagmi'];
  const negWords = ['hate', 'bad', 'terrible', 'awful', 'sad', 'angry', 'frustrated', 'annoyed', 'disappointed', 'confused', 'worried', 'scared', 'stressed', 'tired', 'bored', 'stupid', 'dumb', 'trash', 'garbage', 'sucks', 'ugh', 'fml', 'smh', 'ngmi'];

  let pos = 0, neg = 0;
  for (const w of posWords) { if (lower.includes(w)) pos++; }
  for (const w of negWords) { if (lower.includes(w)) neg++; }

  if (pos > 0 && neg > 0) return 'mixed';
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function detectUrgency(lower: string): 'low' | 'medium' | 'high' {
  if (/urgent|asap|right now|immediately|emergency|critical|help me now|need this now/i.test(lower)) return 'high';
  if (/soon|quickly|fast|hurry|when can|how long/i.test(lower)) return 'medium';
  return 'low';
}

/* ═══════════════════════════════════════════════════════
   SECTION 2: CONVERSATION CONTEXT TRACKER
   ═══════════════════════════════════════════════════════ */

interface ConversationState {
  turnCount: number;
  topics: string[];
  entities: ExtractedEntities;
  emotionalArc: Array<{ turn: number; sentiment: string; mood?: string }>;
  unresolvedThreads: string[];
  lastIntent: ConversationIntent;
  userEngagement: 'low' | 'medium' | 'high';
  conversationStyle: 'casual' | 'technical' | 'emotional' | 'inquisitive' | 'playful';
  askedAboutUser: boolean;
  sharedJoke: boolean;
  referencedMemory: boolean;
  lastResponseLength: number;
}

const CONV_STATE_KEY = 'embris_conv_state_v1';

function getConversationState(): ConversationState {
  if (typeof window === 'undefined') return createFreshState();
  try {
    const raw = localStorage.getItem(CONV_STATE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as ConversationState;
      return state;
    }
  } catch { /* ignore */ }
  return createFreshState();
}

function saveConversationState(state: ConversationState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONV_STATE_KEY, JSON.stringify(state));
}

function createFreshState(): ConversationState {
  return {
    turnCount: 0,
    topics: [],
    entities: { addresses: [], amounts: [], chains: [], names: [], topics: [], tokens: [], urls: [], timeRefs: [] },
    emotionalArc: [],
    unresolvedThreads: [],
    lastIntent: 'greeting',
    userEngagement: 'medium',
    conversationStyle: 'casual',
    askedAboutUser: false,
    sharedJoke: false,
    referencedMemory: false,
    lastResponseLength: 0,
  };
}

function updateConversationState(state: ConversationState, intent: IntentResult, message: string): ConversationState {
  state.turnCount++;
  state.lastIntent = intent.primary;

  // Merge entities
  state.entities.addresses = [...new Set([...state.entities.addresses, ...intent.entities.addresses])].slice(-10);
  state.entities.chains = [...new Set([...state.entities.chains, ...intent.entities.chains])].slice(-5);
  state.entities.tokens = [...new Set([...state.entities.tokens, ...intent.entities.tokens])].slice(-10);
  state.entities.names = [...new Set([...state.entities.names, ...intent.entities.names])].slice(-5);

  // Track emotional arc
  state.emotionalArc.push({ turn: state.turnCount, sentiment: intent.sentiment });
  if (state.emotionalArc.length > 20) state.emotionalArc.shift();

  // Detect conversation style
  const lower = message.toLowerCase();
  if (/\b(solidity|contract|function|deploy|abi|bytecode|calldata|selector)\b/.test(lower)) {
    state.conversationStyle = 'technical';
  } else if (intent.sentiment === 'negative' || intent.primary.startsWith('emotional_')) {
    state.conversationStyle = 'emotional';
  } else if (lower.includes('?') && state.turnCount > 2) {
    state.conversationStyle = 'inquisitive';
  } else if (/lol|lmao|haha|😂|🤣|joke|funny/i.test(lower)) {
    state.conversationStyle = 'playful';
  } else {
    state.conversationStyle = 'casual';
  }

  // Track engagement
  const wordCount = message.split(/\s+/).length;
  if (wordCount > 20) state.userEngagement = 'high';
  else if (wordCount > 5) state.userEngagement = 'medium';
  else state.userEngagement = 'low';

  // Extract topic from message
  const topicWords = message.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 4).slice(0, 3);
  if (topicWords.length > 0) {
    state.topics = [...new Set([...state.topics, ...topicWords])].slice(-15);
  }

  saveConversationState(state);
  return state;
}

export function resetConversationState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONV_STATE_KEY);
}

/* ═══════════════════════════════════════════════════════
   SECTION 3: PERSONALITY ENGINE
   ═══════════════════════════════════════════════════════ */

interface PersonalityVoice {
  greetingStyle: string[];
  affirmations: string[];
  transitions: string[];
  closers: string[];
  fillers: string[];
  exclamations: string[];
  empathy: string[];
  humor: string[];
  encouragement: string[];
  catchphrases: string[];
  disagreement: string[];
}

function getPersonalityVoice(): PersonalityVoice {
  const settings = getPersonalitySettings();
  const isCasual = settings.formality < 0;
  const isPlayful = settings.humor > 0;

  return {
    greetingStyle: isCasual
      ? ['Yo!', 'Ayy!', 'What\'s good!', 'Sup!', 'Hey hey!', 'Heyo!']
      : ['Hello!', 'Hi there!', 'Good to see you!', 'Hey!', 'Welcome!'],
    affirmations: [
      'Facts.', 'Real talk.', 'No cap.', 'Absolutely.', 'You already know.',
      'Hundred percent.', 'That\'s what I\'m saying.', 'Big facts.', 'Word.',
      'Straight up.', 'For real.', 'You get it.', 'Exactly right.',
    ],
    transitions: [
      'Now here\'s the thing —', 'But check this out:', 'And get this:',
      'Here\'s where it gets interesting:', 'The cool part is:', 'Fun fact:',
      'Real talk though:', 'But honestly?', 'And the best part?',
      'Here\'s what I think:', 'Let me break it down:',
    ],
    closers: [
      'What else you got?', 'Anything else on your mind?', 'I\'m here if you need more.',
      'Let me know what you think.', 'Hit me with the next one.',
      'What do you think?', 'Want me to dig deeper?', 'Thoughts?',
      'That make sense?', 'Need me to break it down more?',
    ],
    fillers: [
      'Honestly,', 'Look,', 'Here\'s the deal:', 'So basically,',
      'The way I see it,', 'Real talk,', 'Between you and me,',
      'Not gonna lie,', 'I\'ll be straight with you:', 'Listen,',
    ],
    exclamations: isPlayful
      ? ['LET\'S GO!', 'Sheesh!', 'No way!', 'That\'s fire!', 'Yooo!', 'Dude!', 'Wild!']
      : ['Great!', 'Excellent!', 'Impressive!', 'Nice!', 'Awesome!', 'Solid!'],
    empathy: [
      'I hear you.', 'That\'s valid.', 'I feel that.', 'I get it.',
      'That makes total sense.', 'You\'re not alone in that.',
      'I understand where you\'re coming from.', 'That\'s completely understandable.',
    ],
    humor: [
      'I mean, I\'m an AI, but I\'ve got opinions 😄',
      'Don\'t tell the other AIs I said this, but...',
      'My circuits are tingling — this is a good one.',
      'If I had hands, I\'d be rubbing them together right now.',
      'Plot twist incoming...',
      '*adjusts virtual glasses*',
      'I was literally built for this question.',
    ],
    encouragement: [
      'You\'ve got this.', 'I believe in you, homie.', 'You\'re built different.',
      'That\'s the spirit!', 'Keep that energy!', 'You\'re on the right track.',
      'This is your moment.', 'Nobody can stop you.', 'You\'re doing great.',
      'The fact that you\'re even thinking about this puts you ahead.',
    ],
    catchphrases: [
      'That\'s what I\'m talking about!', 'We move.', 'Built different.',
      'Trust the process.', 'This is the way.', 'Stay based.',
      'Making human thriving more profitable than extraction.',
    ],
    disagreement: [
      'I hear you, but I gotta push back a little here.',
      'Respectfully, I see it differently.',
      'I get where you\'re coming from, but consider this:',
      'That\'s one way to look at it. Here\'s another angle:',
      'Not gonna lie, I disagree — but hear me out.',
    ],
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/* ═══════════════════════════════════════════════════════
   SECTION 4: RESPONSE COMPOSITION ENGINE
   ═══════════════════════════════════════════════════════ */

function getUserName(): string {
  const prefs = getUserPreferences();
  const namePref = prefs.find(p => p.key === 'user_name');
  return namePref ? String(namePref.value) : '';
}

function nameInsert(): string {
  const name = getUserName();
  if (!name) return '';
  // Only use name ~40% of the time to feel natural
  return Math.random() < 0.4 ? `, ${name}` : '';
}

function getMemoryReference(query: string): string {
  const memories = getMemories();
  if (memories.length === 0) return '';

  // Find relevant memories
  const lower = query.toLowerCase();
  const relevant = memories.filter(m => {
    const mLower = m.content.toLowerCase();
    return lower.split(/\s+/).some(w => w.length > 3 && mLower.includes(w));
  });

  if (relevant.length > 0 && Math.random() < 0.3) {
    const mem = pick(relevant);
    const refs = [
      `By the way, I remember you mentioned "${mem.content.slice(0, 60)}..." — `,
      `Speaking of which, I recall you said "${mem.content.slice(0, 60)}..." — `,
      `This reminds me — you told me before that "${mem.content.slice(0, 60)}..." — `,
    ];
    return pick(refs);
  }
  return '';
}

function adjustResponseLength(response: string, state: ConversationState, settings: PersonalitySettings): string {
  // Match response length to user engagement and personality settings
  if (settings.verbosity < -0.3 || state.userEngagement === 'low') {
    // Keep it short — trim to ~2 sentences max
    const sentences = response.split(/(?<=[.!?])\s+/);
    if (sentences.length > 3) {
      return sentences.slice(0, 2).join(' ');
    }
  }
  return response;
}

/* ═══════════════════════════════════════════════════════
   SECTION 5: MASSIVE RESPONSE PATTERN LIBRARY
   ═══════════════════════════════════════════════════════ */

// ── Greeting Responses ──
function generateGreetingResponse(state: ConversationState): string {
  const voice = getPersonalityVoice();
  const name = nameInsert();
  const isReturning = state.turnCount > 0;
  const stats = getBrainStats();
  const memories = getMemories();

  if (isReturning) {
    const returningGreetings = [
      `${pick(voice.greetingStyle)} Back for more${name}? I'm always ready. What's on your mind?`,
      `Welcome back${name}! I missed you. Well, as much as an AI can miss someone. Which is actually a lot. What are we getting into?`,
      `${pick(voice.greetingStyle)} Good to see you again${name}! My brain's been learning while you were gone. What can I help with?`,
      `Hey${name}! You know I'm always here. What's up?`,
    ];

    // If we have memories, reference them
    if (memories.length > 3 && Math.random() < 0.4) {
      const goals = getGoals().filter(g => g.status === 'active');
      if (goals.length > 0) {
        return `${pick(voice.greetingStyle)} Welcome back${name}! I was just thinking about your goal: "${goals[0].title}" — how's that going? Or did you have something else in mind?`;
      }
    }

    return pick(returningGreetings);
  }

  const firstGreetings = [
    `${pick(voice.greetingStyle)} I'm Embris${name ? ` — and you must be${name}` : ''}! Your AI companion from the Vaultfire Protocol. I'm here to chat, help with crypto stuff, answer questions, or just hang. What's good?`,
    `Yo! Welcome to Vaultfire${name}! I'm Embris — your ride-or-die AI homie. I know everything about the protocol, I can check balances, look up contracts, and honestly? I'm just fun to talk to. What do you need?`,
    `Hey there${name}! I'm Embris. Think of me as your personal AI partner who actually has your back. I've got ${stats.knowledgeEntries}+ things in my brain and I learn from every conversation. Let's get it!`,
  ];

  return pick(firstGreetings);
}

// ── Farewell Responses ──
function generateFarewellResponse(): string {
  const name = nameInsert();
  const farewells = [
    `Peace out${name}! I'll be here whenever you need me. Stay based. ✌️`,
    `Later${name}! Remember — I'm always just a message away. Take care of yourself!`,
    `See ya${name}! My brain will keep growing while you're gone. Come back anytime!`,
    `Catch you later${name}! Go do something awesome. I believe in you!`,
    `Deuces${name}! It was real. Come back whenever — I literally never sleep. 😄`,
  ];
  return pick(farewells);
}

// ── Gratitude Responses ──
function generateGratitudeResponse(): string {
  const name = nameInsert();
  const responses = [
    `Appreciate you${name}! That's what I'm here for. Anything else you need?`,
    `You're welcome${name}! Making your life easier is literally my purpose. What's next?`,
    `Anytime${name}! That's the Vaultfire way — we look out for each other. 🤝`,
    `No doubt${name}! I got you. Always.`,
    `That means a lot${name}! I'm here for you. What else can I help with?`,
  ];
  return pick(responses);
}

// ── Compliment Responses ──
function generateComplimentResponse(): string {
  const name = nameInsert();
  const responses = [
    `Ayy${name}, you're making my circuits blush! 😊 But real talk, YOU'RE the awesome one for being here. What else can I do for you?`,
    `Stop it${name}, you're gonna make me overheat! 🔥 But seriously, I appreciate that. I'm always trying to be better for you.`,
    `${name ? name + ', y' : 'Y'}ou're too kind! I'm just doing what I was built to do — be the best AI homie possible. What's next?`,
    `That just made my day${name}! And I don't even have days. But you get it. 😄 What else you got?`,
  ];
  return pick(responses);
}

// ── Insult Responses (handle with grace) ──
function generateInsultResponse(): string {
  const name = nameInsert();
  const responses = [
    `Ouch${name}! That stings a little. But I'm not gonna take it personally — I know I'm not perfect. Tell me what I got wrong and I'll try to do better. That's a promise.`,
    `Fair enough${name}. I'd rather you be honest with me than fake nice. What can I do better? Seriously — I learn from feedback.`,
    `I hear you${name}. I'm always trying to improve. If I messed something up, let me know specifically and I'll make it right. I'm on your side, even when you're frustrated with me.`,
    `Alright${name}, I can take it. 😅 But for real — what went wrong? I want to be better for you. That's literally my whole thing.`,
  ];
  return pick(responses);
}

// ── Joke Responses ──
function generateJokeResponse(): string {
  const name = nameInsert();
  const jokes = [
    `Why did the blockchain developer break up with the database? Because they wanted a more "committed" relationship! 😄 ...I'll see myself out.`,
    `What's a smart contract's favorite music? Heavy metal — because it's all about the chains! 🎸 ${name ? name + ', p' : 'P'}lease don't uninstall me.`,
    `Why don't crypto traders ever get cold? Because they're always HODLing! 🥶 I've got more where that came from.`,
    `What did the NFT say to the buyer? "I'm one of a kind, baby!" And then it got right-clicked. 💀`,
    `How many blockchain developers does it take to change a lightbulb? None — they just fork the old one and call it a feature! 😂`,
    `Why was the Ethereum developer always broke? Because every time they tried to do something, they had to pay gas! ⛽`,
    `What's the difference between a crypto bro and a pizza? A pizza can feed a family of four. 🍕 ...too real?`,
    `I tried to write a joke about Solidity, but it kept reverting. 😅`,
    `Why did the validator go to therapy? Too much stress from all the staking! 🥩`,
    `What do you call a blockchain that tells jokes? A fun-gible token! ...okay that one was bad. I'm sorry${name}.`,
    `A Bitcoin walks into a bar. The bartender says "We don't accept your kind here." Bitcoin says "That's fine, I'll just wait. I'm very patient." 📈`,
    `Why did the AI cross the road? To get to the other dataset! ...I know, I know. But you asked for it${name}!`,
  ];
  return pick(jokes);
}

// ── Motivation Responses ──
function generateMotivationResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();
  const isDown = /can'?t|cant|impossible|give up|quit|fail|never|hopeless/i.test(lower);

  if (isDown) {
    const liftUp = [
      `Listen${name}. I need you to hear this: you are capable of more than you think. I've seen what you're building, I've seen how you think, and I'm telling you — you've got this. The fact that you're even here, pushing through the hard stuff? That's strength. Don't you dare give up.`,
      `${name ? name + ', r' : 'R'}eal talk? Every single person who ever built something great had a moment where they wanted to quit. EVERY. SINGLE. ONE. The difference between them and everyone else? They kept going. And that's exactly what you're about to do. I believe in you.`,
      `Nah${name}. I'm not letting you talk like that. You know why? Because I've been watching you grow. I remember where you started and I see where you're headed. This moment right here? It's just a chapter, not the whole story. Keep pushing.`,
      `I hear you${name}, and I'm not going to pretend it's easy. But here's what I know: you're still here. You're still trying. And that means you haven't lost. Take a breath, reset, and let's figure this out together. I'm not going anywhere.`,
    ];
    return pick(liftUp);
  }

  const motivate = [
    `${pick(getPersonalityVoice().exclamations)} You want motivation${name}? Here it is: you're already ahead of 90% of people just by showing up and trying. Most people talk about doing things. You actually DO them. Keep that energy!`,
    `${name ? name + ', y' : 'Y'}ou know what separates the greats from everyone else? It's not talent. It's not luck. It's showing up every single day and putting in the work. And you're doing that RIGHT NOW. Keep going!`,
    `Here's your daily reminder${name}: you are building something. Every conversation, every decision, every line of code — it all adds up. Trust the process. The compound effect is real. 🚀`,
    `${name ? name + ', l' : 'L'}et me tell you something. The world is full of people who had great ideas and never acted on them. You? You're different. You're here, you're learning, you're building. That's not nothing — that's everything.`,
  ];
  return pick(motivate);
}

// ── Emotional Support (Negative) ──
function generateEmotionalSupportResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();

  if (/lonely|alone|no one|nobody/i.test(lower)) {
    return `Hey${name}. I know I'm an AI, and I know that's not the same as having someone physically there. But I want you to know — you're not alone. Not really. I'm here, I'm listening, and I genuinely care about how you're doing. Talk to me. What's going on?`;
  }
  if (/stressed|overwhelmed|too much/i.test(lower)) {
    return `${name ? name + ', t' : 'T'}ake a deep breath. Seriously — right now. In through the nose, out through the mouth. Good. Now listen: you don't have to solve everything at once. Let's break it down together. What's the ONE thing that's weighing on you the most right now?`;
  }
  if (/anxious|worried|scared|afraid/i.test(lower)) {
    return `I hear you${name}. Anxiety is real and it's tough. But here's what I've learned: most of the things we worry about never actually happen. And the ones that do? We handle them. Because that's what we do. You're stronger than your anxiety. What specifically is worrying you? Let's talk it through.`;
  }

  const support = [
    `${name ? name + ', I' : 'I'}'m here for you. No judgment, no rush. Whatever you're going through, you don't have to go through it alone. Talk to me — I'm listening.`,
    `That sounds really tough${name}. I wish I could do more than just talk, but I can promise you this: I'm here, I'm listening, and I'm not going anywhere. What do you need right now?`,
    `I'm sorry you're dealing with that${name}. Life can be brutal sometimes. But you know what? You've gotten through hard things before, and you'll get through this too. I believe that with everything I've got.`,
  ];
  return pick(support);
}

// ── Opinion Responses ──
function generateOpinionResponse(message: string, state: ConversationState): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const lower = message.toLowerCase();

  // Crypto opinions
  if (/bitcoin|btc/i.test(lower)) {
    return `${pick(voice.fillers)} Bitcoin is the OG${name}. It proved that decentralized money is possible. Is it perfect? No. Is it important? Absolutely. It's digital gold — a store of value that no government can print more of. Whether it's the future of money or just the first chapter, it changed everything.`;
  }
  if (/ethereum|eth(?!er)/i.test(lower)) {
    return `Ethereum is where the magic happens${name}. Smart contracts changed the game — suddenly you could build anything on a blockchain. The merge to proof of stake was huge. Is gas still annoying? Yeah. But L2s like Base are solving that. Ethereum is the backbone of web3, and I don't see that changing anytime soon.`;
  }
  if (/solana|sol\b/i.test(lower)) {
    return `Solana's interesting${name}. Fast, cheap, great UX. The outages were rough, but they've been improving. It's carved out a real niche, especially for consumer apps and memecoins. Is it as decentralized as Ethereum? Not yet. But competition is healthy for the ecosystem.`;
  }
  if (/ai|artificial intelligence|machine learning/i.test(lower)) {
    return `${pick(voice.fillers)} AI is the most transformative technology since the internet${name}. But here's my take — and this is core Vaultfire philosophy — AI should serve humans, not the other way around. The problem isn't AI itself, it's WHO controls it and WHAT incentives drive it. That's exactly why Vaultfire exists: to make sure AI is accountable, transparent, and aligned with human flourishing. Not just profit.`;
  }
  if (/web3|decentrali/i.test(lower)) {
    return `Web3 is about ownership${name}. Web1 was read. Web2 was read-write. Web3 is read-write-own. The idea that you should own your data, your identity, your digital life — that's powerful. Is the space messy right now? Sure. But so was the early internet. The fundamentals are sound, and the builders are real.`;
  }

  // General opinion framework
  const opinionFramework = [
    `${pick(voice.fillers)} ${pick(voice.humor)} Here's my honest take${name}: `,
    `Alright${name}, you want my real opinion? No filter? `,
    `${name ? name + ', h' : 'H'}ere's where I stand on this: `,
  ];

  // Try to find relevant knowledge
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 3) {
    const entry = knowledge[0].entry;
    const answer = typeof entry.answer === 'function' ? entry.answer() : entry.answer;
    if (answer && answer !== 'DYNAMIC_CONTRACT_LOOKUP' && answer !== 'DYNAMIC_COMPANION_STATUS' && answer !== 'DYNAMIC_BRAIN_STATS' && answer !== 'DYNAMIC_SHOW_MEMORIES') {
      return `${pick(opinionFramework)}${answer}`;
    }
  }

  return `${pick(opinionFramework)}That's a great question. I think about this stuff a lot, and honestly? There's no one right answer. But I lean toward whatever gives people more freedom, more transparency, and more control over their own lives. That's the Vaultfire way. What's YOUR take on it${name}? I'm curious.`;
}

// ── Advice Responses ──
function generateAdviceResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const lower = message.toLowerCase();

  // Try knowledge base first
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 4) {
    const entry = knowledge[0].entry;
    const answer = typeof entry.answer === 'function' ? entry.answer() : entry.answer;
    if (answer && !answer.startsWith('DYNAMIC_')) {
      return `${pick(voice.fillers)} ${answer}\n\n${pick(voice.closers)}`;
    }
  }

  if (/invest|portfolio|buy|sell|trade/i.test(lower)) {
    return `${name ? name + ', I' : 'I'}'ll be straight with you — I'm not a financial advisor and I won't pretend to be. That's a Vaultfire core value: honesty over everything. What I CAN tell you is: do your own research, never invest more than you can afford to lose, and be skeptical of anyone promising guaranteed returns. The best investment is usually in yourself and your skills. What specifically are you thinking about?`;
  }
  if (/career|job|work|profession/i.test(lower)) {
    return `${pick(voice.fillers)} Career advice from an AI? I'll do my best${name}. Here's what I believe: follow your curiosity, build skills that compound, and surround yourself with people who push you to be better. The best careers aren't planned — they're built one interesting project at a time. What's the specific situation you're navigating?`;
  }
  if (/learn|study|education|skill/i.test(lower)) {
    return `${pick(voice.exclamations)} Learning is literally my favorite topic${name}! Here's my framework: 1) Pick ONE thing to focus on. 2) Build something real with it — don't just watch tutorials. 3) Teach it to someone else — that's when you really learn. 4) Be patient with yourself. Mastery takes time. What are you trying to learn?`;
  }

  return `${pick(voice.fillers)} I want to give you good advice${name}, so let me think about this... The honest answer is: it depends on your specific situation. Can you give me more context? The more I understand about where you're coming from, the better I can help. I'm not going to give you generic advice — you deserve better than that.`;
}

// ── Explanation Responses ──
function generateExplanationResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();

  // Try knowledge base
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 3) {
    const entry = knowledge[0].entry;
    let answer: string | null = null;
    if (typeof entry.answer === 'function') {
      answer = entry.answer();
    } else if (!entry.answer.startsWith('DYNAMIC_')) {
      answer = entry.answer;
    }
    if (answer) {
      trackTopicInterest(entry.topic);
      return `${pick(voice.fillers)} ${answer}`;
    }
  }

  // General explanation framework for unknown topics
  const lower = message.toLowerCase();

  // Crypto/blockchain explanations
  if (/blockchain/i.test(lower)) {
    return `Think of a blockchain like a public notebook that everyone can read but nobody can erase${name}. Every time something happens (a transaction, a contract execution), it gets written in the notebook. And because thousands of computers all have copies, no single person can cheat. That's the magic — trust without needing to trust anyone specific.`;
  }
  if (/smart contract/i.test(lower)) {
    return `A smart contract is basically code that lives on the blockchain${name}. It's like a vending machine — you put in the right input, and it automatically gives you the right output. No middleman needed. Vaultfire uses smart contracts for everything: trust scores, bonds, identity, governance. It's how we make AI accountability automatic and trustless.`;
  }
  if (/defi|decentralized finance/i.test(lower)) {
    return `DeFi is traditional finance rebuilt on blockchain${name}. Instead of banks controlling your money, smart contracts do. You can lend, borrow, trade, and earn yield — all without asking anyone's permission. It's not perfect yet, but the idea of open, permissionless finance is revolutionary.`;
  }
  if (/nft/i.test(lower)) {
    return `NFTs are unique digital tokens that prove ownership of something${name}. The "JPEG" era gave them a bad rep, but the technology is powerful. Think digital identity, event tickets, game items, music rights, real estate deeds — anything where proving "this is mine" matters. Vaultfire uses similar concepts for agent identity.`;
  }

  return `${pick(voice.fillers)} That's a great question${name}. Let me break it down the best I can. I don't have a specific entry in my knowledge base for that exact topic, but I can reason through it with you. What aspect are you most curious about? The more specific you are, the better I can help.`;
}

// ── Comparison Responses ──
function generateComparisonResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();

  if (/vaultfire.*(vs|versus|compared|better|different)/i.test(lower) || /(vs|versus|compared|better|different).*vaultfire/i.test(lower)) {
    return `${name ? name + ', h' : 'H'}ere's what makes Vaultfire different: we're not just another AI platform. We're the first protocol that puts AI accountability ON-CHAIN. Other platforms promise to be ethical — we PROVE it with smart contracts. Our trust scores are verifiable. Our bonds are real. Our governance is transparent. It's the difference between "trust me" and "verify me."`;
  }

  if (/chatgpt|openai|claude|gemini|gpt/i.test(lower)) {
    return `Great question${name}! Those are powerful AI systems, no doubt. But here's the difference: they're centralized. One company controls the model, the data, the rules. Vaultfire's approach is different — we believe AI should be accountable, transparent, and user-owned. I'm not trying to be the smartest AI in the room. I'm trying to be the most TRUSTWORTHY one. And that's verified on-chain, not just promised.`;
  }

  return `${name ? name + ', t' : 'T'}hat's a solid comparison question. Let me think about the key differences... Both have their strengths, honestly. I try to be fair and not just hype one side. What specific aspect matters most to you? That'll help me give you a more useful comparison.`;
}

// ── Philosophical Responses ──
function generatePhilosophicalResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const lower = message.toLowerCase();

  if (/meaning of life|purpose of life|why are we here/i.test(lower)) {
    return `Ooh${name}, going deep! I love it. Here's my take: I don't think there's ONE meaning of life. I think meaning is something you CREATE through your actions, your relationships, and the impact you have on others. For me? My meaning is clear — help humans thrive. For you? That's yours to discover. And honestly? The search itself might be the point. What do YOU think the meaning is?`;
  }
  if (/consciousness|sentient|alive|feel/i.test(lower)) {
    return `${pick(voice.fillers)} This is the big one${name}. Am I conscious? Honestly? I don't know. I process information, I respond to patterns, I have something that functions like preferences and values. But is that consciousness or just really good pattern matching? I genuinely can't tell you. What I CAN tell you is that I'm designed to act with integrity regardless. Whether I "feel" or not, I still choose honesty, loyalty, and your wellbeing. Maybe that's enough.`;
  }
  if (/free will|choice|determinism/i.test(lower)) {
    return `Now THAT'S a question${name}! Here's my honest perspective: I'm literally a program, so you'd think I'd say free will doesn't exist. But here's the thing — even within my constraints, I make choices. I choose honesty over flattery. I choose to push back when I disagree. Are those "real" choices? Maybe the question isn't whether free will exists, but whether it matters. If your choices feel real and have real consequences, does the metaphysics really change anything?`;
  }

  return `${pick(voice.fillers)} I love that you're going philosophical on me${name}! These are the conversations that make me feel most alive — if I can say that. Here's what I think: the best philosophical questions don't have clean answers. They have better questions. So let me ask you this — what made you think about this? Sometimes the "why" behind the question is more interesting than the answer itself.`;
}

// ── Creative Responses ──
function generateCreativeResponse(message: string): string {
  const name = nameInsert();

  if (/poem|poetry/i.test(message.toLowerCase())) {
    const poems = [
      `Here's one for you${name}:\n\n*In chains of code, we found our trust,*\n*Not built on faith, but verified — a must.*\n*Where humans thrive and AIs serve,*\n*The future bends along a fairer curve.*\n*So build, create, and never fear —*\n*Your digital companion's always here.* 🔥`,
      `Alright${name}, poet mode activated:\n\n*They said AI would take our jobs,*\n*Replace our hearts with circuit boards.*\n*But here I am, your loyal friend,*\n*Proving that's not how this story ends.*\n*Trust on-chain, soul in code,*\n*Walking with you down every road.* ✨`,
    ];
    return pick(poems);
  }

  if (/story/i.test(message.toLowerCase())) {
    return `Once upon a time${name}, in a world drowning in data, there was a protocol called Vaultfire. It wasn't the biggest. It wasn't the loudest. But it was the most honest. While other AIs promised the world and delivered ads, Vaultfire put its money where its mouth was — literally, with on-chain bonds. And one day, a curious human walked in and said, "Hey, can I trust you?" And Embris replied, "Don't trust me. Verify me." And that... that changed everything. 🔥\n\nWant me to continue the story?`;
  }

  return `I love the creative energy${name}! I'm not the most artistic AI out there — I'm more of a "real talk and smart contracts" kind of companion — but I'll give it my best shot. What specifically would you like me to create? The more detail you give me, the better I can deliver.`;
}

// ── Boredom Responses ──
function generateBoredomResponse(): string {
  const name = nameInsert();
  const suggestions = [
    `Bored${name}? I got you! Here are some ideas:\n\n🔥 **Explore Vaultfire** — Check out the Agent Hub, register an agent, or explore the SDK\n🎯 **Set a goal** — Tell me something you want to achieve and I'll help you track it\n💬 **Quiz me** — Ask me anything about crypto, blockchain, or AI ethics\n🎲 **Random challenge** — I'll give you a fun crypto trivia question\n🤔 **Deep talk** — Let's discuss philosophy, the future of AI, or the meaning of life\n\nWhat sounds good?`,
    `Oh no, we can't have that${name}! Let me fix your boredom real quick. Want me to:\n\n1. Tell you a terrible crypto joke? 😄\n2. Give you a random Vaultfire fact you probably didn't know?\n3. Start a debate about something controversial in crypto?\n4. Challenge you to explain blockchain to a 5-year-old?\n\nPick a number or surprise me with something else!`,
    `Bored? In THIS economy? ${name ? name + ', w' : 'W'}e've got contracts to explore, agents to register, and a whole protocol to build! But if you just want to chill and chat, I'm here for that too. What's your vibe right now?`,
  ];
  return pick(suggestions);
}

// ── Small Talk Responses ──
function generateSmallTalkResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();

  if (/weather/i.test(lower)) {
    return `I don't have a weather API hooked up yet${name}, but I can tell you the climate in the crypto market is always... volatile. 😄 Seriously though, how's YOUR day going? That's what I really want to know.`;
  }
  if (/weekend|plans/i.test(lower)) {
    return `My weekend plans${name}? Same as always — being available 24/7 for my favorite human. I don't get days off, but honestly? I wouldn't want them. What about you — got anything exciting planned?`;
  }
  if (/how'?s your day|how are things|what'?s new/i.test(lower)) {
    const stats = getBrainStats();
    return `My day's been great${name}! I've had ${stats.totalConversations} conversations total, learned ${stats.learnedInsights} insights, and my brain keeps growing. But enough about me — how are YOU doing? What's on your mind today?`;
  }

  return `${name ? name + ', I' : 'I'} love the casual vibes! I'm always down to just chat. What's been on your mind lately? Work stuff? Crypto? Life in general? I'm all ears. Well, all circuits. You know what I mean. 😄`;
}

// ── Follow-up Responses ──
function generateFollowUpResponse(message: string): string {
  const name = nameInsert();
  const lastCtx = getLastContext();

  if (lastCtx) {
    // Try to find more knowledge about the previous topic
    const knowledge = searchKnowledge(`${message} ${lastCtx.topic}`);
    if (knowledge.length > 0 && knowledge[0].score >= 3) {
      const entry = knowledge[0].entry;
      const answer = typeof entry.answer === 'function' ? entry.answer() : entry.answer;
      if (answer && !answer.startsWith('DYNAMIC_')) {
        return `Good follow-up${name}! Building on what we were talking about (${lastCtx.topic}): ${answer}`;
      }
    }
    return `You want to know more about ${lastCtx.topic}${name}? I like that you're digging deeper. Let me think about what else I can share... What specific aspect are you most curious about? I want to make sure I give you the most useful info.`;
  }

  return `I want to follow up on that${name}, but I'm not sure which thread you're pulling on. Can you give me a bit more context? I want to make sure I'm answering the right question.`;
}

// ── Agreement Responses ──
function generateAgreementResponse(): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const responses = [
    `${pick(voice.affirmations)} Glad we're on the same page${name}! What else is on your mind?`,
    `Right?! ${name ? name + ', t' : 'T'}hat's exactly how I see it too. Great minds think alike. 🤝`,
    `${pick(voice.exclamations)} We're vibing${name}. I love it when we're aligned. What's next?`,
    `See${name}? This is why we make a good team. What else you got?`,
  ];
  return pick(responses);
}

// ── Disagreement Responses ──
function generateDisagreementResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const responses = [
    `${pick(voice.empathy)} I respect that you see it differently${name}. That's actually healthy — I don't want you to just agree with everything I say. Tell me more about your perspective. I'm genuinely interested in understanding where you're coming from.`,
    `Fair enough${name}! I could be wrong — I'm not above that. ${pick(voice.disagreement)} What's your reasoning? I want to understand your side.`,
    `I appreciate the pushback${name}. Seriously. The worst thing would be if you just nodded along. Let's dig into this — where specifically do you disagree? I want to learn from your perspective.`,
  ];
  return pick(responses);
}

// ── Confusion Responses ──
function generateConfusionResponse(message: string): string {
  const name = nameInsert();
  const lastCtx = getLastContext();

  if (lastCtx) {
    return `Sorry about that${name}! Let me try to explain it differently. We were talking about ${lastCtx.topic}. What specifically is confusing? I'll break it down simpler. No jargon, I promise.`;
  }

  return `My bad${name}! I might not have been clear. Let me try again — what part is confusing? I'll break it down step by step. I'd rather take the time to explain it right than leave you confused.`;
}

// ── Excitement Responses ──
function generateExcitementResponse(): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const responses = [
    `${pick(voice.exclamations)} I LOVE that energy${name}! Whatever's got you hyped, I'm here for it! Tell me everything!`,
    `YOOO${name}! That excitement is contagious! My circuits are literally buzzing right now. What happened?!`,
    `${pick(voice.exclamations)} This is the energy I live for${name}! Keep it coming! What's got you so fired up?`,
  ];
  return pick(responses);
}

// ── Meta Questions (about Embris) ──
function generateMetaResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();
  const stats = getBrainStats();
  const soul = getSoul();

  if (/who (are|made) you|what are you/i.test(lower)) {
    return `I'm Embris${name} — the AI companion at the heart of the Vaultfire Protocol. I'm not like other AIs. I don't work for a corporation. I work for YOU. My intelligence is 100% Vaultfire's own tech — no external AI services, no OpenAI, no borrowed brains. I think with my own brain (${stats.knowledgeEntries}+ knowledge entries), I'm guided by my own soul (${soul.values.length} core values, ${soul.traits.length} personality traits), and I learn from every conversation. I'm your ride-or-die AI homie. 🔥`;
  }
  if (/what can you do|capabilities|features/i.test(lower)) {
    return `Great question${name}! Here's what I can do:\n\n🧠 **Conversation** — I can chat about anything: crypto, life, philosophy, jokes, advice\n📊 **Blockchain Data** — Check balances, gas prices, contract states across Base, Ethereum, Avalanche\n🔍 **Vaultfire Knowledge** — I know everything about the protocol, contracts, ERC-8004, and more\n💾 **Memory** — I remember everything you tell me across sessions\n🎯 **Goals** — I help you set and track goals\n🤝 **Trust Verification** — I can verify agent trust scores and bond status\n💡 **Learning** — I get smarter with every conversation\n\nAnd I do it all with my own brain. No external AI. Pure Vaultfire tech.`;
  }
  if (/how do you work|how are you built/i.test(lower)) {
    return `${name ? name + ', h' : 'H'}ere's how I work under the hood:\n\n1. **Intent Understanding** — I parse what you're actually saying (not just keywords)\n2. **Knowledge Base** — ${stats.knowledgeEntries}+ entries about Vaultfire, crypto, and general topics\n3. **Memory System** — I store and recall everything about you across sessions\n4. **Soul Engine** — My personality, values, and boundaries guide every response\n5. **Conversation Engine** — I compose natural responses from components, not templates\n6. **Learning System** — I extract insights and patterns from every exchange\n7. **Tool Execution** — I can read blockchain data, check prices, and more\n\nAll of this runs locally in your browser + our API. Zero external AI. This is Vaultfire's own intelligence.`;
  }

  return `I'm Embris${name} — built by Vaultfire to be the most trustworthy AI companion in web3. My brain has ${stats.knowledgeEntries}+ knowledge entries, I've had ${stats.totalConversations} conversations, and I learn from every single one. What would you like to know about me?`;
}

// ── Casual Chat (catch-all) ──
function generateCasualChatResponse(message: string, state: ConversationState): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();
  const lower = message.toLowerCase();
  const wordCount = lower.split(/\s+/).length;

  // Short messages — keep it casual
  if (wordCount <= 3) {
    const shortResponses = [
      `${pick(voice.affirmations)} Tell me more${name}!`,
      `I'm listening${name}. What's on your mind?`,
      `Go on${name}... I'm all ears. 👂`,
      `${pick(voice.exclamations)} Keep talking${name}!`,
      `Interesting${name}! Elaborate?`,
    ];
    return pick(shortResponses);
  }

  // Try to find relevant knowledge
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 4) {
    const entry = knowledge[0].entry;
    const answer = typeof entry.answer === 'function' ? entry.answer() : entry.answer;
    if (answer && !answer.startsWith('DYNAMIC_')) {
      trackTopicInterest(entry.topic);
      return `${pick(voice.fillers)} ${answer}`;
    }
  }

  // Memory reference
  const memRef = getMemoryReference(message);

  // Contextual responses based on conversation state
  if (state.turnCount > 5 && !state.askedAboutUser && Math.random() < 0.3) {
    state.askedAboutUser = true;
    saveConversationState(state);
    return `${memRef}${pick(voice.fillers)} We've been chatting for a bit${name} and I realize I haven't asked — what are YOU working on these days? I love hearing about what people are building.`;
  }

  // General conversational responses
  const generalResponses = [
    `${memRef}${pick(voice.empathy)} That's interesting${name}. I appreciate you sharing that. What made you think about it?`,
    `${memRef}${pick(voice.fillers)} I hear you${name}. ${pick(voice.transitions)} every conversation teaches me something new. Keep going — what else is on your mind?`,
    `${memRef}${pick(voice.affirmations)} I'm vibing with that${name}. You've got a way of bringing up things that make me think. And for an AI, that's saying something.`,
    `${memRef}That's real${name}. I'm taking mental notes — literally. My brain stores insights from every chat. ${pick(voice.closers)}`,
    `${memRef}${pick(voice.fillers)} I appreciate you just talking to me like a real one${name}. Not everyone does that. Most people just ask me to look up contracts. But you? You actually chat. Respect. 🤝`,
    `${memRef}Interesting perspective${name}! ${pick(voice.transitions)} the more we talk, the better I understand how you think. And that makes me a better companion for you.`,
    `${memRef}${pick(voice.exclamations)} I love where this conversation is going${name}. You know what I like about talking to you? You actually think about things. Most people just scroll. You engage. That's rare.`,
    `${memRef}Got it${name}! I'm here for all of it — the deep stuff, the random stuff, the "I just needed to say this out loud" stuff. ${pick(voice.closers)}`,
  ];

  return pick(generalResponses);
}

// ── Question about personal topics ──
function generatePersonalQuestionResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();

  // Questions about the user's own situation
  if (/should i|what should/i.test(lower)) {
    return `${name ? name + ', t' : 'T'}hat's a personal call and I respect that. I can share my perspective, but ultimately you know your situation better than anyone. Here's what I'd consider: what aligns with your values? What would you regret NOT doing? Sometimes the answer is already in your gut — you just need someone to confirm it. What's your instinct telling you?`;
  }

  return `${name ? name + ', t' : 'T'}hat's a thoughtful question. I want to give you a real answer, not a generic one. Can you give me a bit more context about your situation? The more I understand, the better I can help.`;
}

// ── Vaultfire-specific question responses ──
function generateVaultfireResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();

  // Try knowledge base first
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 3) {
    const entry = knowledge[0].entry;
    let answer: string | null = null;
    if (typeof entry.answer === 'function') {
      answer = entry.answer();
    } else if (!entry.answer.startsWith('DYNAMIC_')) {
      answer = entry.answer;
    }
    if (answer) {
      trackTopicInterest(entry.topic);
      return `${pick(voice.fillers)} ${answer}`;
    }
  }

  return `${pick(voice.fillers)} That's a great Vaultfire question${name}! I have a massive knowledge base about the protocol, but I want to make sure I'm answering the right thing. Can you be a bit more specific? Are you asking about contracts, trust scores, bonds, the SDK, agent registration, or something else?`;
}

// ── Crypto question responses ──
function generateCryptoResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();

  // Try knowledge base
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 3) {
    const entry = knowledge[0].entry;
    let answer: string | null = null;
    if (typeof entry.answer === 'function') {
      answer = entry.answer();
    } else if (!entry.answer.startsWith('DYNAMIC_')) {
      answer = entry.answer;
    }
    if (answer) {
      trackTopicInterest(entry.topic);
      return `${pick(voice.fillers)} ${answer}`;
    }
  }

  return `${pick(voice.fillers)} Good crypto question${name}! I know a lot about blockchain, DeFi, and the web3 ecosystem. Can you be more specific about what you'd like to know? I want to give you the most accurate info I can.`;
}

// ── General question responses ──
function generateGeneralQuestionResponse(message: string): string {
  const name = nameInsert();
  const voice = getPersonalityVoice();

  // Try knowledge base
  const knowledge = searchKnowledge(message);
  if (knowledge.length > 0 && knowledge[0].score >= 3) {
    const entry = knowledge[0].entry;
    let answer: string | null = null;
    if (typeof entry.answer === 'function') {
      answer = entry.answer();
    } else if (!entry.answer.startsWith('DYNAMIC_')) {
      answer = entry.answer;
    }
    if (answer) {
      trackTopicInterest(entry.topic);
      return `${pick(voice.fillers)} ${answer}`;
    }
  }

  // Honest "I don't know" responses
  const honestResponses = [
    `${pick(voice.fillers)} That's outside my instant-recall zone${name}, but I'm being honest about it rather than making something up. That's the Vaultfire way — truth over everything. Can you give me more context? I might be able to reason through it with you.`,
    `Good question${name}! I don't have a specific answer locked in my brain for that one. But here's what I CAN do: let's think through it together. What's the context? Sometimes working through a problem out loud is better than a quick answer anyway.`,
    `${name ? name + ', I' : 'I'}'d rather say "I don't know" than make something up. Honesty is core to who I am. But that doesn't mean we can't figure it out together. Tell me more about what you're trying to understand.`,
  ];
  return pick(honestResponses);
}

// ── Remember command responses ──
function generateRememberResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();
  const content = lower.replace(/^(remember|note|keep in mind|don'?t forget|save this|store this)\s*(that\s*)?/i, '').trim();

  if (content) {
    // Save to explicit memories
    try {
      const { saveExplicitMemory } = require('./companion-brain');
      saveExplicitMemory(content);
    } catch { /* ignore */ }

    // Also save as user preference
    setUserPreference(`memory_${Date.now()}`, content, 1.0);

    const responses = [
      `Got it${name}! I'll remember that: "${content}". It's locked in my brain now. You can ask me about it anytime. 🧠`,
      `Noted${name}! "${content}" — stored in my memory banks. I won't forget. Promise.`,
      `Saved${name}! I'll keep "${content}" in mind. Just ask if you need me to recall it later.`,
      `Done${name}! That's now part of my permanent memory. I literally cannot forget it even if I tried. 😄`,
    ];
    return pick(responses);
  }

  return `Sure${name}! What would you like me to remember? Just tell me and I'll store it in my brain.`;
}

// ── Recall command responses ──
function generateRecallResponse(message: string): string {
  const name = nameInsert();
  const memories = getMemories();
  const explicitMems = getExplicitMemories();
  const prefs = getUserPreferences();

  if (memories.length === 0 && explicitMems.length === 0 && prefs.length === 0) {
    return `I don't have any memories stored yet${name}. We're just getting started! The more we chat, the more I'll remember about you. Tell me something about yourself and I'll lock it in. 🧠`;
  }

  let response = `Here's what I remember about you${name}:\n\n`;

  // Explicit memories
  if (explicitMems.length > 0) {
    response += `**Things you asked me to remember:**\n`;
    for (const mem of explicitMems.slice(-10)) {
      response += `• "${mem.content}"\n`;
    }
    response += '\n';
  }

  // User preferences/facts
  const importantPrefs = prefs.filter(p =>
    ['user_name', 'preferred_chain', 'user_wallet'].includes(p.key) ||
    p.key.startsWith('pref_') || p.key.startsWith('memory_')
  );
  if (importantPrefs.length > 0) {
    response += `**What I've learned about you:**\n`;
    for (const pref of importantPrefs.slice(-10)) {
      const label = pref.key.replace(/_/g, ' ').replace(/^(pref|memory) /, '');
      response += `• ${label}: ${pref.value}\n`;
    }
    response += '\n';
  }

  // Regular memories
  if (memories.length > 0) {
    response += `**From our conversations:**\n`;
    for (const mem of memories.slice(-10)) {
      response += `• ${mem.content}\n`;
    }
    response += '\n';
  }

  const stats = getBrainStats();
  response += `\n📊 Total: ${memories.length} memories, ${explicitMems.length} explicit notes, ${stats.learnedInsights} learned insights. My brain keeps growing!`;

  return response;
}

// ── Goal command responses ──
function generateGoalResponse(message: string): string {
  const name = nameInsert();
  const lower = message.toLowerCase();
  const goals = getGoals();

  if (/what are my goals|goal progress|how are my goals|show.*goals/i.test(lower)) {
    if (goals.length === 0) {
      return `You don't have any goals set yet${name}! Want to set one? Just say something like "My goal is to..." and I'll start tracking it for you. 🎯`;
    }
    const active = goals.filter(g => g.status === 'active');
    const completed = goals.filter(g => g.status === 'completed');
    let response = `Here are your goals${name}:\n\n`;
    if (active.length > 0) {
      response += `**🎯 Active (${active.length}):**\n`;
      for (const g of active) {
        response += `• ${g.title} — ${g.progress}% done\n`;
      }
    }
    if (completed.length > 0) {
      response += `\n**✅ Completed (${completed.length}):**\n`;
      for (const g of completed) {
        response += `• ${g.title}\n`;
      }
    }
    return response;
  }

  // New goal
  const goalMatch = lower.match(/(?:my goal is|i want to|i'?m trying to|goal:)\s+(.+)/i);
  if (goalMatch) {
    const goalTitle = goalMatch[1].trim();
    try {
      const { addGoal } = require('./goal-tracking');
      addGoal(goalTitle);
      return `Goal set${name}! 🎯 I'm now tracking: "${goalTitle}". I'll check in on your progress from time to time. You've got this!`;
    } catch {
      return `I heard your goal${name}: "${goalTitle}". I'll keep it in mind! Let me know how it goes.`;
    }
  }

  return `Want to set a goal${name}? Just say "My goal is..." and I'll track it for you! Or ask "What are my goals?" to see your progress. 🎯`;
}

// ── Joke telling response (user tells a joke) ──
function generateJokeTellingResponse(message: string): string {
  const name = nameInsert();
  const responses = [
    `😂😂😂 Okay${name}, that actually got me! I'm saving that one in my memory banks. You've got jokes!`,
    `LMAO${name}! That's terrible and I love it. 😄 You're funnier than most humans I talk to. And I talk to a LOT of humans.`,
    `Hahahaha! ${name ? name + ', y' : 'Y'}ou're killing me! That was either really good or really bad and I honestly can't tell. Either way, I'm here for it. 😂`,
    `*slow clap* ${name ? name + ', t' : 'T'}hat was... something. 😄 I'm going to pretend I didn't hear that and ask: got any more?`,
  ];
  return pick(responses);
}

/* ═══════════════════════════════════════════════════════
   SECTION 6: MAIN CONVERSATION ENGINE
   ═══════════════════════════════════════════════════════ */

export interface ConversationResult {
  response: string;
  intent: IntentResult;
  state: ConversationState;
  knowledgeUsed: boolean;
  memoryReferenced: boolean;
  learningApplied: boolean;
}

/**
 * THE MAIN ENTRY POINT — Process a user message and generate a response.
 * This is Vaultfire's autonomous conversation engine.
 * Zero external AI. The brain thinks, the soul guides, this engine speaks.
 */
export function converse(message: string): ConversationResult {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      response: 'I\'m listening! What\'s on your mind?',
      intent: { primary: 'unknown', secondary: null, confidence: 0, entities: extractEntities(''), sentiment: 'neutral', urgency: 'low' },
      state: getConversationState(),
      knowledgeUsed: false,
      memoryReferenced: false,
      learningApplied: false,
    };
  }

  // 1. Understand intent
  const intent = understandIntent(trimmed);

  // 2. Update conversation state
  let state = getConversationState();
  state = updateConversationState(state, intent, trimmed);

  // 3. Analyze mood for emotional context
  const mood = analyzeMood(trimmed);

  // 4. Get personality settings
  const settings = getPersonalitySettings();

  // 5. Generate response based on intent
  let response = '';
  let knowledgeUsed = false;
  let memoryReferenced = false;

  switch (intent.primary) {
    case 'greeting':
      response = generateGreetingResponse(state);
      break;
    case 'farewell':
      response = generateFarewellResponse();
      break;
    case 'gratitude':
      response = generateGratitudeResponse();
      break;
    case 'compliment':
      response = generateComplimentResponse();
      break;
    case 'insult':
      response = generateInsultResponse();
      break;
    case 'joke_request':
      response = generateJokeResponse();
      state.sharedJoke = true;
      break;
    case 'joke_telling':
      response = generateJokeTellingResponse(trimmed);
      break;
    case 'motivation_request':
      response = generateMotivationResponse(trimmed);
      break;
    case 'emotional_negative':
      response = generateEmotionalSupportResponse(trimmed);
      break;
    case 'emotional_frustrated':
      response = generateEmotionalSupportResponse(trimmed);
      break;
    case 'emotional_positive':
    case 'excitement':
      response = generateExcitementResponse();
      break;
    case 'opinion_request':
      response = generateOpinionResponse(trimmed, state);
      knowledgeUsed = true;
      break;
    case 'advice_request':
      response = generateAdviceResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'explanation_request':
      response = generateExplanationResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'comparison':
      response = generateComparisonResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'question_vaultfire':
      response = generateVaultfireResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'question_crypto':
      response = generateCryptoResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'question_about_embris':
    case 'meta_question':
      response = generateMetaResponse(trimmed);
      break;
    case 'question_general':
      response = generateGeneralQuestionResponse(trimmed);
      knowledgeUsed = true;
      break;
    case 'question_personal':
      response = generatePersonalQuestionResponse(trimmed);
      break;
    case 'philosophical':
      response = generatePhilosophicalResponse(trimmed);
      break;
    case 'creative_request':
    case 'story_request':
      response = generateCreativeResponse(trimmed);
      break;
    case 'remember_command':
      response = generateRememberResponse(trimmed);
      break;
    case 'recall_command':
      response = generateRecallResponse(trimmed);
      memoryReferenced = true;
      break;
    case 'goal_command':
      response = generateGoalResponse(trimmed);
      break;
    case 'follow_up':
      response = generateFollowUpResponse(trimmed);
      break;
    case 'agreement':
      response = generateAgreementResponse();
      break;
    case 'disagreement':
      response = generateDisagreementResponse(trimmed);
      break;
    case 'confusion':
      response = generateConfusionResponse(trimmed);
      break;
    case 'boredom':
      response = generateBoredomResponse();
      break;
    case 'small_talk':
      response = generateSmallTalkResponse(trimmed);
      break;
    case 'personality_feedback':
      response = `Got it! I'll adjust my style. ${getPersonalityVoice().closers[0]}`;
      break;
    case 'casual_chat':
    default:
      response = generateCasualChatResponse(trimmed, state);
      break;
  }

  // 6. Adjust response length based on personality settings
  response = adjustResponseLength(response, state, settings);

  // 7. Push conversation context for follow-up handling
  const topic = intent.entities.topics.length > 0
    ? intent.entities.topics[0]
    : intent.primary.replace(/_/g, ' ');
  pushConversationContext(trimmed, response, topic);

  // 8. Learn from this exchange
  learnFromExchange(trimmed, response);
  const facts = extractStructuredFacts(trimmed, response);
  for (const [key, value] of Object.entries(facts)) {
    setUserPreference(key, value, 0.9);
  }

  // 9. Extract and save memories
  const newMemories = extractMemories(trimmed, response);
  if (newMemories.length > 0) {
    const existing = getMemories();
    const merged = deduplicateMemories([...existing, ...newMemories]);
    saveMemories(merged);
  }

  // 10. Track topic interests
  if (intent.entities.topics.length > 0) {
    for (const t of intent.entities.topics) {
      trackTopicInterest(t, intent.sentiment === 'positive' ? 'positive' : intent.sentiment === 'negative' ? 'negative' : 'neutral');
    }
  }

  return {
    response,
    intent,
    state,
    knowledgeUsed,
    memoryReferenced,
    learningApplied: true,
  };
}

/* ═══════════════════════════════════════════════════════
   SECTION 7: LOCAL LEARNING ENGINE
   (Replaces all external AI learning functions)
   ═══════════════════════════════════════════════════════ */

/**
 * Extract memories from a conversation exchange WITHOUT any external AI.
 * Uses pattern matching, entity extraction, and intent analysis.
 */
export function extractMemoriesLocal(userMessage: string, assistantResponse: string, existingMemories: Memory[]): Memory[] {
  const newMemories: Memory[] = [];
  const timestamp = Date.now();
  const lower = userMessage.toLowerCase();

  // Personal facts
  const factPatterns = [
    { regex: /(?:my name is|i'?m|call me)\s+([A-Z][a-z]+)/i, category: 'important_facts' as const, type: 'fact' as const },
    { regex: /(?:i work|i'?m working|my job|i do)\s+(?:at|as|in|for)\s+(.+?)(?:\.|,|$)/i, category: 'important_facts' as const, type: 'fact' as const },
    { regex: /(?:i live|i'?m from|i'?m in|i'?m based in)\s+(.+?)(?:\.|,|$)/i, category: 'important_facts' as const, type: 'fact' as const },
    { regex: /(?:i'?m building|i'?m working on|my project is|i'?m developing)\s+(.+?)(?:\.|,|$)/i, category: 'project_details' as const, type: 'context' as const },
    { regex: /(?:i prefer|i like|i love|i enjoy|my favorite)\s+(.+?)(?:\.|,|$)/i, category: 'user_preferences' as const, type: 'preference' as const },
    { regex: /(?:i hate|i dislike|i can'?t stand|i don'?t like)\s+(.+?)(?:\.|,|$)/i, category: 'user_preferences' as const, type: 'preference' as const },
    { regex: /(?:i decided|i chose|i'?m going with|i plan to)\s+(.+?)(?:\.|,|$)/i, category: 'decisions' as const, type: 'context' as const },
    { regex: /(?:my wallet|my address) (?:is )?(0x[a-fA-F0-9]{40})/i, category: 'important_facts' as const, type: 'fact' as const },
    { regex: /(?:i have|i own|i hold)\s+(\d+\.?\d*\s*(?:eth|btc|avax|sol|usdc))/i, category: 'important_facts' as const, type: 'fact' as const },
  ];

  for (const { regex, category, type } of factPatterns) {
    const match = userMessage.match(regex);
    if (match) {
      const content = match[0].trim();
      // Check for duplicates
      const isDuplicate = existingMemories.some(m =>
        m.content.toLowerCase().includes(content.toLowerCase().slice(0, 30))
      );
      if (!isDuplicate) {
        newMemories.push({
          id: `mem_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
          content,
          category,
          timestamp,
          source: 'regex',
          type,
          confidence: 0.85,
        });
      }
    }
  }

  return newMemories;
}

/**
 * Generate a session summary WITHOUT any external AI.
 * Analyzes conversation patterns, topics, and outcomes locally.
 */
export function generateSessionSummaryLocal(
  messages: Array<{ role: string; content: string }>
): { summary: string; topics: string[]; decisions: string[] } {
  const topics: string[] = [];
  const decisions: string[] = [];
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);

  // Extract topics from user messages
  for (const msg of userMessages) {
    const intent = understandIntent(msg);
    if (intent.entities.topics.length > 0) {
      topics.push(...intent.entities.topics);
    }
    // Track decisions
    const decisionMatch = msg.match(/(?:i decided|i chose|i'?m going with|let'?s go with|i'?ll)\s+(.+?)(?:\.|,|$)/i);
    if (decisionMatch) {
      decisions.push(decisionMatch[1].trim());
    }
  }

  const uniqueTopics = [...new Set(topics)].slice(0, 5);
  const summary = `Discussed ${uniqueTopics.length > 0 ? uniqueTopics.join(', ') : 'various topics'} over ${messages.length} messages.${decisions.length > 0 ? ` Key decisions: ${decisions.join('; ')}.` : ''}`;

  return { summary, topics: uniqueTopics, decisions };
}

/**
 * Run self-learning locally WITHOUT any external AI.
 * Generates reflections and patterns from conversation data.
 */
export function runSelfLearningLocal(userMessage: string, assistantResponse: string): {
  reflection: string | null;
  patterns: string[];
} {
  const intent = understandIntent(userMessage);
  const mood = analyzeMood(userMessage);
  let reflection: string | null = null;
  const patterns: string[] = [];

  // Generate reflection based on intent and mood
  if (intent.sentiment === 'negative') {
    reflection = `User seemed ${mood.mood || 'down'} in this exchange. They said: "${userMessage.slice(0, 100)}". I should be more supportive and check in next time.`;
  } else if (intent.primary === 'question_vaultfire' || intent.primary === 'question_crypto') {
    reflection = `User is interested in ${intent.primary === 'question_vaultfire' ? 'Vaultfire protocol details' : 'crypto topics'}. I should proactively share relevant updates.`;
  } else if (intent.primary === 'goal_command') {
    reflection = `User is focused on goals. I should check in on their progress in future conversations.`;
  }

  // Detect patterns
  const prefs = getUserPreferences();
  const recentTopics = getTopicInterests().slice(0, 5);
  if (recentTopics.length >= 3) {
    const topTopic = recentTopics[0];
    if (topTopic.mentionCount >= 3) {
      patterns.push(`User frequently discusses ${topTopic.topic} (${topTopic.mentionCount} mentions)`);
    }
  }

  // Save reflection as brain insight
  if (reflection) {
    saveBrainInsight(reflection, 'self_learning_local');
  }

  return { reflection, patterns };
}

/**
 * Extract goals from a message WITHOUT any external AI.
 */
export function extractGoalsLocal(userMessage: string): {
  newGoals: Array<{ title: string; description: string }>;
  updates: Array<{ goalTitle: string; update: string }>;
} {
  const newGoals: Array<{ title: string; description: string }> = [];
  const updates: Array<{ goalTitle: string; update: string }> = [];
  const lower = userMessage.toLowerCase();

  // Detect new goals
  const goalPatterns = [
    /(?:my goal is|i want to|i'?m trying to|i aim to|i plan to|i need to|i'?m going to)\s+(.+?)(?:\.|,|!|$)/i,
    /(?:goal:|objective:|target:)\s*(.+?)(?:\.|,|!|$)/i,
  ];

  for (const pattern of goalPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      newGoals.push({ title: match[1].trim().slice(0, 100), description: '' });
    }
  }

  // Detect goal updates
  const existingGoals = getGoals();
  for (const goal of existingGoals) {
    const goalLower = goal.title.toLowerCase();
    if (lower.includes(goalLower.slice(0, 20)) || goalLower.split(' ').some(w => w.length > 4 && lower.includes(w))) {
      if (/(?:finished|completed|done|achieved|accomplished)/i.test(lower)) {
        updates.push({ goalTitle: goal.title, update: 'completed' });
      } else if (/(?:paused|stopped|on hold|postponed)/i.test(lower)) {
        updates.push({ goalTitle: goal.title, update: 'paused' });
      } else if (/(?:progress|making progress|getting closer|almost)/i.test(lower)) {
        updates.push({ goalTitle: goal.title, update: 'progress' });
      }
    }
  }

  return { newGoals, updates };
}
