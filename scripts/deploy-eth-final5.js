const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== 1) throw new Error("This script is only for Ethereum Mainnet!");

  console.log(`\n================================================================`);
  console.log(`🚀 ETHEREUM — DEPLOYING FINAL 5 CONTRACTS (AUTO GAS)`);
  console.log(`👤 DEPLOYER: ${deployer.address}`);
  const startBal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 BALANCE: ${hre.ethers.formatEther(startBal)} ETH`);
  console.log(`================================================================\n`);

  // Already deployed on Ethereum (confirmed on-chain, nonces 1-6, 7-8, 10-12, 13, 18-20)
  const alreadyDeployed = {
    MissionEnforcement: "0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58",
    AntiSurveillance: "0xfDdd2B1597c87577543176AB7f49D587876563D2",
    PrivacyGuarantees: "0x8aceF0Bc7e07B2dE35E9069663953f41B5422218",
    ERC8004IdentityRegistry: "0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C",
    BeliefAttestationVerifier: "0x613585B786af2d5ecb1c3e712CE5ffFB8f53f155",
    AIPartnershipBondsV2: "0x247F31bB2b5a0d28E68bf24865AA242965FF99cd",
    FlourishingMetricsOracle: "0x690411685278548157409FA7AC8279A5B1Fb6F78",
    MultisigGovernance: "0x227e27e7776d3ee14128BC66216354495E113B19",
    ProductionBeliefAttestationVerifier: "0xea6B504827a746d781f867441364C7A732AA4b07",
    DilithiumAttestor: "0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695",
  };

  const results = {
    network: "ethereum",
    chainId: 1,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // Copy already deployed
  for (const [k, v] of Object.entries(alreadyDeployed)) {
    results.contracts[k] = { address: v, status: "previously_deployed" };
  }

  const deployed = { ...alreadyDeployed };
  let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log(`📍 Starting nonce: ${currentNonce}\n`);

  async function deploy(name, alias, params) {
    console.log(`📦 Deploying ${alias}...`);
    try {
      const Factory = await hre.ethers.getContractFactory(name);
      
      // AUTO GAS ESTIMATION — no hardcoded gasLimit
      const feeData = await hre.ethers.provider.getFeeData();
      const overrides = { 
        nonce: currentNonce,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        // NO gasLimit — let ethers.js estimate automatically
      };

      const contract = await Factory.deploy(...params, overrides);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      const tx = contract.deploymentTransaction();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      
      console.log(`✅ ${alias}: ${address} (nonce ${currentNonce}, gas ${gasUsed.toString()})`);
      
      deployed[alias] = address;
      results.contracts[alias] = {
        address: address,
        transactionHash: tx.hash,
        gasUsed: gasUsed.toString()
      };
      
      currentNonce++;
      await new Promise(r => setTimeout(r, 3000));
      return address;
    } catch (error) {
      console.error(`❌ FAILED ${alias}: ${error.message.substring(0, 200)}`);
      results.contracts[alias] = { error: error.message.substring(0, 500) };
      if (error.message.includes("nonce too low") || error.message.includes("Nonce too low")) {
        currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
        console.log(`🔄 Synced nonce to ${currentNonce}. Retrying...`);
        return await deploy(name, alias, params);
      }
      return null;
    }
  }

  // Deploy the 5 remaining contracts in dependency order
  // 1. AIAccountabilityBondsV2 (needs deployer as payable treasury)
  deployed.AIAccountabilityBondsV2 = await deploy(
    "AIAccountabilityBondsV2", "AIAccountabilityBondsV2", [deployer.address]
  );

  // 2. ERC8004ReputationRegistry (depends on IdentityRegistry)
  deployed.ERC8004ReputationRegistry = await deploy(
    "ERC8004ReputationRegistry", "ERC8004ReputationRegistry", 
    [deployed.ERC8004IdentityRegistry]
  );

  // 3. ERC8004ValidationRegistry (depends on IdentityRegistry + BeliefAttestationVerifier)
  deployed.ERC8004ValidationRegistry = await deploy(
    "ERC8004ValidationRegistry", "ERC8004ValidationRegistry",
    [deployed.ERC8004IdentityRegistry, deployed.BeliefAttestationVerifier]
  );

  // 4. VaultfireERC8004Adapter (depends on Bonds, Identity, Reputation, Validation)
  if (deployed.ERC8004ReputationRegistry && deployed.ERC8004ValidationRegistry) {
    deployed.VaultfireERC8004Adapter = await deploy(
      "VaultfireERC8004Adapter", "VaultfireERC8004Adapter",
      [
        deployed.AIPartnershipBondsV2,
        deployed.ERC8004IdentityRegistry,
        deployed.ERC8004ReputationRegistry,
        deployed.ERC8004ValidationRegistry
      ]
    );
  } else {
    console.error("❌ SKIPPING VaultfireERC8004Adapter — dependencies failed");
  }

  // 5. TrustDataBridge (TrustPortabilityExtension)
  deployed.TrustDataBridge = await deploy(
    "TrustPortabilityExtension", "TrustDataBridge", 
    [hre.ethers.ZeroAddress, 200000]
  );

  // Save results
  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const outputPath = path.join(dir, `redeployment-ethereum-final5-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Saved: ${outputPath}`);

  const finalBal = await hre.ethers.provider.getBalance(deployer.address);
  const spent = startBal - finalBal;
  console.log(`💰 FINAL BALANCE: ${hre.ethers.formatEther(finalBal)} ETH`);
  console.log(`💸 TOTAL SPENT: ${hre.ethers.formatEther(spent)} ETH`);
  console.log(`\n================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
