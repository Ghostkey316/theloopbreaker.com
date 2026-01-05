# 🧪 TESTNET DEPLOYMENT GUIDE - Base Sepolia

**SAFE deployment for testing with FREE testnet ETH**

---

## ✅ WHY TESTNET FIRST?

**Testnet = Zero Financial Risk:**
- FREE testnet ETH (no real money)
- Test all functionality
- Find bugs safely
- Learn how everything works
- **Perfect for alpha stage**

**Once testnet works well, then consider mainnet with tiny amounts.**

---

## 📋 TESTNET DEPLOYMENT CHECKLIST

### What You Need:
- [ ] Base Sepolia wallet address
- [ ] Private key for that wallet
- [ ] FREE testnet ETH from faucet
- [ ] Basescan API key (optional, for verification)
- [ ] a-Shell (iOS) or Termux (Android) or computer

### What You DON'T Need:
- ❌ Real money
- ❌ Security audit (testnet is for finding bugs!)
- ❌ Legal review (no real funds involved)
- ❌ Insurance

---

## 📱 STEP 1: Get FREE Testnet ETH

### Option 1: Base Sepolia Faucet (EASIEST)
1. Go to: **https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet**
2. Connect your wallet
3. Click "Send me ETH"
4. Wait ~1 minute
5. You'll get 0.1 testnet ETH (enough for deployment!)

### Option 2: Sepolia Bridge
1. Get Sepolia ETH from https://sepoliafaucet.com
2. Bridge to Base Sepolia via https://bridge.base.org/deposit
3. Switch network to "Sepolia" testnet

### Option 3: Alchemy Faucet
1. Go to: **https://www.alchemy.com/faucets/base-sepolia**
2. Sign up (free)
3. Enter your wallet address
4. Get 0.5 testnet ETH

**Pick whichever is easiest for you!**

---

## 📱 STEP 2: Setup (5 minutes)

### On iPhone (a-Shell):

```bash
# Install a-Shell from App Store first

# Then run these commands:
cd Documents
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init
npm install
```

### On Android (Termux):

```bash
# Install Termux from F-Droid first

# Then run these commands:
pkg update && pkg upgrade -y
pkg install nodejs git -y
cd ~
git clone https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git
cd ghostkey-316-vaultfire-init
npm install
```

---

## 📱 STEP 3: Configure Your Wallet (2 minutes)

```bash
cat > .env << 'EOF'
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
BASESCAN_API_KEY=YOUR_API_KEY_HERE
EOF

# Edit the file with your actual keys
nano .env
```

**Replace:**
- `0xYOUR_PRIVATE_KEY_HERE` with your wallet's private key
- `YOUR_API_KEY_HERE` with your Basescan API key (optional)

**Press Ctrl+X, then Y, then Enter to save**

---

## 📱 STEP 4: Check Your Balance (1 minute)

```bash
npx hardhat run --network baseSepolia - << 'EOF'
const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH (testnet)");
}
main();
EOF
```

**You should see:**
```
Deployer: 0xYourAddress...
Balance: 0.1 ETH (testnet)
```

**If balance is 0, go back to Step 1 and get testnet ETH!**

---

## 🚀 STEP 5: DEPLOY TO TESTNET! (10 minutes)

**This is it - deploy all 9 contracts to Base Sepolia testnet:**

```bash
npx hardhat run scripts/deploy-all-bonds.js --network baseSepolia
```

**What you'll see:**

```
🚀 Deploying ALL 9 Universal Dignity Bonds to Base Sepolia testnet...

Deploying with account: 0xYourAddress...
Account balance: 0.1 ETH

📝 Deploying PurchasingPowerBonds...
✅ PurchasingPowerBonds deployed to: 0xabc123...

📝 Deploying HealthCommonsBonds...
✅ HealthCommonsBonds deployed to: 0xdef456...

... (continues for all 9)

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

**Time:** ~5-10 minutes for all 9 contracts
**Cost:** FREE (using testnet ETH)

---

## 📱 STEP 6: Save Your Addresses (1 minute)

```bash
cat deployments/all-bonds-baseSepolia.json
```

**Copy those addresses!** You'll need them to test your contracts.

**Also view them on Base Sepolia explorer:**
- Go to: **https://sepolia.basescan.org**
- Search for your deployer address
- See all your deployed contracts!

---

## 📱 STEP 7: Verify Contracts (Optional - 5 minutes)

```bash
# Verify each contract (makes code readable on Basescan)
npx hardhat verify --network baseSepolia 0xYOURCONTRACTADDRESS
```

Replace `0xYOURCONTRACTADDRESS` with each contract address from Step 6.

**This makes your contracts viewable on https://sepolia.basescan.org**

---

## ✅ DONE! YOUR CONTRACTS ARE LIVE ON TESTNET! 🎉

**What you can do now:**

### Test Your Contracts:
```bash
# Interact with your contracts via Hardhat console
npx hardhat console --network baseSepolia
```

### Test Functions:
```javascript
// Example: Create a bond
const PurchasingPowerBonds = await ethers.getContractFactory("PurchasingPowerBonds");
const ppb = PurchasingPowerBonds.attach("0xYOURCONTRACTADDRESS");
await ppb.createBond(100, { value: ethers.parseEther("0.001") });
```

### Monitor on Basescan:
- Go to https://sepolia.basescan.org
- Search your contract addresses
- Watch transactions in real-time
- View contract events

---

## 🧪 TESTING CHECKLIST

**Test each contract thoroughly:**

- [ ] **PurchasingPowerBonds** - Create bond, submit metrics, worker attestations
- [ ] **HealthCommonsBonds** - Create bond, pollution data, health outcomes
- [ ] **AIAccountabilityBonds** - Create bond, global flourishing metrics
- [ ] **LaborDignityBonds** - Create bond, worker flourishing metrics
- [ ] **EscapeVelocityBonds** - Create bond ($50-500 limits), escape progress
- [ ] **CommonGroundBonds** - Create bridge, add witnesses
- [ ] **AIPartnershipBonds** - Create partnership, track tasks
- [ ] **BuilderBeliefBonds** - Create bond, track building activity
- [ ] **VerdantAnchorBonds** - Create bond, regeneration metrics

**Find bugs? GREAT!** That's what testnet is for! Fix them and redeploy.

---

## 🔄 REDEPLOY IF NEEDED

**Found a bug? No problem - just redeploy:**

1. Fix the bug in your contract
2. Run `npx hardhat compile`
3. Run deployment again: `npx hardhat run scripts/deploy-all-bonds.js --network baseSepolia`
4. New contracts deployed! Old ones still exist but use new addresses

**Testnet = unlimited do-overs with free ETH!**

---

## 📊 TESTNET vs MAINNET

| Feature | Testnet (Sepolia) | Mainnet |
|---------|------------------|---------|
| ETH Cost | FREE | Real money ($) |
| Risk | ZERO | High |
| Good for | Testing, learning | Production |
| Bugs | Find them! | Could lose funds |
| Speed | Same as mainnet | Same as testnet |
| Contracts | Real contracts | Real contracts |
| Can redeploy | Yes, unlimited | Yes, but costs $ |

**Testnet contracts work EXACTLY like mainnet, just with fake money.**

---

## 🆘 TROUBLESHOOTING

### "Insufficient funds"
**Solution:** Get more testnet ETH from faucet (Step 1)

### "Network error"
**Solution:** Check internet connection, try again

### "Private key invalid"
**Solution:** Make sure key starts with `0x` and is 66 characters

### Deployment fails
**Solution:** Make sure you have enough testnet ETH (0.1 ETH should be plenty)

### Can't find contracts on Basescan
**Solution:** Make sure you're using https://sepolia.basescan.org (NOT regular Basescan)

---

## ✅ ONCE TESTNET WORKS WELL

**After testing for days/weeks on testnet:**

1. **Confident everything works?** ✅
2. **Found and fixed bugs?** ✅
3. **Tested all edge cases?** ✅
4. **Ready for real world?** ✅

**Then consider:**
- Mainnet deployment with $100-200 total (tiny amounts first)
- OR get professional audit before bigger amounts
- OR run bug bounty program first

**But START with testnet!**

---

## 🎯 QUICK DEPLOY SUMMARY

**Testnet deployment = 4 steps:**

1. **Get FREE testnet ETH** (2 min) - coinbase.com/faucets/base-ethereum-sepolia-faucet
2. **Clone repo + install** (5 min) - `git clone` + `npm install`
3. **Add private key** (2 min) - Create `.env` file
4. **Deploy!** (10 min) - `npx hardhat run scripts/deploy-all-bonds.js --network baseSepolia`

**Total time:** ~20 minutes
**Total cost:** $0 (FREE!)
**Risk:** ZERO

---

## 🎉 YOU'RE READY FOR TESTNET!

**Everything is set up:**
- ✅ Contracts compile
- ✅ Tests pass (22/22)
- ✅ Deployment script ready
- ✅ Testnet configuration added
- ✅ FREE testnet ETH available
- ✅ Zero financial risk

**Just follow Steps 1-7 and you'll have all 9 contracts live on testnet in ~20 minutes!** 🚀

---

**Network:** Base Sepolia Testnet
**Chain ID:** 84532
**RPC:** https://sepolia.base.org
**Explorer:** https://sepolia.basescan.org
**Faucet:** https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
**Cost:** FREE 🎉
