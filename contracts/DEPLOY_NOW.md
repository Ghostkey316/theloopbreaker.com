# Deploy to Mainnet in 5 Commands
## Your Homie Claude Made This As Easy As Possible

**Real talk:** I can't deploy FOR you (no wallet, can't sign transactions).

**But I CAN make it so easy you just copy-paste 5 commands.**

---

## What You Need (5 Minutes)

1. **$50 in ETH on Base network** (for gas fees)
2. **Your wallet private key** (we'll use it ONCE to deploy, then delete it)

---

## Setup (One Time)

### Get ETH on Base

**Option A: Coinbase Wallet** (Easiest)
1. Download Coinbase Wallet app
2. Buy $50 ETH
3. Switch to Base network (top right)
4. Settings → Show Private Key → Copy it

**Option B: MetaMask**
1. Install MetaMask extension
2. Add Base network (chainid.network/base)
3. Bridge ETH to Base
4. Settings → Export Private Key → Copy it

### Set Environment Variable

```bash
cd /home/user/ghostkey-316-vaultfire-init/contracts

# Create .env file (paste your private key where it says YOUR_PRIVATE_KEY)
echo "PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
BASE_RPC_URL=https://mainnet.base.org
ETHERSCAN_API_KEY=" > .env
```

---

## Deploy (5 Commands)

Copy-paste these ONE AT A TIME:

```bash
# 1. Install dependencies
npm install

# 2. Compile contracts
npx hardhat compile

# 3. Deploy to Base Mainnet (THIS IS THE BIG ONE)
npx hardhat run scripts/deploy-base.ts --network base

# 4. Save contract addresses (they'll be printed above)
# Copy them somewhere safe

# 5. Delete your private key from .env (SECURITY)
rm .env
```

---

## What Success Looks Like

After command #3, you'll see:

```
✅ Deploying to Base Mainnet...
✅ DilithiumVerifier deployed to: 0x...
✅ LoyaltyScoreCalculator deployed to: 0x...
✅ VaultfireBeliefRegistry deployed to: 0x...
✅ Deployment complete!
```

**Save those addresses!**

---

## If Something Goes Wrong

**Error: "insufficient funds"**
- You need more ETH in your wallet
- Add $20 more and try again

**Error: "invalid private key"**
- Check that you copied the FULL private key (starts with 0x)
- No spaces before/after

**Error: "network not found"**
- Run: `npm install --save-dev @nomiclabs/hardhat-ethers ethers`
- Try deploy command again

**Anything else:**
- Send me the error
- I'll tell you exactly how to fix it

---

## After Deployment

Your contracts are LIVE on Base Mainnet.

**Next steps:**
1. Configure ZK prover (RISC Zero Bonsai)
2. Deploy demo app to Vercel
3. Start reaching out to partners

**I'll guide you through each step.**

---

## The Truth

I can't deploy FOR you (no wallet, can't sign transactions).

**But I'm with you for every step.**

You + me, just like you + ChatGPT built this over 7 months.

**Let's deploy it together.**

Ready to run those 5 commands?
