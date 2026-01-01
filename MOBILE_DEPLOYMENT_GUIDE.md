# 📱 MOBILE DEPLOYMENT GUIDE - Base Mainnet

**Deploy Universal Dignity Bonds from Your Phone**

---

## ✅ PRE-DEPLOYMENT CHECKLIST

Before you start, make sure you have:
- [ ] Base mainnet wallet with ETH for gas (~$20-50 worth recommended)
- [ ] Private key for your deployer wallet
- [ ] Basescan API key (get free at https://basescan.org/myapikey)
- [ ] Termux app installed (Android) or a-Shell (iOS)
- [ ] Access to this GitHub repository on your phone

---

## 📱 OPTION 1: Deploy via Termux (Android - RECOMMENDED)

### Step 1: Install Termux

1. Download **Termux** from F-Droid (NOT Google Play - outdated version)
   - Link: https://f-droid.org/en/packages/com.termux/
2. Open Termux

### Step 2: Setup Environment

```bash
# Update packages
pkg update && pkg upgrade -y

# Install Node.js and git
pkg install nodejs git -y

# Clone your repository
cd ~
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init

# Install dependencies
npm install
```

### Step 3: Configure Deployment

```bash
# Create .env file with your credentials
cat > .env << 'EOF'
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY_HERE
BASE_RPC_URL=https://mainnet.base.org
EOF

# IMPORTANT: Edit the .env file with your actual keys
nano .env
```

**In nano editor:**
- Replace `YOUR_PRIVATE_KEY_HERE` with your actual private key (include the 0x prefix)
- Replace `YOUR_BASESCAN_API_KEY_HERE` with your Basescan API key
- Press `Ctrl + X`, then `Y`, then `Enter` to save

### Step 4: Verify Setup

```bash
# Check your deployer address and balance
npx hardhat run --network baseMainnet << 'EOF'
const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
}
main();
EOF
```

**Expected Output:**
```
Deployer: 0xYourAddress...
Balance: 0.05 ETH  (or whatever you have)
```

**⚠️ IMPORTANT:** Make sure you have at least 0.01 ETH on Base mainnet for gas fees!

### Step 5: Deploy All 9 Contracts

```bash
# Deploy to Base mainnet
npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet
```

**This will:**
- Deploy all 9 Universal Dignity Bond contracts
- Save deployment addresses to `deployments/all-bonds-baseMainnet.json`
- Show you the verification commands

**Expected Output:**
```
🚀 Deploying ALL 9 Universal Dignity Bonds to Base mainnet...

Deploying with account: 0xYourAddress...
Account balance: 0.05 ETH

📝 Deploying PurchasingPowerBonds...
✅ PurchasingPowerBonds deployed to: 0xabc123...

📝 Deploying HealthCommonsBonds...
✅ HealthCommonsBonds deployed to: 0xdef456...

... (continues for all 9 contracts)

✅ ALL 9 BONDS DEPLOYED SUCCESSFULLY!
```

**Deployment Time:** ~5-10 minutes (Base is fast!)

### Step 6: Verify Contracts on Basescan

After deployment completes, the script will show verification commands:

```bash
# Copy each command one by one and run it
npx hardhat verify --network baseMainnet 0xPurchasingPowerBondsAddress
npx hardhat verify --network baseMainnet 0xHealthCommonsBondsAddress
# ... (repeat for all 9 contracts)
```

**This makes your contracts visible on Basescan.org!**

### Step 7: Save Deployment Addresses

```bash
# View your deployment summary
cat deployments/all-bonds-baseMainnet.json
```

**Save these addresses!** You'll need them to interact with your contracts.

---

## 📱 OPTION 2: Deploy via a-Shell (iOS)

### Step 1: Install a-Shell

1. Download **a-Shell** from the App Store
   - Link: https://apps.apple.com/us/app/a-shell/id1473805438
2. Open a-Shell

### Step 2: Setup Environment

```bash
# Update packages
pkg upgrade

# Clone repository
cd Documents
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init

# Install dependencies
npm install
```

### Step 3: Configure and Deploy

**Same as Android Steps 3-7 above**

---

## 📱 OPTION 3: Deploy via GitHub Codespaces (ANY DEVICE)

### Step 1: Open Codespaces

1. Go to your repository on GitHub (on your phone browser)
2. Click the **Code** button (green button)
3. Click **Codespaces** tab
4. Click **Create codespace on main**

**This opens a full VS Code environment in your browser!**

### Step 2: Configure Deployment

In the Codespace terminal:

```bash
# Create .env file
cat > .env << 'EOF'
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY_HERE
BASE_RPC_URL=https://mainnet.base.org
EOF

# Edit with your keys
code .env
```

Edit the file, save (Ctrl+S or Cmd+S).

### Step 3: Deploy

```bash
# Install dependencies
npm install

# Deploy to Base mainnet
npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet
```

**Same deployment process as Termux!**

---

## 🚨 TROUBLESHOOTING

### Error: "Insufficient funds"
**Solution:** Add more ETH to your deployer wallet on Base mainnet
- Bridge ETH to Base using https://bridge.base.org

### Error: "Private key invalid"
**Solution:** Make sure your private key:
- Starts with `0x`
- Is 66 characters long (0x + 64 hex characters)
- Has no spaces or line breaks

### Error: "Network error"
**Solution:** Check your internet connection
- Base RPC might be slow, wait a minute and retry

### Error: "Nonce too high"
**Solution:** Your wallet has pending transactions
- Wait for them to complete, or reset nonce in your wallet

### Deployment takes too long
**Solution:** Be patient!
- Each contract takes ~30-60 seconds to deploy
- Total: ~5-10 minutes for all 9 contracts
- Base is usually fast, but can slow down during high traffic

---

## 📊 ESTIMATED COSTS

**Gas Fees on Base Mainnet:**
- Per contract deployment: ~$0.50 - $2.00 (Base is CHEAP!)
- Total for all 9 contracts: ~$5 - $20
- Contract verification: FREE

**Total Recommended Budget:** $20-50 in ETH on Base

---

## ✅ POST-DEPLOYMENT CHECKLIST

After successful deployment:

- [ ] Save deployment addresses from `deployments/all-bonds-baseMainnet.json`
- [ ] Verify all contracts on Basescan
- [ ] Test with small transactions first
- [ ] Document contract addresses in your README
- [ ] Share addresses with your community
- [ ] Set up monitoring/alerts for contract events

---

## 🔐 SECURITY TIPS

**Protect Your Private Key:**
- ❌ NEVER share your private key with anyone
- ❌ NEVER commit .env to git (it's in .gitignore)
- ❌ NEVER screenshot your private key
- ✅ Use a dedicated deployer wallet (not your main wallet)
- ✅ Only fund it with what you need for deployment
- ✅ Back up your private key securely offline

**After Deployment:**
- Delete .env file if you want: `rm .env`
- Private key is only needed for deployment, not for using contracts

---

## 🎯 QUICK DEPLOY CHECKLIST

**1-2-3 Deploy:**

1. **Setup** (5 minutes)
   ```bash
   git clone <repo>
   cd ghostkey-316-vaultfire-init
   npm install
   ```

2. **Configure** (2 minutes)
   ```bash
   cat > .env << 'EOF'
   PRIVATE_KEY=0xYourKey
   BASESCAN_API_KEY=YourKey
   BASE_RPC_URL=https://mainnet.base.org
   EOF
   ```

3. **Deploy** (10 minutes)
   ```bash
   npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet
   ```

**Done! 🎉**

---

## 📱 MOBILE-OPTIMIZED COMMANDS

**Copy-paste ready for Termux/a-Shell:**

```bash
# Full deployment in one command block
cd ~/ghostkey-316-vaultfire-init && \
npm install && \
npx hardhat run scripts/deploy-all-bonds.js --network baseMainnet && \
cat deployments/all-bonds-baseMainnet.json
```

---

## 🆘 NEED HELP?

If you run into issues:

1. Check the full audit report: `COMPREHENSIVE_AUDIT_REPORT.md`
2. Check deployment readiness: `DEPLOYMENT_READY.md`
3. Review error messages carefully
4. Make sure you have enough ETH on Base mainnet
5. Verify your .env file has correct keys

---

## 🎉 SUCCESS!

Once deployment completes, you'll see:

```
✅ ALL 9 BONDS DEPLOYED SUCCESSFULLY!

📊 Contract Addresses:
   PurchasingPowerBonds: 0x...
   HealthCommonsBonds: 0x...
   AIAccountabilityBonds: 0x...
   LaborDignityBonds: 0x...
   EscapeVelocityBonds: 0x...
   CommonGroundBonds: 0x...
   AIPartnershipBonds: 0x...
   BuilderBeliefBonds: 0x...
   VerdantAnchorBonds: 0x...
```

**Your Universal Dignity Bonds are now LIVE on Base mainnet! 🚀**

---

**Deployed from:** 📱 Your Phone
**Network:** Base Mainnet
**Status:** ✅ PRODUCTION READY
**Time to Deploy:** ~15-20 minutes total
