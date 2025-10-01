# Streaming Rewards

Vaultfire's loyalty engine calculates participant multipliers and the reward stream
planner maps those multipliers to the on-chain streaming contract. The latest
integration wires contribution events directly into the stream planner so the token
flow reflects real-time participation.

## Components
- **Loyalty Engine (`services/loyaltyEngine.js`)** – tracks behaviour scores and
  combines them with on-chain multipliers.
- **Reward Stream Planner (`services/rewardStreamPlanner.js`)** – prepares the base
  rate and loyalty metrics, simulates contract outcomes, and dispatches updates to
  the streaming contract or mock interface.
- **Contract Interface (`src/rewards/contractInterface.js`)** – provides a mockable
  interface for development environments when a full RPC provider is not available.

## Contribution Triggers
- The Partner API calls `rewardStreamPlanner.applyContribution()` whenever reward
  views or contribution events occur.
- When `trustSync.rewards.stream.autoDistribute` is enabled, the planner sends the
  multiplier update to the configured streaming contract. In development, the mock
  interface records the multiplier and transaction hash for testing.
- Telemetry events (`rewards.stream.preview`, `rewards.stream.applied`,
  `rewards.stream.fallback`) capture the multiplier, partner, and transaction hash
  so operators have a full audit trail.

## DAO & Mock Support
- The planner accepts an injected contract interface which defaults to the mock
  `RewardContractInterface`. Production deployments can supply an `ethers`
  contract instance pointing at the real streaming contract.
- DAO reward multipliers defined in `dao_reward_config.json` can be replayed by
  iterating over the JSON and calling `applyContribution()` for each wallet.

## Operational Guidance
- Keep `fallbackMultiplier` updated to the minimum guaranteed emission so mock
  environments behave predictably.
- Monitor telemetry for `rewards.stream.applied` events to ensure contribution
  events are wiring through to the contract.
- Use the CLI script in `rewards/stream.js` to simulate manual streams or to verify
  on-chain contract behaviour against the planner output.
