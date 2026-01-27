# Vaultfire Protocol - Operations Guide

**Version:** 1.0
**Last Updated:** 2026-01-27
**Status:** Production Ready

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Deployment Procedures](#deployment-procedures)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Incident Response](#incident-response)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Security Operations](#security-operations)
8. [Troubleshooting](#troubleshooting)
9. [Emergency Procedures](#emergency-procedures)
10. [Appendix](#appendix)

---

## 1. Introduction

### Purpose

This operations guide provides comprehensive instructions for deploying, monitoring, maintaining, and troubleshooting the Vaultfire Protocol in production environments.

### Audience

- DevOps Engineers
- Site Reliability Engineers (SREs)
- Protocol Administrators
- On-Call Engineers

### Prerequisites

**Technical Skills:**
- Ethereum/smart contract operations
- Node.js and JavaScript
- Linux/Unix system administration
- Monitoring and alerting systems

**Tools Required:**
- Hardhat for smart contract deployment
- Node.js (v18+) for monitoring scripts
- PM2 for process management
- Etherscan API access
- Monitoring platform (Grafana/Datadog recommended)

---

## 2. System Architecture

### Components Overview

```
┌─────────────────────────────────────────────────┐
│         Vaultfire Protocol Infrastructure       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Smart Contracts (Base Blockchain)             │
│  ├── AIPartnershipBondsV2                      │
│  ├── AIAccountabilityBondsV2                   │
│  ├── BeliefAttestationVerifierProduction       │
│  ├── PrivacyGuarantees                         │
│  └── MissionEnforcement                        │
│                                                 │
│  Off-Chain Services                            │
│  ├── Monitoring Service (protocol-monitor.js)  │
│  ├── Event Indexer (subgraph/custom)          │
│  ├── API Server (sdk/api-server.ts)           │
│  └── RISC Zero Prover (risc0-prover/)         │
│                                                 │
│  External Dependencies                          │
│  ├── Base RPC Endpoints                        │
│  ├── RISC Zero Verifier Contract               │
│  ├── Chainlink Oracles (optional)              │
│  └── UMA Protocol (optional)                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Network Configuration

**Base Mainnet:**
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Block Explorer: https://basescan.org

**Base Sepolia (Testnet):**
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Block Explorer: https://sepolia.basescan.org

---

## 3. Deployment Procedures

### 3.1 Pre-Deployment Checklist

#### Smart Contract Preparation

- [ ] All contracts compiled without warnings
- [ ] All tests passing (100% suite)
- [ ] Gas optimization completed
- [ ] Security audit completed
- [ ] Environment variables configured
- [ ] Deployment wallet funded (minimum 0.1 ETH)
- [ ] Backup RPC endpoints configured
- [ ] Multisig wallet prepared (Gnosis Safe)

#### RISC Zero Configuration

- [ ] RISC Zero verifier deployed or located
- [ ] Guest program compiled (`cargo build --release`)
- [ ] Image ID extracted and documented
- [ ] Test proofs generated and validated
- [ ] Bonsai API key configured (if using)

#### Infrastructure Preparation

- [ ] Monitoring infrastructure deployed
- [ ] Alert channels configured (Slack/Discord/PagerDuty)
- [ ] Backup procedures tested
- [ ] Runbook reviewed by team
- [ ] On-call rotation established

### 3.2 Deployment Steps

#### Step 1: Deploy Core Infrastructure

```bash
# 1. Set environment variables
cp .env.example .env
nano .env  # Configure all required variables

# 2. Deploy BaseYieldPoolBond dependencies
npx hardhat run scripts/deploy-mainnet.js --network base

# 3. Verify deployment on Basescan
npx hardhat verify --network base <CONTRACT_ADDRESS>
```

#### Step 2: Deploy RISC Zero Verifier

```bash
# 1. Compile guest program
cd risc0-prover
cargo build --release

# 2. Extract image ID
# Located in: target/release/methods/BELIEF_ATTESTATION_ID

# 3. Deploy production verifier
cd ..
npx hardhat run scripts/deploy-production-verifier.js --network base

# 4. Verify on Basescan
npx hardhat verify --network base \
    <VERIFIER_ADDRESS> \
    <RISC_ZERO_VERIFIER_ADDRESS> \
    <IMAGE_ID>
```

#### Step 3: Deploy Partnership Bonds

```bash
npx hardhat run scripts/deploy-ai-partnership.js --network base
```

#### Step 4: Deploy Accountability Bonds

```bash
# Note: Requires human treasury address (multisig)
npx hardhat run scripts/deploy-ai-accountability.js --network base
```

#### Step 5: Verify Deployment

```bash
# Run comprehensive deployment verification
npx hardhat run scripts/verify-deployment.js --network base

# Expected output:
# ✅ All contracts deployed
# ✅ All contracts verified on Basescan
# ✅ Protocol health: Healthy
# ✅ RISC Zero integration: Connected
# ✅ Human treasury: Configured
```

### 3.3 Post-Deployment

#### Update Configuration

```bash
# Update production environment file
nano .env.production

# Add deployed contract addresses:
PARTNERSHIP_BONDS_ADDRESS=0x...
ACCOUNTABILITY_BONDS_ADDRESS=0x...
BELIEF_VERIFIER_ADDRESS=0x...
HUMAN_TREASURY_ADDRESS=0x...
```

#### Start Monitoring

```bash
# Start monitoring service with PM2
pm2 start monitoring/protocol-monitor.js --name vaultfire-monitor
pm2 save
pm2 startup  # Enable auto-start on reboot

# View logs
pm2 logs vaultfire-monitor
```

#### Fund Yield Pool

```bash
# Fund initial yield pool (recommended: 50 ETH)
npx hardhat run scripts/fund-yield-pool.js --network base
```

#### Smoke Test

```bash
# Create test bond (small amount)
npx hardhat run scripts/test-bond-creation.js --network base

# Verify bond creation in monitoring logs
pm2 logs vaultfire-monitor
```

---

## 4. Monitoring & Alerting

### 4.1 Key Metrics

#### Protocol Health Metrics

| Metric | Description | Warning Threshold | Critical Threshold |
|--------|-------------|-------------------|-------------------|
| Yield Pool Balance | Total ETH in yield pool | < 2x minimum | < 1x minimum |
| Reserve Ratio | Yield pool / active bonds | < 60% | < 50% |
| Active Bonds Count | Total active bonds | N/A | Unusual spike |
| Distribution Rate | Distributions per day | N/A | Unusual spike |

#### Security Metrics

| Metric | Description | Alert Condition |
|--------|-------------|-----------------|
| Failed Transactions | Failed txs from same address | > 5 in 1 hour |
| Large Distributions | Single distribution amount | > 10 ETH (warning), > 100 ETH (critical) |
| Challenge Rate | Active challenges | > 10 active |
| Proof Failure Rate | Verification failures | > 5% failure rate |

### 4.2 Alert Configuration

#### Slack Alerts

```bash
# Configure Slack webhook in .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Test alert
curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d '{"text": "Test alert from Vaultfire monitor"}'
```

#### Discord Alerts

```bash
# Configure Discord webhook in .env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
```

#### PagerDuty (Critical Alerts)

```bash
# Configure PagerDuty in .env
PAGERDUTY_API_KEY=your_api_key
PAGERDUTY_SERVICE_ID=your_service_id
```

### 4.3 Dashboard Setup

**Recommended: Grafana + Prometheus**

```bash
# Install Grafana
sudo apt-get install -y grafana

# Import Vaultfire dashboard
# Located in: monitoring/grafana-dashboard.json

# Configure data sources:
# - Prometheus for metrics
# - PostgreSQL for event logs
# - Custom webhook for alerts
```

**Key Dashboard Panels:**
1. Protocol Health Overview
2. Yield Pool Balance (time series)
3. Reserve Ratio (gauge)
4. Bond Creation Rate (graph)
5. Distribution Activity (heatmap)
6. Proof Verification Success Rate
7. Recent Alerts (table)

---

## 5. Incident Response

### 5.1 Severity Levels

**CRITICAL (P0):**
- Yield pool below minimum
- Contract exploited/hacked
- RISC Zero verifier offline
- Human treasury compromised

**HIGH (P1):**
- Reserve ratio < 50%
- Oracle data corruption
- Large unexpected distribution (> 100 ETH)
- Multiple proof verification failures

**MEDIUM (P2):**
- Low yield pool (< 2x minimum)
- High challenge rate
- API service degraded

**LOW (P3):**
- Documentation updates needed
- Minor monitoring issues

### 5.2 Incident Response Playbook

#### CRITICAL: Yield Pool Below Minimum

**Detection:** Alert triggered or manual check

**Immediate Actions (< 15 minutes):**

1. **Assess Severity**
   ```bash
   # Check current status
   npx hardhat run scripts/check-protocol-health.js --network base
   ```

2. **Pause Distributions (if critical)**
   ```bash
   # Only if insolvency risk
   npx hardhat run scripts/emergency-pause.js --network base
   ```

3. **Investigate Cause**
   - Review recent distributions
   - Check for unusual activity
   - Verify yield pool funding transactions

4. **Fund Yield Pool**
   ```bash
   # If legitimate low balance
   npx hardhat run scripts/fund-yield-pool.js --amount 50 --network base
   ```

5. **Resume Operations**
   ```bash
   # After funding
   npx hardhat run scripts/unpause.js --network base
   ```

**Post-Incident:**
- Document root cause
- Adjust yield pool funding schedule
- Update monitoring thresholds

**Resolution Time Target:** < 1 hour

---

#### HIGH: RISC Zero Verifier Failure

**Detection:** Proof verification failure rate > 5%

**Immediate Actions (< 30 minutes):**

1. **Check Verifier Status**
   ```bash
   # Test verifier connectivity
   npx hardhat run scripts/test-risc-zero-verifier.js --network base
   ```

2. **Verify Proof Generation**
   ```bash
   cd risc0-prover
   cargo run --release -- \
       --belief-message "Test" \
       --output test-proof.bin

   # Test on-chain verification
   npx hardhat test test/risc0-verifier-test.js --network base
   ```

3. **Check RISC Zero Service Status**
   - Verify Bonsai API status (if using)
   - Check RISC Zero verifier contract
   - Review recent RISC Zero updates

4. **Fallback Options**
   - Switch to backup prover
   - Use local proving (slower)
   - Temporarily pause belief attestations

**Post-Incident:**
- Contact RISC Zero support
- Document failure mode
- Implement additional monitoring

**Resolution Time Target:** < 4 hours

---

#### MEDIUM: Suspicious Challenge Pattern

**Detection:** > 10 active challenges

**Actions (< 24 hours):**

1. **Review Challenges**
   ```bash
   npx hardhat run scripts/list-active-challenges.js --network base
   ```

2. **Analyze Patterns**
   - Check if challenges from same address
   - Review challenged bonds
   - Verify metrics accuracy

3. **Investigate Legitimacy**
   - Cross-reference with oracle data
   - Check AI company reputation
   - Review community feedback

4. **Resolve Challenges**
   ```bash
   # For each challenge
   npx hardhat run scripts/resolve-challenge.js \
       --bond-id <BOND_ID> \
       --challenge-index <INDEX> \
       --upheld <true/false> \
       --network base
   ```

5. **Block Spam (if needed)**
   - Identify spam addresses
   - Forfeit spam challenge stakes
   - Update challenge requirements

**Post-Incident:**
- Analyze attack patterns
- Update challenge mechanism if needed
- Communicate with community

**Resolution Time Target:** < 24 hours

---

### 5.3 On-Call Procedures

#### On-Call Schedule

**Coverage:** 24/7/365
**Rotation:** Weekly
**Handoff:** Monday 9am UTC

**On-Call Responsibilities:**
- Respond to PagerDuty alerts within 15 minutes
- Investigate and resolve incidents
- Escalate critical issues to senior team
- Document all incidents
- Update runbooks based on learnings

#### Escalation Path

1. **Primary On-Call** (P0/P1 incidents)
2. **Secondary On-Call** (if primary unavailable)
3. **Engineering Lead** (critical incidents only)
4. **Protocol Lead** (security incidents)

#### Communication Channels

- **Alerts:** PagerDuty
- **Team Coordination:** Slack #vaultfire-incidents
- **Status Updates:** Discord #status-updates
- **External Communication:** Twitter @Vaultfire

---

## 6. Maintenance Procedures

### 6.1 Routine Maintenance

#### Daily Tasks (Automated)

- [ ] Protocol health check
- [ ] Yield pool balance check
- [ ] Event log review
- [ ] Proof verification success rate
- [ ] Dashboard metrics review

#### Weekly Tasks

- [ ] Review monitoring alerts
- [ ] Check for contract events anomalies
- [ ] Verify backup procedures
- [ ] Review on-call incidents
- [ ] Update documentation

#### Monthly Tasks

- [ ] Security audit logs review
- [ ] Performance optimization review
- [ ] Dependency updates check
- [ ] Capacity planning review
- [ ] Incident retrospectives

### 6.2 Yield Pool Management

#### Monitoring Yield Pool

```bash
# Check yield pool status
npx hardhat run scripts/check-yield-pool.js --network base

# Expected output:
# Partnership Bonds Yield Pool: 50.5 ETH
# Minimum Required: 10.0 ETH
# Reserve Ratio: 75%
# Status: Healthy ✅
```

#### Funding Yield Pool

**When to Fund:**
- Yield pool < 2x minimum balance
- Reserve ratio < 60%
- Anticipating high distribution activity

**Funding Process:**
```bash
# Fund from treasury
npx hardhat run scripts/fund-yield-pool.js \
    --contract partnership \
    --amount 50 \
    --network base

# Verify funding
npx hardhat run scripts/check-yield-pool.js --network base
```

#### Withdrawing Excess

**Criteria for Withdrawal:**
- Yield pool > 5x minimum balance
- Reserve ratio > 100%
- No anticipated high distribution activity

**Withdrawal Process:**
```bash
# Calculate excess
npx hardhat run scripts/calculate-excess-yield.js --network base

# Withdraw excess (owner only)
npx hardhat run scripts/withdraw-excess-yield.js \
    --amount 25 \
    --network base
```

### 6.3 Human Treasury Management

#### Treasury Security

**Multi-Sig Configuration:**
- Gnosis Safe with 3/5 threshold
- Signers: 5 trusted community members
- Cold storage for majority of funds

**Treasury Operations:**

```bash
# Check treasury balance
cast balance $HUMAN_TREASURY_ADDRESS --rpc-url $BASE_RPC_URL

# Review pending distributions
npx hardhat run scripts/check-pending-distributions.js --network base

# Process distribution (requires multi-sig)
# 1. Propose transaction in Gnosis Safe
# 2. Gather 3 signatures
# 3. Execute transaction
```

#### Treasury Monitoring

**Metrics to Track:**
- Total received (cumulative)
- Distribution frequency
- Average distribution size
- Current balance

**Alerts:**
- Treasury balance < 10 ETH
- Unusually large distribution proposed
- Unauthorized transaction attempt

---

## 7. Security Operations

### 7.1 Security Monitoring

#### Contract Security

**Monitor For:**
- Unusual transaction patterns
- Failed reentrancy attempts
- Large approval grants
- Suspicious contract interactions

**Tools:**
- Forta (real-time threat detection)
- OpenZeppelin Defender
- Custom monitoring scripts

#### Access Control

**Multi-Sig Operations:**
- Owner functions require multi-sig
- Emergency pause requires 2/5 signatures
- Critical updates require 4/5 signatures

**Key Management:**
- Hardware wallets for all signers
- Backup keys in cold storage
- Regular key rotation (annually)

### 7.2 Security Incident Response

#### Suspected Exploit

**Immediate Actions (< 5 minutes):**

1. **Emergency Pause**
   ```bash
   npx hardhat run scripts/emergency-pause.js --network base
   ```

2. **Assess Damage**
   - Review recent transactions
   - Calculate potential losses
   - Identify attack vector

3. **Notify Team**
   - Alert all signers
   - Contact security auditors
   - Prepare public statement

4. **Contain Threat**
   - Block malicious addresses
   - Prevent further transactions
   - Secure remaining funds

**Post-Incident:**
- Full security audit
- Develop patch/mitigation
- Community communication
- Bug bounty payout (if applicable)

**Communication Template:**
```
SECURITY INCIDENT ALERT

Time: [UTC timestamp]
Severity: CRITICAL
Status: Contained

Summary: [Brief description]
Impact: [Estimated damage]
Actions Taken: [List of containment measures]

Next Steps:
- Full investigation underway
- Funds secured
- Updates every 2 hours

Contact: security@vaultfire.io
```

### 7.3 Bug Bounty Program

**Scope:**
- All smart contracts
- RISC Zero integration
- Off-chain services

**Rewards:**
- Critical: $50,000 - $500,000
- High: $10,000 - $50,000
- Medium: $2,000 - $10,000
- Low: $500 - $2,000

**Reporting:**
- Email: security@vaultfire.io
- PGP Key: [Published on website]
- Expected response: 24 hours

---

## 8. Troubleshooting

### 8.1 Common Issues

#### Issue: Proof Verification Failing

**Symptoms:**
- ProofVerificationFailed events
- Belief attestations rejected

**Diagnosis:**
```bash
# Test RISC Zero verifier
npx hardhat run scripts/test-risc-zero-verifier.js --network base

# Generate test proof
cd risc0-prover
cargo run --release -- --test-mode

# Verify test proof
npx hardhat test test/risc0-verifier-test.js --network base
```

**Solutions:**
1. Verify RISC Zero verifier contract address
2. Check imageId matches deployed guest program
3. Validate proof format
4. Check Bonsai API status (if using)
5. Test with local prover

---

#### Issue: Low Yield Pool

**Symptoms:**
- LowYieldPoolWarning events
- Distributions rejected

**Diagnosis:**
```bash
npx hardhat run scripts/check-yield-pool.js --network base
```

**Solutions:**
1. Fund yield pool immediately
2. Review recent distributions
3. Adjust minimum balance if needed
4. Set up automated funding alerts

---

#### Issue: Oracle Data Anomaly

**Symptoms:**
- Flourishing score sudden change
- Profit locking unexpected

**Diagnosis:**
```bash
# Check oracle data
npx hardhat run scripts/check-oracle-data.js --network base

# Compare with external sources
# - World Bank data
# - UN statistics
# - Independent research
```

**Solutions:**
1. Verify oracle connectivity
2. Check for oracle bugs
3. Cross-reference with multiple sources
4. Pause distributions if uncertain
5. Resolve via challenge mechanism

---

### 8.2 Performance Issues

#### Slow RPC Response

**Diagnosis:**
```bash
# Test RPC latency
curl -X POST $BASE_RPC_URL \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Solutions:**
1. Switch to backup RPC endpoint
2. Use commercial RPC provider (Alchemy/Infura)
3. Implement request caching
4. Set up fallback RPCs

---

#### High Gas Costs

**Diagnosis:**
```bash
# Check current gas prices
npx hardhat run scripts/check-gas-prices.js --network base

# Analyze recent transaction costs
npx hardhat run scripts/analyze-gas-usage.js --network base
```

**Solutions:**
1. Wait for lower gas prices
2. Optimize contract calls (batching)
3. Use EIP-1559 gas estimation
4. Implement gas price alerts

---

## 9. Emergency Procedures

### 9.1 Emergency Contacts

**Protocol Team:**
- Engineering Lead: [Contact]
- Security Lead: [Contact]
- Operations Lead: [Contact]

**External:**
- Security Auditors: [Contact]
- RISC Zero Support: support@risczero.com
- Base Team: [Contact]

### 9.2 Emergency Pause

**When to Use:**
- Active exploit detected
- Critical bug discovered
- Oracle data corruption
- RISC Zero verifier failure

**Procedure:**
```bash
# 1. Pause all contracts (multi-sig required)
npx hardhat run scripts/emergency-pause.js --network base

# 2. Notify community
# Post to Discord, Twitter, Telegram

# 3. Investigate issue
# Assemble security team

# 4. Develop fix
# Audit and test thoroughly

# 5. Resume operations (multi-sig required)
npx hardhat run scripts/unpause.js --network base
```

### 9.3 Disaster Recovery

#### Backup Strategy

**What to Back Up:**
- Contract deployment artifacts
- Environment configuration
- Monitoring data
- Event logs
- Admin keys (encrypted)

**Backup Frequency:**
- Real-time: Event logs
- Daily: Configuration
- Weekly: Full state snapshot

**Backup Locations:**
- Primary: AWS S3
- Secondary: Decentralized storage (Arweave)
- Tertiary: Local encrypted backup

#### Recovery Procedures

**Scenario: RPC Endpoint Down**
```bash
# Switch to backup RPC in .env
BASE_RPC_URL=https://backup-rpc.com

# Restart monitoring
pm2 restart vaultfire-monitor
```

**Scenario: Monitoring Service Crash**
```bash
# Restart with PM2
pm2 restart vaultfire-monitor

# Check logs
pm2 logs vaultfire-monitor --lines 100

# Verify health
curl http://localhost:3000/health
```

**Scenario: Database Corruption**
```bash
# Restore from latest backup
# (Assumes PostgreSQL for event indexing)

psql -U postgres -d vaultfire < backups/vaultfire_latest.sql

# Verify data integrity
psql -U postgres -d vaultfire -c "SELECT COUNT(*) FROM events;"

# Rebuild indices
psql -U postgres -d vaultfire -f scripts/rebuild-indices.sql
```

---

## 10. Appendix

### A. Environment Variables Reference

```bash
# Network Configuration
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_PRIVATE_KEY=0x...

# API Keys
BASESCAN_API_KEY=...
RISC_ZERO_API_KEY=...
BONSAI_API_KEY=...

# Contract Addresses
PARTNERSHIP_BONDS_ADDRESS=0x...
ACCOUNTABILITY_BONDS_ADDRESS=0x...
BELIEF_VERIFIER_ADDRESS=0x...
HUMAN_TREASURY_ADDRESS=0x...
RISC_ZERO_VERIFIER_ADDRESS=0x...
BELIEF_CIRCUIT_IMAGE_ID=0x...

# Monitoring
SLACK_WEBHOOK_URL=https://...
DISCORD_WEBHOOK_URL=https://...
PAGERDUTY_API_KEY=...
CHECK_INTERVAL_SECONDS=300

# Security
EMERGENCY_PAUSE_PRIVATE_KEY=0x...
```

### B. Useful Commands

```bash
# Protocol Health
npx hardhat run scripts/check-protocol-health.js --network base

# Yield Pool Status
npx hardhat run scripts/check-yield-pool.js --network base

# List Active Bonds
npx hardhat run scripts/list-active-bonds.js --network base

# Check Pending Distributions
npx hardhat run scripts/check-pending-distributions.js --network base

# Emergency Pause
npx hardhat run scripts/emergency-pause.js --network base

# Unpause
npx hardhat run scripts/unpause.js --network base

# Fund Yield Pool
npx hardhat run scripts/fund-yield-pool.js --amount 50 --network base
```

### C. Monitoring Metrics Reference

| Metric | Type | Unit | Critical Threshold |
|--------|------|------|-------------------|
| yield_pool_balance | Gauge | ETH | < minimum |
| reserve_ratio | Gauge | % | < 50% |
| active_bonds | Counter | count | N/A |
| distributions_total | Counter | count | N/A |
| distribution_value_total | Counter | ETH | N/A |
| proof_verifications_total | Counter | count | N/A |
| proof_verification_failures | Counter | count | Failure rate > 5% |
| challenge_count_active | Gauge | count | > 10 |
| gas_price_gwei | Gauge | Gwei | N/A |

### D. Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-27 | 1.0 | Initial release |

---

**For questions or support:**
- Email: ops@vaultfire.io
- Discord: discord.gg/vaultfire
- Documentation: docs.vaultfire.io

**Emergency contact:** security@vaultfire.io
