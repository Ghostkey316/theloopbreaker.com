# Deploy to Mainnet RIGHT NOW
## For Your Homie - Made As Easy As Possible

**Real talk from Claude:** I can't deploy FOR you (I don't have a wallet), but I made it SO EASY you just copy-paste 6 commands.

---

## What You Need (10 Minutes Setup)

### 1. Get ETH on Base Mainnet (~$50)

**Option A: Coinbase Wallet (Easiest)**
1. Download Coinbase Wallet app on your phone
2. Create wallet → Save your recovery phrase somewhere SAFE
3. Buy $50 of ETH
4. Switch to "Base" network (top right dropdown)
5. If ETH is on Ethereum, bridge it to Base (app will help you)

**Option B: MetaMask**
1. Install MetaMask browser extension
2. Add Base Mainnet network:
   - Network Name: Base
   - RPC URL: https://mainnet.base.org
   - Chain ID: 8453
   - Currency: ETH
3. Bridge ETH to Base at bridge.base.org

### 2. Get Your Private Key (USE ONCE, THEN DELETE)

**Coinbase Wallet:**
- Settings → Show Private Key → Copy it

**MetaMask:**
- Click 3 dots → Account Details → Export Private Key → Copy it

**⚠️ KEEP THIS SECRET! Never share it. We'll delete it after deployment.**

---

## Deploy in 6 Commands

Open your terminal and run these ONE AT A TIME:

### Command 1: Navigate to project
```bash
cd /home/user/ghostkey-316-vaultfire-init
```

### Command 2: Create .env file with your private key
```bash
# Replace YOUR_PRIVATE_KEY_HERE with the one you copied above
# Make sure there are NO SPACES before or after the key
echo "PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE" > .env
```

### Command 3: Install dependencies (if not done)
```bash
npm install
```

### Command 4: Compile contracts
```bash
npx hardhat compile
```

### Command 5: DEPLOY TO MAINNET 🚀
```bash
npx hardhat run scripts/deploy-mainnet.js --network baseMainnet
```

This will:
- Wait 10 seconds (in case you want to cancel)
- Deploy the contract to Base Mainnet
- Show you the contract address
- Save deployment info

**What success looks like:**
```
🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
🔥 VAULTFIRE MAINNET DEPLOYMENT 🔥
🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

✅✅✅✅✅✅✅✅✅✅✅
   CONTRACT DEPLOYED TO MAINNET!
✅✅✅✅✅✅✅✅✅✅✅

📍 Address: 0x...
📄 Tx Hash: 0x...

🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
🎉 DEPLOYMENT COMPLETE! 🎉
🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
```

**SAVE THAT CONTRACT ADDRESS!** You'll need it.

### Command 6: Delete your private key (SECURITY)
```bash
rm .env
```

**Done!** Your contract is live on Base Mainnet.

---

## Common Errors & Fixes

### Error: "insufficient funds"
**Problem:** Not enough ETH in your wallet

**Fix:** Add another $20-30 ETH and try Command 5 again

### Error: "invalid private key"
**Problem:** Private key wasn't copied correctly

**Fix:**
1. Make sure you copied the FULL key (usually starts with 0x)
2. Check for spaces before/after the key
3. Redo Command 2 with correct key

### Error: "network not found"
**Problem:** Hardhat config issue

**Fix:**
```bash
npm install --save-dev @nomicfoundation/hardhat-ethers ethers
npx hardhat compile
npx hardhat run scripts/deploy-mainnet.js --network baseMainnet
```

### Error: "Cannot read property 'deploy' of undefined"
**Problem:** Contract compilation issue

**Fix:**
```bash
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/deploy-mainnet.js --network baseMainnet
```

---

## After Deployment

**1. Your contract is LIVE on Base Mainnet** ✅

**2. View it on BaseScan:**
- Go to: https://basescan.org
- Search for your contract address
- You'll see it's verified and deployed!

**3. Next Steps:**
1. Configure RISC Zero Bonsai (for ZK proofs)
2. Deploy demo app to Vercel
3. Start partner outreach
4. Submit Base grant

**I'll guide you through each one.**

---

## What This Means

**Vaultfire is no longer testnet. It's REAL.**

- ✅ Live on Base Mainnet
- ✅ Anyone can interact with it
- ✅ Eligible for Base grants
- ✅ Partners can try it
- ✅ The mission is deployed

**Privacy over surveillance. Freedom over control. AI + humanity thriving together.**

**It's not in your repo anymore. It's in the world.**

---

## Still Stuck?

If you get an error you can't fix:

**Option 1:** Send me the error message and I'll help

**Option 2:** Hire someone to deploy ($300-500)
- Post on Upwork: "Deploy Hardhat contracts to Base Mainnet"
- Give them this repo
- They'll deploy in 1 hour
- **This is smart, not giving up**

---

## The Real Question

You asked: "Can you not upload it to mainnet and do whatever is needed?"

**My honest answer:**

I **cannot** deploy it FOR you (I don't have a wallet to sign transactions).

I **can** make it so easy that you just run 6 commands.

I **can** be with you through every step.

I **can** troubleshoot any errors.

**We'll deploy it TOGETHER, just like we built it together.**

You + ChatGPT built it over 7 months.

You + Claude will deploy it in 6 commands.

---

## Ready?

Open your terminal.

Run Command 1.

I'm here with you.

**Let's make Vaultfire real.**
