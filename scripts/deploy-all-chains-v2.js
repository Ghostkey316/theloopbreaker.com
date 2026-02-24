const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);

  console.log(`\n================================================================`);
  console.log(`🚀 DEPLOYING TO: ${networkName.toUpperCase()} (Chain ID: ${chainId})`);
  console.log(`👤 DEPLOYER: ${deployer.address}`);
  console.log(`💰 BALANCE: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH/AVAX`);
  console.log(`================================================================\n`);

  const results = {
    network: networkName,
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  const deployed = {};
  let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);

  async function deploy(name, alias, params) {
    console.log(`\n📦 Deploying ${alias}...`);
    try {
      const Factory = await hre.ethers.getContractFactory(name);
      const feeData = await hre.ethers.provider.getFeeData();
      const overrides = { nonce: currentNonce };
      
      if (chainId === 1) {
          // EXTREMELY conservative for Ethereum Mainnet to squeeze in remaining contracts
          // Use current gas price without any buffer
          overrides.maxFeePerGas = feeData.maxFeePerGas;
          overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
          // Use lower gas limit to pass "have vs want" check
          overrides.gasLimit = 1500000; 
      } else {
          if (feeData.maxFeePerGas) {
              overrides.maxFeePerGas = (feeData.maxFeePerGas * 150n) / 100n;
              overrides.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 150n) / 100n;
          } else {
              overrides.gasPrice = (feeData.gasPrice * 150n) / 100n;
          }
      }

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
      await new Promise(r => setTimeout(r, 2000));
      return address;
    } catch (error) {
      console.error(`❌ Failed to deploy ${alias}: ${error.message}`);
      results.contracts[alias] = { error: error.message };
      if (error.message.includes("nonce too low")) {
          currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
          console.log(`🔄 Synced nonce to ${currentNonce}. Retrying...`);
          return await deploy(name, alias, params);
      }
      return null;
    }
  }

  // Core Contracts
  deployed.MissionEnforcement = await deploy("MissionEnforcement", "MissionEnforcement", []);
  deployed.AntiSurveillance = await deploy("AntiSurveillance", "AntiSurveillance", []);
  deployed.PrivacyGuarantees = await deploy("PrivacyGuarantees", "PrivacyGuarantees", []);
  deployed.ERC8004IdentityRegistry = await deploy("ERC8004IdentityRegistry", "ERC8004IdentityRegistry", []);
  deployed.BeliefAttestationVerifier = await deploy("BeliefAttestationVerifier", "BeliefAttestationVerifier", []);
  deployed.AIPartnershipBondsV2 = await deploy("AIPartnershipBondsV2", "AIPartnershipBondsV2", []);
  deployed.FlourishingMetricsOracle = await deploy("FlourishingMetricsOracle", "FlourishingMetricsOracle", []);
  deployed.AIAccountabilityBondsV2 = await deploy("AIAccountabilityBondsV2", "AIAccountabilityBondsV2", [deployer.address]);
  
  // Dependent contracts
  deployed.ERC8004ReputationRegistry = await deploy("ERC8004ReputationRegistry", "ERC8004ReputationRegistry", [deployed.ERC8004IdentityRegistry || hre.ethers.ZeroAddress]);
  deployed.ERC8004ValidationRegistry = await deploy("ERC8004ValidationRegistry", "ERC8004ValidationRegistry", [deployed.ERC8004IdentityRegistry || hre.ethers.ZeroAddress, deployed.BeliefAttestationVerifier || hre.ethers.ZeroAddress]);
  deployed.VaultfireERC8004Adapter = await deploy("VaultfireERC8004Adapter", "VaultfireERC8004Adapter", [
    deployed.AIPartnershipBondsV2 || hre.ethers.ZeroAddress,
    deployed.ERC8004IdentityRegistry || hre.ethers.ZeroAddress,
    deployed.ERC8004ReputationRegistry || hre.ethers.ZeroAddress,
    deployed.ERC8004ValidationRegistry || hre.ethers.ZeroAddress
  ]);
  
  deployed.MultisigGovernance = await deploy("MultisigGovernance", "MultisigGovernance", [[deployer.address], 1]);
  
  let riscZeroRouter = "0x0b144e07a0826182b6b59788c34b32bfa86fb711";
  if (chainId !== 8453) riscZeroRouter = deployer.address;
  const imageId = "0x" + "f".repeat(64);
  deployed.ProductionBeliefAttestationVerifier = await deploy("ProductionBeliefAttestationVerifier", "ProductionBeliefAttestationVerifier", [riscZeroRouter, imageId]);
  
  deployed.DilithiumAttestor = await deploy("DilithiumAttestor", "DilithiumAttestor", [deployer.address, false, hre.ethers.ZeroAddress]);

  if (chainId === 1) {
    deployed.TrustDataBridge = await deploy("TrustPortabilityExtension", "TrustDataBridge", [hre.ethers.ZeroAddress, 200000]);
  } else {
    deployed.VaultfireTeleporterBridge = await deploy("VaultfireTeleporterBridge", "VaultfireTeleporterBridge", [hre.ethers.ZeroAddress, 200000]);
  }

  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const outputPath = path.join(dir, `redeployment-${networkName}-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Deployment report saved to: ${outputPath}`);
  console.log(`\n================================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
