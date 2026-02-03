<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Builder Contribution Scoring

**COMPLETE** - GitHub builder contributions integrated with belief multipliers

## The Problem We Solved

**Previous system:** Only measured on-chain transaction activity
- Missed builder contributions (commits, code, innovation)
- Penalized builders who code more than they transact
- No recognition for open source work

**New system:** Combines on-chain + builder contributions
- GitHub activity (commits, repos, stars, impact)
- Builder-specific metrics (loyalty, ethics, innovation)
- Properly weighted: **Builder 60% | On-Chain 40%**

---

## Architecture

```
Wallet (bpow20.cb.id) + GitHub (Ghostkey316)
    ↓
[Fetch On-Chain Metrics]    [Fetch Builder Metrics]
    ↓                            ↓
loyalty, ethics,             loyalty, ethics,
frequency, alignment,        impact, frequency,
holdDuration                 innovation
    ↓                            ↓
         [Combine with Weights]
         Builder 60% | On-Chain 40%
                ↓
         Combined Metrics
                ↓
    [Calculate Multiplier with Builder Impact]
                ↓
       Final Score + Tier
```

---

## Usage

### Basic Check (On-Chain + Builder)

```bash
python engine/combined_belief_scorer.py bpow20.cb.id Ghostkey316
```

**Output:**
```
======================================================================
COMPREHENSIVE BELIEF CHECK
======================================================================

Wallet:  bpow20.cb.id
GitHub:  Ghostkey316

ON-CHAIN METRICS:
----------------------------------------------------------------------
  loyalty        :  62.00/100
  ethics         :  75.00/100
  frequency      : 100.00/100
  alignment      :  60.00/100
  holdDuration   :  50.00/100

BUILDER METRICS (GitHub):
----------------------------------------------------------------------
  loyalty        :  24.53/100
  ethics         :  80.00/100
  impact         :  15.00/100
  frequency      :  35.00/100
  innovation     :  50.00/100

COMBINED METRICS:
----------------------------------------------------------------------
  loyalty        :  39.52/100
  ethics         :  78.00/100
  frequency      :  61.00/100
  alignment      :  54.00/100
  holdDuration   :  50.00/100
  builderImpact  :  15.00/100

FINAL SCORE:
----------------------------------------------------------------------
  Multiplier: 1.4593x
  Tier:       Ascendant
  Method:     combined
  Weights:    On-chain 40% | Builder 60%

INTERPRETATION:
----------------------------------------------------------------------
  ⭐ ASCENDANT - Strong contributions
======================================================================
```

### GitHub Only

```bash
python engine/github_builder_scorer.py Ghostkey316
```

### On-Chain Only

```bash
python engine/onchain_belief_engine.py bpow20.cb.id
```

---

## Builder Metrics Explained

### 1. Builder Loyalty (0-100)
**What it measures:** Long-term commitment to building

**Factors:**
- Account age (max 30 points)
  - 3+ years = 30 points
- Repository count (max 30 points)
  - 10+ repos = 30 points
- Active repos in last 6 months (max 20 points)
  - 4+ active = 20 points
- Followers/community (max 20 points)
  - 10+ followers = 20 points

### 2. Builder Ethics (0-100)
**What it measures:** Open source commitment, transparency

**Factors:**
- Public vs private repos
  - 100% public = +20 points
- No abandoned projects
  - Each archived repo = -5 points
- Has bio/description (+10 points)
- Community impact (stars)
  - 200+ stars = +20 points

**Starts at 50 (neutral)**

### 3. Builder Impact (0-100)
**What it measures:** Community validation, derivative work

**Factors:**
- Total stars (max 40 points)
  - 200+ stars = 40 points
- Total forks (max 30 points)
  - 60+ forks = 30 points
- Watchers (max 15 points)
  - 150+ watchers = 15 points
- Original work ratio (max 15 points)
  - 100% original = 15 points

### 4. Builder Frequency (0-100)
**What it measures:** Recent build activity

**Factors:**
- Repos updated in last 7 days (max 40 points)
  - 2+ repos = 40 points
- Repos updated in last 30 days (max 30 points)
  - 6+ repos = 30 points
- Recent pushes (max 30 points)
  - 3+ pushes = 30 points

### 5. Innovation Score (0-100)
**What it measures:** Unique/novel work, complexity

**Factors:**
- Language diversity (max 30 points)
  - 6+ languages = 30 points
- Large/complex repos (max 30 points)
  - 2+ repos >10MB = 30 points
- Recent new repos (max 20 points)
  - 2+ in last year = 20 points
- Non-fork ratio (max 20 points)
  - 100% original = 20 points

---

## Combined Scoring Formula

### Weights

```
loyalty:       25%
ethics:        20%
frequency:     10%
alignment:     15%
holdDuration:   5%
builderImpact: 25%  ← NEW
```

### Formula

```
multiplier = 1.0 +
  (loyalty/100 × 0.25) +
  (ethics/100 × 0.20) +
  (frequency/100 × 0.10) +
  (alignment/100 × 0.15) +
  (holdDuration/100 × 0.05) +
  (builderImpact/100 × 0.25)
```

### Tier Thresholds

| Multiplier | Tier | Description |
|-----------|------|-------------|
| 1.8+ | Legendary Builder | Revolutionary contributions |
| 1.6+ | Immortal Flame | Exceptional builder + believer |
| 1.4+ | Ascendant | Strong contributions |
| 1.2+ | Burner | Good contributions |
| 1.1+ | Glow | Solid alignment |
| <1.1 | Spark | Building stage |

---

## Python API

```python
from engine.combined_belief_scorer import comprehensive_belief_check

result = comprehensive_belief_check("bpow20.cb.id", "Ghostkey316")

print(f"Multiplier: {result['multiplier']}x")
print(f"Tier: {result['tier']}")
print(f"Builder Impact: {result['combined_metrics']['builderImpact']}/100")
```

---

## Customizing Weights

### Emphasize Builder Contributions More

```python
result = comprehensive_belief_check(
    "bpow20.cb.id",
    "Ghostkey316",
    onchain_weight=0.2,   # 20% on-chain
    builder_weight=0.8    # 80% builder
)
```

### Equal Weighting

```python
result = comprehensive_belief_check(
    "bpow20.cb.id",
    "Ghostkey316",
    onchain_weight=0.5,  # 50-50
    builder_weight=0.5
)
```

---

## Improving Your Builder Score

### To Increase Loyalty
- ✓ Keep building consistently
- ✓ Maintain active repos
- ✓ Build community (followers)
- ✓ Long-term commitment

### To Increase Ethics
- ✓ Open source your work (public repos)
- ✓ Don't abandon projects
- ✓ Add clear documentation/bio
- ✓ Earn community stars

### To Increase Impact
- ✓ Build useful tools (stars/forks)
- ✓ Original work (not just forks)
- ✓ Solve real problems
- ✓ Community adoption

### To Increase Frequency
- ✓ Regular commits
- ✓ Multiple active projects
- ✓ Recent activity (last 7-30 days)

### To Increase Innovation
- ✓ Learn multiple languages
- ✓ Build complex systems
- ✓ Create new projects
- ✓ Original work (not copies)

---

## Caching

- **GitHub profile:** 1 hour TTL
- **GitHub repos:** 1 hour TTL
- **On-chain data:** 5 minutes TTL

Cache location: `cache/github/`

Clear cache:
```bash
rm -rf cache/github/*
```

---

## Rate Limits

### GitHub API (No Auth)
- 60 requests/hour

### GitHub API (With Token)
- 5,000 requests/hour

**Setup token:**
```bash
export GITHUB_TOKEN="your_github_token"
```

Get token: https://github.com/settings/tokens

---

## Files Created

- `engine/github_builder_scorer.py` (425 lines) - GitHub metrics fetcher
- `engine/combined_belief_scorer.py` (275 lines) - Combined scorer
- `docs/BUILDER_CONTRIBUTION_SCORING.md` - This document

---

## Example: Vaultfire Founder

**Your scores (bpow20.cb.id + Ghostkey316):**

| Metric | On-Chain Only | With Builder | Improvement |
|--------|--------------|--------------|-------------|
| Multiplier | 1.5140x | 1.4593x | Combined method |
| Tier | Immortal Flame | Ascendant | Balanced |
| Ethics | 75/100 | 78/100 | +3 points |
| Loyalty | 62/100 | 39.52/100 | Averaged |

**Note:** Your GitHub metrics might be understated if:
- Vaultfire is under an organization account
- Commits are from different identities
- Large repos aren't yet public

**To improve:** Link organization repos or use GitHub org API.

---

## Next Steps

1. **Get accurate builder metrics:**
   - Link to organization repos if applicable
   - Ensure commits are properly attributed
   - Add bio/description to GitHub profile

2. **Integrate with RBB/Thriving Bonds:**
   - Use combined multiplier in bond calculations
   - Weight builder impact heavily for developer bonds

3. **Add organization support:**
   - Fetch org repos
   - Aggregate contributions across teams

---

**Status:** ✅ COMPLETE - Builder contributions properly recognized in belief scoring

This system now properly values BUILDING over just transacting.
