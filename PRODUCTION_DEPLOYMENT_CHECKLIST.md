# Vaultfire Production Deployment Checklist

**Version:** 1.0
**Last Updated:** January 15, 2026
**Target Network:** Base Mainnet (Chain ID: 8453)

---

## Pre-Deployment Requirements

### 1. Environment Configuration ✅

#### Required Environment Variables

Create `.env.local` in the `base-mini-app` directory with the following variables:

```bash
# WalletConnect Configuration (REQUIRED)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-project-id>

# Smart Contract Addresses (Set after deployment)
NEXT_PUBLIC_DILITHIUM_ATTESTOR_ADDRESS=<deployed-address>
NEXT_PUBLIC_BELIEF_VERIFIER_ADDRESS=<deployed-verifier-address>

# RISC Zero Configuration (CRITICAL for ZK proofs)
NEXT_PUBLIC_ZKP_PROVER_URL=https://api.bonsai.xyz
NEXT_PUBLIC_ZKP_API_KEY=<your-bonsai-api-key>

# Network Configuration
NEXT_PUBLIC_DEFAULT_CHAIN_ID=8453
NEXT_PUBLIC_ENABLE_TESTNETS=false

# Production Settings
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_USE_MOCK_PROOFS=false

# Optional: Error Tracking
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
```

**Action Items:**
- [ ] Obtain WalletConnect Project ID from https://cloud.walletconnect.com
- [ ] Obtain RISC Zero Bonsai API Key from https://bonsai.xyz
- [ ] Configure Sentry for error tracking (optional but recommended)

---

### 2. RISC Zero Setup ✅

#### Install RISC Zero Toolchain

```bash
cd base-mini-app/zkp

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install RISC Zero toolchain
cargo install cargo-risczero
cargo risczero install

# Build the guest program
cargo build --release
```

#### Generate Image ID

```bash
# Get the guest program image ID
cd methods/guest
cargo risczero build

# The image ID will be printed - save this value
# Example output: Guest Image ID: 0x123abc...
```

**Action Items:**
- [ ] Install RISC Zero toolchain
- [ ] Build guest program successfully
- [ ] Save guest program image ID
- [ ] Update smart contract deployment script with image ID

---

### 3. Smart Contract Deployment ✅

#### Step 1: Configure Hardhat

Edit `base-mini-app/hardhat.config.ts`:

```typescript
networks: {
  baseMainnet: {
    url: 'https://mainnet.base.org',
    accounts: [process.env.BASE_PRIVATE_KEY!],
    chainId: 8453,
  }
}
```

Create `.env` file in `base-mini-app`:

```bash
BASE_PRIVATE_KEY=<your-deployer-private-key>
BASE_RPC_URL=https://mainnet.base.org
```

**Action Items:**
- [ ] Fund deployer wallet with ETH on Base Mainnet
- [ ] Set BASE_PRIVATE_KEY environment variable
- [ ] Verify RPC URL is correct

#### Step 2: Deploy Contracts

```bash
cd base-mini-app

# Compile contracts
npx hardhat compile

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.ts --network baseMainnet

# Expected output:
# ✅ DilithiumAttestor deployed to: 0x...
# ✅ BeliefAttestationVerifier deployed to: 0x...
# ✅ Deployment transaction: 0x...
```

**Action Items:**
- [ ] Deploy DilithiumAttestor contract
- [ ] Deploy BeliefAttestationVerifier contract
- [ ] Save deployed contract addresses
- [ ] Verify contracts on Basescan
- [ ] Update `.env.local` with contract addresses

#### Step 3: Verify on Basescan

```bash
npx hardhat verify --network baseMainnet <contract-address> <constructor-args>
```

**Action Items:**
- [ ] Verify DilithiumAttestor on Basescan
- [ ] Verify BeliefAttestationVerifier on Basescan
- [ ] Confirm verification status on https://basescan.org

---

### 4. Testing Before Deployment ✅

#### Run All Test Suites

```bash
# Root directory tests
npm test

# Expected: 104 test suites, 304 tests passing
# Coverage: >74% lines, >77% functions

# Hardhat contract tests
cd base-mini-app
npx hardhat test

# Expected: 31 tests passing

# Python tests
pytest tests/rbb/ tests/thriving_bonds/ -v

# Expected: 28 tests passing
```

**Action Items:**
- [ ] All Node.js tests passing
- [ ] All Hardhat tests passing
- [ ] All Python tests passing
- [ ] No failing tests in CI/CD

#### Integration Testing

Test the complete flow on Base Sepolia testnet first:

1. **Deploy to Sepolia:**
   ```bash
   npx hardhat run scripts/deploy.ts --network baseSepolia
   ```

2. **Test Wallet Connection:**
   - Connect wallet via RainbowKit
   - Verify network switching works
   - Test wallet disconnection

3. **Test Belief Attestation:**
   - Create belief attestation
   - Generate ZK proof (with real Bonsai)
   - Submit to smart contract
   - Verify on-chain state

4. **Test Loyalty Calculation:**
   - Test GitHub activity fetch
   - Verify loyalty score calculation
   - Test NS3 and Base modules
   - Verify score validation

**Action Items:**
- [ ] Successful Sepolia deployment
- [ ] End-to-end attestation flow tested
- [ ] ZK proof generation working with real Bonsai
- [ ] All integrations tested (GitHub API, etc.)

---

### 5. Security Checklist ✅

#### Code Security

- [ ] No hardcoded private keys or secrets
- [ ] All environment variables using `process.env`
- [ ] `.env` files in `.gitignore`
- [ ] No `dangerouslySetInnerHTML` usage
- [ ] Input validation on all user inputs
- [ ] Rate limiting configured (if applicable)

#### Smart Contract Security

- [ ] ReentrancyGuard on all financial functions
- [ ] Gas optimization verified
- [ ] Constructor parameter validation
- [ ] Access control implemented
- [ ] Emergency pause functionality (if needed)
- [ ] Audit report reviewed (VAULTFIRE_PROFESSIONAL_AUDIT_REPORT.md)

#### Dependency Security

```bash
# Run security audit
npm audit --audit-level=high

# Expected: 0 critical, 0 high vulnerabilities
```

**Action Items:**
- [ ] No critical or high vulnerabilities
- [ ] All moderate vulnerabilities reviewed
- [ ] Dependencies up to date

---

### 6. Frontend Build & Deployment ✅

#### Build Production Bundle

```bash
cd base-mini-app

# Install dependencies
npm install

# Build for production
npm run build

# Expected output:
# ✓ Compiled successfully
# ✓ Optimized bundle
# ✓ Static pages generated
```

**Action Items:**
- [ ] Production build completes successfully
- [ ] No build warnings or errors
- [ ] Bundle size optimized (<5MB recommended)
- [ ] Lighthouse score >90 (Performance, Best Practices, SEO)

#### Deployment Platform Setup

Choose your deployment platform:

**Option A: Vercel (Recommended for Next.js)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd base-mini-app
vercel --prod

# Set environment variables in Vercel dashboard
```

**Option B: Netlify**

```bash
# Build and deploy
netlify deploy --prod --dir=base-mini-app/.next
```

**Option C: Self-Hosted**

```bash
# Start production server
npm run start

# Or use PM2 for process management
pm2 start npm --name "vaultfire" -- start
```

**Action Items:**
- [ ] Choose deployment platform
- [ ] Configure environment variables on platform
- [ ] Set up custom domain (if applicable)
- [ ] Configure SSL certificate
- [ ] Test deployment URL

---

### 7. Monitoring & Observability ✅

#### Error Tracking (Sentry)

1. Create Sentry project at https://sentry.io
2. Get DSN from project settings
3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
   ```
4. Verify error reporting works

**Action Items:**
- [ ] Sentry project created
- [ ] DSN configured
- [ ] Test error capture
- [ ] Alert rules configured

#### Blockchain Monitoring

Set up Basescan alerts:

1. Go to https://basescan.org/myapikey
2. Create API key
3. Set up contract event monitoring
4. Configure email/webhook alerts

**Action Items:**
- [ ] Basescan API key obtained
- [ ] Contract watch list created
- [ ] Alert notifications configured

#### Analytics (Optional)

Consider adding:
- Google Analytics or Plausible
- Wallet analytics (number of connections, attestations)
- Custom metrics dashboard

**Action Items:**
- [ ] Analytics platform chosen (optional)
- [ ] Tracking configured (optional)
- [ ] Dashboard created (optional)

---

### 8. Documentation ✅

#### User Documentation

Create documentation for:
- How to connect wallet
- How to create belief attestations
- How loyalty scores are calculated
- Privacy guarantees (ZK proofs)
- FAQ

**Action Items:**
- [ ] User guide created
- [ ] FAQ documented
- [ ] Privacy policy written
- [ ] Terms of service written

#### Developer Documentation

Ensure the following docs are up to date:
- `README.md` - Project overview
- `DEPLOYMENT_GUIDE.md` - This file
- `VAULTFIRE_PROFESSIONAL_AUDIT_REPORT.md` - Security audit
- API documentation (if applicable)

**Action Items:**
- [ ] README updated with mainnet info
- [ ] API docs current
- [ ] Contract addresses documented
- [ ] Integration examples provided

---

### 9. Post-Deployment Verification ✅

#### Immediate Checks (First 24 Hours)

**Action Items:**
- [ ] Website accessible via HTTPS
- [ ] Wallet connection works
- [ ] Belief attestation flow works end-to-end
- [ ] ZK proof generation succeeds
- [ ] Contract interactions successful
- [ ] No JavaScript errors in browser console
- [ ] Mobile responsive design works
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

#### Monitoring Checklist (First Week)

**Action Items:**
- [ ] Monitor Sentry for errors
- [ ] Check Basescan for contract events
- [ ] Verify gas costs are reasonable
- [ ] Monitor API rate limits (GitHub, etc.)
- [ ] Check RISC Zero Bonsai usage/billing
- [ ] Review user feedback

---

### 10. Rollback Plan ✅

#### Emergency Procedures

If critical issues arise:

1. **Frontend Issues:**
   ```bash
   # Revert to previous deployment
   vercel rollback
   # Or redeploy previous version
   git checkout <previous-commit>
   vercel --prod
   ```

2. **Smart Contract Issues:**
   - Deploy new contract version
   - Update frontend to use new contract address
   - Notify users of contract migration

3. **ZK Proof Issues:**
   - Enable mock proofs temporarily (emergency only):
     ```bash
     # Set environment variable
     NEXT_PUBLIC_USE_MOCK_PROOFS=true
     ```
   - Deploy quick fix
   - Switch back to real proofs once resolved

**Action Items:**
- [ ] Rollback procedures documented
- [ ] Team contacts for emergencies
- [ ] Communication plan for users
- [ ] Backup contract deployment ready

---

## Final Pre-Launch Checklist

### Critical Items (Must Be Complete)

- [ ] All environment variables configured
- [ ] RISC Zero Bonsai API key working
- [ ] Smart contracts deployed to Base Mainnet
- [ ] Contracts verified on Basescan
- [ ] Frontend deployed and accessible
- [ ] End-to-end attestation flow tested on mainnet
- [ ] Real ZK proofs generating successfully
- [ ] No mock proofs in production
- [ ] All tests passing (363/363)
- [ ] Security audit reviewed and items addressed
- [ ] Monitoring (Sentry) configured
- [ ] Documentation complete

### Recommended Items

- [ ] Custom domain configured
- [ ] Analytics set up
- [ ] User documentation published
- [ ] Social media presence established
- [ ] Community channels created (Discord, Telegram)
- [ ] Press kit prepared

---

## Launch Day Checklist

### T-2 Hours Before Launch

- [ ] Final smoke test on production URL
- [ ] Verify all environment variables
- [ ] Check contract balances (gas funds)
- [ ] Confirm monitoring dashboards working
- [ ] Team on standby for issues

### T-0 Launch

- [ ] Announce on social media
- [ ] Post in community channels
- [ ] Monitor error rates closely
- [ ] Watch for contract events
- [ ] Be ready to respond to user questions

### T+2 Hours After Launch

- [ ] Review error logs
- [ ] Check contract activity
- [ ] Gather initial user feedback
- [ ] Document any issues encountered
- [ ] Celebrate successful launch! 🎉

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Network connection failed"
- **Solution:** Check RPC endpoint status, verify BASE_RPC_URL

**Issue:** "ZK proof generation failed"
- **Solution:** Verify Bonsai API key, check quota/billing

**Issue:** "Transaction failed"
- **Solution:** Check gas price, verify wallet balance

**Issue:** "Contract call reverted"
- **Solution:** Check contract state, verify parameters

### Emergency Contacts

- **Technical Lead:** [Your contact]
- **Smart Contract Admin:** [Deployer wallet holder]
- **Infrastructure:** [DevOps contact]
- **RISC Zero Support:** support@risczero.com

---

## Post-Launch Optimization

### Week 1

- [ ] Analyze gas costs, optimize if needed
- [ ] Review user feedback and fix bugs
- [ ] Monitor proof generation times
- [ ] Optimize frontend performance

### Month 1

- [ ] Expand supported module types
- [ ] Add new features based on feedback
- [ ] Consider Layer 2 scaling solutions
- [ ] Plan v2 enhancements

---

**Deployment Approved By:**
___________________ (Technical Lead)
Date: ___________

**Production Deployment Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Mainnet Launch Date:** ___________

---

**End of Checklist**
