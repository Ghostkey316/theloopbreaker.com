# Ethics Scoring Specification

**Opus Feedback:** "The ethics scoring inputs tightened (what exactly counts as ethical on-chain behavior)"

This document defines EXPLICIT rules for what counts as ethical vs unethical on-chain behavior. No fuzzy logic. Clear thresholds. Detectable patterns.

## Current State (Loose)

```python
ethics = 50.0  # Start neutral

# No failed transactions
if failed_txs == 0:
    ethics += 10.0

# Contract interactions > 5
if contract_txs > 5:
    ethics += 15.0

# Has outgoing transactions
if outgoing_txs > 0:
    ethics += 10.0
```

**Problems:**
- Doesn't detect malicious behavior
- Doesn't detect wash trading
- Doesn't detect MEV exploitation
- Doesn't detect Sybil attacks
- Doesn't detect airdrop farming
- Too easy to game

## New Spec (Tightened)

### Penalties (Negative Points)

| Pattern | Detection | Points | Max | Reason |
|---------|-----------|--------|-----|--------|
| **Failed Transactions** | `isError == "1"` | -5 per failure | -20 | Possible exploit attempts |
| **Wash Trading** | Same value sent 5+ times | -15 | -15 | Circular transfers to inflate volume |
| **Bot Pattern** | 20+ txs in < 1 hour | -10 | -10 | Automated trading/MEV bot |
| **Airdrop Farmer** | Only incoming (10+), zero outgoing | -15 | -15 | Farming without participation |

### Bonuses (Positive Points)

| Behavior | Detection | Points | Reason |
|----------|-----------|--------|--------|
| **Clean Record** | Zero failures with 5+ txs | +10 | Consistent successful transactions |
| **DeFi Usage** | 5+ contract interactions | +15 | Active DeFi participation |
| **Balanced Activity** | Send/receive ratio > 30% | +10 | Bidirectional activity (not one-way) |
| **Long-term Presence** | Wallet age > 180 days | +5 | Long-term ecosystem commitment |
| **Consistent Activity** | Low variance in tx timing | +5 | Organic usage (not burst trading) |

### Formula

```
Ethics = 50 (base)
       - penalties (0 to -60)
       + bonuses (0 to +50)
       = 0 to 100 final score
```

## Implementation Status

**Completed:**
- ✓ `engine/ethics_scoring.py` - Tightened scoring logic
- ✓ `calculate_tightened_ethics_score()` - Main function
- ✓ `explain_ethics_score()` - Human-readable breakdown
- ✓ `ETHICS_RULES` - Documented rules for auditing

**Blocked:**
- ✗ Need Blockscout integration (not in current branch)
- ✗ Currently only getting 1 tx from RPC fallback
- ✗ Can't apply tightened scoring without full tx history

## Example Output

```
Ethics Score: 85.00/100

Calculation:
  • Base score: 50/100

  Bonuses:
    + No failed transactions (clean on-chain behavior): +10.0 points
    + Using DeFi protocols (7 contract interactions): +15.0 points
    + Balanced send/receive activity (not one-directional): +10.0 points

  Final: 85.00/100

  🟢 EXCELLENT - Highly ethical on-chain behavior
```

## Integration Path

### Step 1: Re-add Blockscout Integration

From previous session (needs to be committed):

```python
BLOCKSCOUT_API_URL = "https://base.blockscout.com/api/v2"

def fetch_transactions(address: str, limit: int = 100):
    # Try Blockscout API first (free, no key needed)
    try:
        url = f"{BLOCKSCOUT_API_URL}/addresses/{address}/transactions"
        response = requests.get(url, timeout=15)
        data = response.json()

        if "items" in data:
            # Transform Blockscout format...
            for item in data["items"][:limit]:
                # Convert timestamp, map fields...
```

### Step 2: Replace Old Ethics Calculation

In `engine/base_chain_fetcher.py`:

```python
# OLD (lines 161-196)
def calculate_ethics_score(transactions, address):
    ethics = 50.0
    if failed_txs == 0:
        ethics += 10.0
    # ...

# NEW
from engine.ethics_scoring import calculate_tightened_ethics_score

def calculate_ethics_score(transactions, address):
    score, breakdown = calculate_tightened_ethics_score(transactions, address)
    return score
```

### Step 3: Update Documentation

Add breakdown to `get_belief_metrics()` return value:

```python
return {
    "loyalty": loyalty,
    "ethics": ethics,
    "ethics_breakdown": breakdown,  # NEW
    "frequency": frequency,
    # ...
}
```

## Future Enhancements

### Known Malicious Contracts

Build database of known scam contracts:

```python
KNOWN_SCAMS = {
    "0xBadContract123": "rug_pull",
    "0xScamToken456": "ponzi",
}

# Penalty: -50 (severe) for any interaction
```

### MEV Detection

Detect sandwich attacks, frontrunning:

```python
# Check for:
# - Same block bundle transactions
# - Large price impact txs
# - Flash loan patterns
```

### Governance Participation

Bonus for DAO voting:

```python
# Detect:
# - Snapshot votes (off-chain)
# - On-chain governance txs
# Bonus: +10 for active governance
```

## Testing

Test with different wallet types:

```bash
python engine/ethics_scoring.py
```

Expected results:
- **Clean DeFi user:** 75-90/100
- **Airdrop farmer:** 30-40/100
- **MEV bot:** 20-35/100
- **Normal user:** 50-70/100

## Why This Matters

**Freedom Protocol Principle:** Objective, verifiable ethics

- ✓ No human judgment required
- ✓ Clear rules, public code
- ✓ Can't be gamed (blockchain doesn't lie)
- ✓ Privacy preserved (only analyzing public txs)
- ✓ No surveillance (just pattern detection)

**What It Prevents:**

- Sybil attacks getting high scores
- Wash traders inflating metrics
- Airdrop farmers gaming the system
- MEV bots pretending to be users
- Malicious actors getting belief multipliers

**What It Rewards:**

- Legitimate DeFi usage
- Long-term ecosystem participation
- Balanced, organic activity
- Clean transaction history
- Consistent engagement

## Commit Checklist

When implementing:

- [ ] Re-add Blockscout integration (from previous session)
- [ ] Integrate `ethics_scoring.py` into `base_chain_fetcher.py`
- [ ] Update tests to verify tightened scoring
- [ ] Test with multiple wallet types (clean, farmer, bot)
- [ ] Document changes in CHANGELOG
- [ ] Update `onchain_belief_engine.py` to show breakdown

## Related Files

- `engine/ethics_scoring.py` - Tightened scoring logic (NEW)
- `engine/base_chain_fetcher.py` - Needs integration
- `engine/onchain_belief_engine.py` - Main entry point
- `tests/test_belief_score.py` - Add tightened tests

---

**Status:** Spec complete, implementation blocked on Blockscout integration

**Next Action:** Re-add Blockscout from previous session, then integrate tightened ethics
