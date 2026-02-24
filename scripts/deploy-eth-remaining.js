const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== 1) throw new Error("This script is only for Ethereum Mainnet!");

  console.log(`\n================================================================`);
  console.log(`🚀 ETHEREUM MAINNET — DEPLOYING REMAINING 9 CONTRACTS`);
  console.log(`👤 DEPLOYER: ${deployer.address}`);
  console.log(`💰 BALANCE: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`================================================================\n`);

  // Already deployed on Ethereum from earlier runs (nonces 1-6, confirmed on-chain)
  const alreadyDeployed = {
    MissionEnforcement: "0x0E777878C5b5248E1b52b09Ab5cdEb2eD6e7Da58",
    AntiSurveillance: "0xfDdd2B1597c87577543176AB7f49D587876563D2",
    PrivacyGuarantees: "0x8aceF0Bc7e07B2dE35E9069663953f41B5422218",
    ERC8004IdentityRegistry: "0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C",
    BeliefAttestationVerifier: "0x613585B786af2d5ecb1c3e712CE5ffFB8f53f155",
    AIPartnershipBondsV2: "0x247F31bB2b5a0d28E68bf24865AA242965FF99cd",
  };

  // Also nonces 7-12 deployed more contracts — let's check what's at those nonces
  // Nonce 7: MissionEnforcement (duplicate), Nonce 8: AntiSurveillance (duplicate)
  // Nonce 10: MissionEnforcement (duplicate), Nonce 11: AntiSurveillance (duplicate), Nonce 12: PrivacyGuarantees (maybe)
  // We need to figure out the current nonce and only deploy what's missing

  const results = {
    network: "ethereum",
    chainId: 1,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: { ...Object.fromEntries(Object.entries(alreadyDeployed).map(([k,v]) => [k, {address: v, status: "previously_deployed"}])) }
  };

  const deployed = { ...alreadyDeployed };
  let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log(`📍 Starting nonce: ${currentNonce}`);

  async function deploy(name, alias, params) {
    console.log(`\n📦 Deploying ${alias}...`);
    try {
      const Factory = await hre.ethers.getContractFactory(name);
      const feeData = await hre.ethers.provider.getFeeData();
      const overrides = { 
        nonce: currentNonce,
        gasLimit: 1500000,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };

      const contract = await Factory.deploy(...params, overrides);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      console.log(`✅ Deployed ${alias} at: ${address} (Nonce: ${currentNonce})`);
      
      deployed[alias] = address;
      results.contracts[alias] = {
        address: address,
        transactionHash: contract.deploymentTransaction().hash
      };
      
      currentNonce++;
      await new Promise(r => setTimeout(r, 3000));
      return address;
    } catch (error) {
      console.error(`❌ Failed to deploy ${alias}: ${error.message}`);
      results.contracts[alias] = { error: error.message };
      if (error.message.includes("nonce too low") || error.message.includes("Nonce too low")) {
          currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
          console.log(`🔄 Synced nonce to ${currentNonce}. Retrying...`);
          return await deploy(name, alias, params);
      }
      return null;
    }
  }

  // Deploy the 9 remaining contracts
  deployed.FlourishingMetricsOracle = await deploy("FlourishingMetricsOracle", "FlourishingMetricsOracle", []);
  deployed.AIAccountabilityBondsV2 = await deploy("AIAccountabilityBondsV2", "AIAccountabilityBondsV2", [deployer.address]);
  deployed.ERC8004ReputationRegistry = await deploy("ERC8004ReputationRegistry", "ERC8004ReputationRegistry", [deployed.ERC8004IdentityRegistry]);
  deployed.ERC8004ValidationRegistry = await deploy("ERC8004ValidationRegistry", "ERC8004ValidationRegistry", [deployed.ERC8004IdentityRegistry, deployed.BeliefAttestationVerifier]);
  deployed.VaultfireERC8004Adapter = await deploy("VaultfireERC8004Adapter", "VaultfireERC8004Adapter", [
    deployed.AIPartnershipBondsV2,
    deployed.ERC8004IdentityRegistry,
    deployed.ERC8004ReputationRegistry || hre.ethers.ZeroAddress,
    deployed.ERC8004ValidationRegistry || hre.ethers.ZeroAddress
  ]);
  deployed.MultisigGovernance = await deploy("MultisigGovernance", "MultisigGovernance", [[deployer.address], 1]);
  
  // ProductionBeliefAttestationVerifier — use deployer address as placeholder verifier on Ethereum
  const imageId = "0x" + "f".repeat(64);
  deployed.ProductionBeliefAttestationVerifier = await deploy("ProductionBeliefAttestationVerifier", "ProductionBeliefAttestationVerifier", [deployer.address, imageId]);
  
  deployed.DilithiumAttestor = await deploy("DilithiumAttestor", "DilithiumAttestor", [deployer.address, false, hre.ethers.ZeroAddress]);
  deployed.TrustDataBridge = await deploy("TrustPortabilityExtension", "TrustDataBridge", [hre.ethers.ZeroAddress, 200000]);

  // Save results
  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const outputPath = path.join(dir, `redeployment-ethereum-final-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Deployment report saved to: ${outputPath}`);

  // Print final balance
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 FINAL BALANCE: ${hre.ethers.formatEther(finalBalance)} ETH`);
  console.log(`\n================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
