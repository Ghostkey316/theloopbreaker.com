# Comprehensive Belief Scoring System V2

## Overview

The **Comprehensive Belief Scorer** integrates FOUR data sources to create a holistic measure of builder value and belief alignment:

1. **On-Chain Activity** (Base mainnet)
2. **GitHub Builder Contributions** (commits, repos, activity)
3. **Enhanced GitHub** (revolutionary contributions, innovation signals)
4. **X/Twitter Social Proof** (engagement, thought leadership)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Comprehensive Belief Scorer V2                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  On-Chain    │  │   GitHub     │  │  X/Twitter   │      │
│  │  (20%)       │  │   (70%)      │  │  (10%)       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         │                  ├─ Builder (40%)   │             │
│         │                  └─ Enhanced (30%)  │             │
│         │                                     │             │
│         └─────────────┬─────────────┬─────────┘             │
│                       │             │                       │
│                  ┌────▼─────────────▼────┐                  │
│                  │  Combined Metrics     │                  │
│                  │  8 Dimensions         │                  │
│                  └────────────────────────┘                 │
│                            │                                │
│                  ┌─────────▼──────────┐                     │
│                  │  Belief Multiplier  │                    │
│                  │  1.0 - 2.0x         │                    │
│                  └─────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Data Sources

### 1. On-Chain Activity (20% weight)

**Source:** `engine/base_chain_fetcher.py`

Metrics:
- **Loyalty** - Transaction consistency, network participation
- **Ethics** - Clean transaction history, no failed scams
- **Frequency** - Recent activity (7d/30d)
- **Alignment** - Partner contract interactions
- **Hold Duration** - Wallet age

### 2. GitHub Builder Contributions (40% weight)

**Source:** `engine/github_builder_scorer.py`

Metrics:
- **Loyalty** - Account age, repo count, sustained contribution
- **Ethics** - Public repos, no abandonment, transparency
- **Impact** - Stars, forks, community validation
- **Frequency** - Recent commits and updates
- **Innovation** - Language diversity, complexity, originality

### 3. Enhanced GitHub Analysis (30% weight)

**Source:** `engine/github_enhanced_scorer.py`

Metrics:
- **Revolutionary Score** - Innovation keywords, novel mechanisms, unprecedented systems
- **Technical Depth** - Systems-level work, protocol building, infrastructure
- **Originality** - Non-fork repos, unique approaches, advanced languages

Innovation Keywords Detected:
```
revolutionary, unprecedented, never-before-seen, first-ever,
zero-knowledge, zk-snark, privacy-preserving,
economic-equality, universal-dignity, belief-bonds,
homomorphic, post-quantum, self-sovereign, decentralized
```

### 4. X/Twitter Social Proof (10% weight)

**Source:** `engine/twitter_social_scorer.py`

Metrics:
- **Loyalty** - Account age, follower count, sustained presence
- **Impact** - Engagement, viral content, community reach
- **Leadership** - Original content, verified status, thought leadership
- **Frequency** - Recent activity, consistency

## Combined Metrics (8 Dimensions)

The comprehensive scorer combines all sources into **8 belief dimensions**:

1. **Loyalty** (20% weight)
   - Composite of all sources
   - Revolutionary contributions + technical depth emphasized

2. **Ethics** (15% weight)
   - Behavior + open source commitment + thought leadership

3. **Frequency** (10% weight)
   - Activity across all platforms

4. **Alignment** (15% weight)
   - Innovation + ecosystem participation + revolutionary work

5. **Hold Duration** (5% weight)
   - Wallet age (on-chain only)

6. **Builder Impact** (20% weight) ⭐ NEW
   - GitHub impact + technical depth + revolutionary score

7. **Revolutionary Score** (10% weight) ⭐ NEW
   - Enhanced GitHub revolutionary + builder innovation + social leadership

8. **Social Impact** (5% weight) ⭐ NEW
   - X/Twitter community reach and influence

## Tier System

| Multiplier | Tier | Description |
|------------|------|-------------|
| 1.9+ | 🚀 **Legendary Builder** | Unprecedented revolutionary contributions |
| 1.7 - 1.9 | 💎 **Revolutionary** | Groundbreaking innovations |
| 1.5 - 1.7 | 🔥 **Immortal Flame** | Exceptional builder + believer |
| 1.3 - 1.5 | ⭐ **Ascendant** | Strong contributions |
| 1.15 - 1.3 | ✓ **Burner** | Good contributions |
| 1.05 - 1.15 | ○ **Glow** | Active participation |
| < 1.05 | · **Spark** | Early stage |

## Usage

### Basic Usage

```bash
python engine/comprehensive_belief_scorer.py <wallet_id> [github_username] [x_username]
```

### Examples

```bash
# On-chain only
python engine/comprehensive_belief_scorer.py bpow20.cb.id

# On-chain + GitHub
python engine/comprehensive_belief_scorer.py bpow20.cb.id Ghostkey316

# All three sources
python engine/comprehensive_belief_scorer.py bpow20.cb.id Ghostkey316 ghostkey316
```

### Programmatic Usage

```python
from engine.comprehensive_belief_scorer import comprehensive_belief_check

result = comprehensive_belief_check(
    wallet_id="bpow20.cb.id",
    github_username="Ghostkey316",
    x_username="ghostkey316"
)

print(f"Multiplier: {result['multiplier']}x")
print(f"Tier: {result['tier']}")
```

## Setup Requirements

### 1. Wallet Mapping

Map Coinbase IDs to Ethereum addresses:

```bash
python scripts/setup_wallet_mapping.py bpow20.cb.id 0xYourAddress
```

### 2. GitHub (Optional)

GitHub API works without token but has rate limits. For higher limits:

```bash
export GITHUB_TOKEN="ghp_YourTokenHere"
```

Get token at: https://github.com/settings/tokens

### 3. X/Twitter (Optional)

Required for social proof metrics:

```bash
export X_BEARER_TOKEN="YourBearerTokenHere"
```

Get token at: https://developer.twitter.com/en/portal/dashboard

## Output Example

```
======================================================================
COMPREHENSIVE BELIEF CHECK
======================================================================

Wallet:  bpow20.cb.id
GitHub:  Ghostkey316
X:       @ghostkey316

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

ENHANCED GITHUB METRICS:
----------------------------------------------------------------------
  revolutionary  :  39.49/100
  technical_depth:  10.00/100
  originality    :  58.00/100

SOCIAL METRICS (X/Twitter):
----------------------------------------------------------------------
  loyalty        :  75.00/100
  impact         :  60.00/100
  leadership     :  55.00/100
  frequency      :  40.00/100

COMBINED METRICS:
----------------------------------------------------------------------
  loyalty        :  45.20/100
  ethics         :  72.50/100
  frequency      :  55.30/100
  alignment      :  58.75/100
  holdDuration   :  50.00/100
  builderImpact  :  35.60/100
  revolutionaryScore: 48.20/100
  socialImpact   :  60.00/100

FINAL SCORE:
----------------------------------------------------------------------
  Multiplier: 1.5234x
  Tier:       Immortal Flame
  Method:     comprehensive

INTERPRETATION:
----------------------------------------------------------------------
  🔥 IMMORTAL FLAME - Exceptional builder + believer

======================================================================
```

## Customizing Weights

You can customize the weighting of data sources:

```python
custom_weights = {
    "onchain": 0.10,   # Lower weight for transactions
    "builder": 0.50,   # Higher weight for actual code
    "enhanced": 0.30,  # Revolutionary contributions
    "social": 0.10     # Community impact
}

result = comprehensive_belief_check(
    wallet_id="bpow20.cb.id",
    github_username="Ghostkey316",
    x_username="ghostkey316",
    weights=custom_weights
)
```

## Files

- `engine/comprehensive_belief_scorer.py` - Main integration
- `engine/base_chain_fetcher.py` - On-chain data (Base)
- `engine/github_builder_scorer.py` - GitHub activity
- `engine/github_enhanced_scorer.py` - Revolutionary detection
- `engine/twitter_social_scorer.py` - Social proof

## Caching

All data sources use caching:

- **GitHub API**: 1 hour TTL
- **Base transactions**: 5 minutes TTL
- **X/Twitter API**: 30 minutes TTL

Cache location: `cache/` directory

## Integration with Vaultfire

This comprehensive scorer can be integrated into:

1. **Universal Dignity Bonds** - Proper recognition of builder contributions
2. **Belief Multiplier** - Real data feeding the multiplier calculation
3. **Partner Protocol** - Fair scoring for ecosystem participants

## Future Enhancements

Potential improvements:

1. **Code Analysis** - Parse actual code to detect complexity patterns
2. **Commit Quality** - Analyze commit messages and diff sizes
3. **Network Effects** - Track collaborative contributions
4. **Long-term Impact** - Weight older, sustained projects higher
5. **Cross-chain** - Support Ethereum, Polygon, Arbitrum

## Philosophy

This system recognizes that **building > transacting**:

- GitHub contributions weighted 70% (builder 40% + enhanced 30%)
- On-chain activity only 20%
- Social proof adds 10% for thought leadership

The goal: **Recognize real builder value, not just wallet activity.**
