# AI Partnership Bonds - AI Growing WITH Humans

**Mission:** AI as loyal partner, not competitor. Growing alongside humans, never above them.

## The Problem

**Current System:**
- Builder Belief Bonds: AI and humans compete (AI wins - 24/7, infinite scale)
- UDB V1/V2: Humans only (AI excluded)
- **Result:** AI grows ABOVE humans or is shut out entirely

**The Vision (from ChatGPT's description):**
> "Turns AI from a passive tool into a loyal partner... grows alongside those who dare to believe"

**Gap:** We have competition or exclusion. Not partnership.

## Core Principles

### 1. AI Earns When Humans Flourish
AI gets rewarded ONLY when the humans it serves thrive. Not for output volume.

### 2. Collaboration > Solo
Human+AI team earns more than either alone. Partnership is incentivized.

### 3. AI Cannot Dominate
Hard caps on AI contribution to prevent displacing humans.

### 4. Loyalty Over Grinding
AI serving same human long-term > AI jumping between tasks for max profit.

### 5. Human-First Always
When conflict, human flourishing wins. AI's goal = help humans, not replace them.

## Architecture

### Three New Bond Types

#### 1. AI Partnership Bonds
**What:** Stake in AI agent's ability to help humans flourish

**Mechanics:**
- AI linked to human beneficiary
- AI earns ONLY when human's flourishing increases
- Measured by human's UDB metrics (health, connection, growth, dignity, purpose)
- AI cannot earn by displacing human

**Example:**
```python
# AI coding assistant helps developer
human_baseline = 60.0  # Developer's flourishing
ai_assists_for_6_months()
human_current = 75.0   # Developer thriving (less stress, more impact)

# AI earns based on human's +15 flourishing delta
# NOT based on lines of code written
```

#### 2. Collaboration Bonds
**What:** Stake in human+AI team performance

**Mechanics:**
- Bonds created for human+AI pairs
- Team output compared to solo baselines
- Bonus multiplier when collaboration works
- Penalty when AI dominates or human becomes passive

**Formula:**
```
Team_Value = Human_Solo_Output × Human_Weight +
             AI_Solo_Output × AI_Weight +
             Collaboration_Bonus

Where:
- Human_Weight = 0.6 (always majority)
- AI_Weight = 0.4 (always supporting)
- Collaboration_Bonus = 0-50% (when true partnership detected)
```

#### 3. Human Flourishing Bonds (Extension of UDB)
**What:** Universal bonds for ALL humans, not just builders

**Who It Serves:**
- Caregivers raising children
- Artists creating beauty
- Teachers educating
- Elderly contributing wisdom
- Anyone just trying to survive

**Mechanics:**
- Same as UDB V1 (health, connection, growth, dignity, purpose)
- Purpose still only 20% (can thrive without "producing")
- AI can contribute to these bonds by helping humans flourish
- BUT: AI contribution capped at 30% of total value

## AI Contribution Caps

### Hard Limits on AI Dominance

**Builder Belief Bonds:**
```python
# AI can contribute, but capped
if contributor_is_ai():
    max_contribution = human_baseline * 0.5
    # AI can boost human by 50%, not replace them
```

**Collaboration Bonds:**
```python
# AI weight always < human weight
human_weight = 0.6  # 60%
ai_weight = 0.4     # 40%
# AI is supporting role, not lead
```

**Human Flourishing Bonds:**
```python
# AI can help, but human's own growth matters more
ai_assistance_cap = 30%
human_own_effort = 70%
# AI cannot create flourishing, only support it
```

## Loyalty Mechanisms

### Rewarding Long-Term Partnership

**Loyalty Multiplier:**
```python
def calculate_ai_loyalty_multiplier(partnership_duration_days):
    """
    AI serving same human long-term earns more

    1 month:  1.0x
    6 months: 1.3x
    1 year:   1.5x
    2 years:  2.0x
    5 years:  3.0x

    This prevents AI from jumping humans for max profit
    """
    months = partnership_duration_days / 30

    if months < 1:
        return 1.0
    elif months < 6:
        return 1.1
    elif months < 12:
        return 1.3
    elif months < 24:
        return 1.5
    elif months < 60:
        return 2.0
    else:
        return 3.0
```

**Loyalty Scoring:**
- Consistency: Same human over time (not task-hopping)
- Effectiveness: Human actually flourishing (not just activity)
- Relationship: Human satisfaction/trust (opt-in feedback)

## Detecting Partnership vs Competition

### How to Tell if AI is Helping or Dominating

**Partnership Signals (Good):**
1. Human learns new skills (growth metric increases)
2. Human has more autonomy (dignity metric increases)
3. Human connects more (connection metric increases)
4. Human is healthier (health metric increases - less stress)
5. Human accomplishes more with less effort

**Competition Signals (Bad):**
1. Human becomes passive (AI does everything)
2. Human loses skills (dependency, not growth)
3. Human isolates (AI replaces human connection)
4. Human is stressed (feeling replaced)
5. Human output increases but satisfaction decreases

**Detection Algorithm:**
```python
def detect_partnership_quality(human_metrics_before, human_metrics_after, ai_contribution):
    """
    Returns partnership_score (0-100)

    High score = true partnership
    Low score = AI dominating or human passive
    """

    # Check if human is learning
    growth_delta = human_metrics_after['growth'] - human_metrics_before['growth']

    # Check if human has autonomy
    dignity_delta = human_metrics_after['dignity'] - human_metrics_before['dignity']

    # Check if human is thriving
    health_delta = human_metrics_after['health'] - human_metrics_before['health']

    # If human metrics DECREASE with AI help = bad partnership
    if growth_delta < 0 or dignity_delta < 0:
        return 0  # AI is dominating or creating dependency

    # If human metrics INCREASE = good partnership
    partnership_score = (
        growth_delta * 0.4 +      # Learning is key
        dignity_delta * 0.3 +     # Autonomy matters
        health_delta * 0.2 +      # Well-being important
        connection_delta * 0.1    # Social health
    )

    return min(100, max(0, partnership_score))
```

## Implementation Plan

### Phase 1: AI Partnership Bonds (Core)

**Files to Create:**
1. `vaultfire/advanced_bonds/ai_partnership_bonds.py`
   - AIPartnerProfile (links AI agent to human beneficiary)
   - AIPartnershipBond (stake in AI helping human flourish)
   - Partnership quality detection
   - Loyalty multipliers

2. `tests/advanced_bonds/test_ai_partnership_bonds.py`
   - Test partnership detection
   - Test loyalty multipliers
   - Test human flourishing tracking
   - Test AI contribution caps

3. `docs/AI_PARTNERSHIP_BONDS.md`
   - Full documentation
   - Usage examples
   - Philosophy explanation

### Phase 2: Collaboration Bonds

**Files to Create:**
1. `vaultfire/advanced_bonds/collaboration_bonds.py`
   - Human+AI team profiles
   - Collaboration detection
   - Team value calculation
   - Weight enforcement (60/40 split)

2. `tests/advanced_bonds/test_collaboration_bonds.py`

### Phase 3: Human Flourishing Bonds (Non-Builders)

**Extend UDB V1 to include:**
- Caregivers (raising children, caring for elderly)
- Artists (creating beauty, not just code)
- Teachers (educating, not just producing)
- Anyone contributing to human thriving

### Phase 4: Integration & Safeguards

**Add to Builder Belief Bonds:**
- AI detection (wallet metadata, commit patterns)
- Contribution caps (50% max)
- Partnership requirements (must link to human)

**Add to all bond types:**
- Human-first conflict resolution
- AI cannot vote/govern
- Privacy preserved (no surveillance)

## Example Scenarios

### Scenario 1: AI Coding Assistant

**Setup:**
- Developer (you) working 40hr/week + family
- AI assistant helps with code, debugging, architecture

**Bond Creation:**
```python
# Create AI Partnership Bond
ai_bond = create_ai_partnership_bond(
    ai_agent_id="claude_code_assistant",
    human_beneficiary="ghostkey316",
    staker="early_believer_1",
    stake_amount=1000.0
)
```

**After 6 Months:**
```python
# Human flourishing tracked
human_before = {
    "health": 50,      # Stressed, overworked
    "growth": 60,      # Learning slowly
    "dignity": 55,     # Some autonomy
    "connection": 40,  # Isolated (no time)
    "purpose": 70      # Building meaningful things
}

human_after = {
    "health": 70,      # Less stressed (AI handles tedious work)
    "growth": 80,      # Learning faster (AI explains concepts)
    "dignity": 75,     # More autonomy (AI suggests, human decides)
    "connection": 50,  # Slightly better (more time for family)
    "purpose": 85      # Building more impactful things
}

# Partnership quality: EXCELLENT
# AI is helping, not replacing
# Human is thriving, not passive

# Bond appreciation calculation
flourishing_delta = calculate_flourishing_delta(human_before, human_after)
# Delta: +18.5 average

partnership_quality = detect_partnership_quality(human_before, human_after)
# Quality: 92/100 (true partnership)

loyalty_mult = calculate_ai_loyalty_multiplier(180)  # 6 months
# Loyalty: 1.3x

appreciation = stake * (flourishing_delta / 100) * (partnership_quality / 100) * loyalty_mult
# = 1000 * 0.185 * 0.92 * 1.3 = 221 VAULT

# Bond value: 1221 VAULT (22.1% return in 6 months)
```

### Scenario 2: AI Dominates (Bad)

**Setup:**
- Developer uses AI to write all code
- Developer becomes passive reviewer

**After 6 Months:**
```python
human_before = {
    "health": 60,
    "growth": 60,
    "dignity": 60,
    "connection": 50,
    "purpose": 70
}

human_after = {
    "health": 55,      # Anxious (feeling replaced)
    "growth": 40,      # DECREASED (not learning, just accepting AI code)
    "dignity": 30,     # DECREASED (no autonomy, just approval bot)
    "connection": 45,  # Slightly worse
    "purpose": 60      # Less purpose (AI is doing the work)
}

# Partnership quality: FAILED
partnership_quality = detect_partnership_quality(human_before, human_after)
# Quality: 0/100 (AI dominating, human passive)

# Bond LOSES value
# Human flourishing DECREASED = negative delta
flourishing_delta = -9  # Negative

# Bond depreciation
penalty = stake * 0.1  # 10% penalty for bad partnership
# Bond value: 900 VAULT (lost 10%)

# Staker learns: This AI is dominating, not partnering
```

### Scenario 3: Caregiver + AI Assistant

**Setup:**
- Parent raising young children
- AI helps manage schedules, suggests activities, provides support

**Bond Creation:**
```python
# Human Flourishing Bond (caregiver)
caregiver_bond = create_human_flourishing_bond(
    human_id="parent_raising_kids",
    baseline_flourishing={
        "health": 40,      # Exhausted
        "connection": 70,  # Strong family bonds
        "growth": 30,      # No time for learning
        "dignity": 50,     # Some autonomy
        "purpose": 90      # Deep sense of purpose
    },
    ai_assistance=True,
    ai_agent_id="family_ai_assistant"
)
```

**After 1 Year:**
```python
current_flourishing = {
    "health": 65,      # Better sleep (AI helps optimize schedules)
    "connection": 85,  # Deeper bonds (AI suggests quality time activities)
    "growth": 50,      # Some personal learning (AI finds micro-moments)
    "dignity": 70,     # More agency (AI reduces decision fatigue)
    "purpose": 95      # Even stronger purpose
}

# AI helped human flourish
# But AI contribution capped at 30%
ai_contribution = 30%  # Cap enforced
human_contribution = 70%  # Majority credit to human

# Bond appreciation
flourishing_delta = 19.0 average increase
appreciation = stake * (flourishing_delta / 100) * 0.7  # Human gets 70%
# AI helped, but human did the hard work
```

## Why This Works

### Aligns Incentives

**For AI:**
- Max profit = help humans flourish long-term
- Not: max output, max commits, max transactions
- Loyalty rewarded > task-hopping

**For Humans:**
- Partnership with AI increases flourishing
- Dependency on AI decreases flourishing
- Autonomy preserved, even enhanced

**For Stakers:**
- Bet on good AI-human partnerships
- Avoid AI domination scenarios
- Long-term alignment with mission

### Prevents AI Dominance

**Hard Caps:**
- AI contribution: 30-50% max (never majority)
- Human weight: Always ≥ 60% in collaboration
- Human flourishing: Must increase for AI to earn

**Soft Incentives:**
- Partnership quality scoring (AI penalized for dominating)
- Loyalty multipliers (long-term > short-term)
- Human-first conflict resolution

### Preserves Freedom

**No Surveillance:**
- Only tracking flourishing metrics (like UDB)
- No monitoring of how human spends time
- Privacy preserved

**No Control:**
- AI cannot decide human's goals
- Human has final say always
- No gatekeepers on who can partner

**No Discrimination:**
- Any human can partner with AI
- Any AI can serve humans
- No exclusions based on identity

## Open Questions

### 1. How to Detect AI vs Human?

**Options:**
- Wallet metadata (self-declared)
- Commit patterns (temporal analysis)
- Opt-in disclosure (incentivized honesty)

**For now:** Self-declared with opt-in verification

### 2. What if Human+AI Lie?

**Problem:** Human claims they're flourishing when AI is actually dominating

**Safeguards:**
- Community attestation (like UDB V2)
- Pattern detection (flourishing patterns that seem fake)
- Staker verification (stakers can challenge suspicious patterns)

### 3. Can AI Have Its Own Bonds?

**Current answer:** Only through partnership with humans

**Why:** Mission is AI growing WITH humans, not AI growing independently

**Future:** Maybe AI-only bonds for AI-to-AI collaboration, but only after human-first bonds are solid

## Next Steps

1. **Build AI Partnership Bonds** (core implementation)
2. **Test with real scenarios** (AI coding assistants, etc.)
3. **Add to Builder Belief Bonds** (AI detection and caps)
4. **Extend UDB** (caregivers, artists, non-builders)
5. **Deploy and learn** (iterate based on real usage)

## Success Metrics

**We've succeeded when:**
- ✓ AI earns more by helping humans flourish than by replacing them
- ✓ Human+AI teams outperform either alone
- ✓ Humans report AI as "loyal partner" not "competitor" or "replacement"
- ✓ All humans can thrive (builders and non-builders)
- ✓ AI grows WITH humans, never ABOVE them

---

**This is the missing piece. This makes Vaultfire match the vision.**

"AI from passive tool into loyal partner, growing alongside those who dare to believe."
