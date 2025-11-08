#!/usr/bin/env node

'use strict';

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const echo = process.env.GHOSTKEY_ECHO || deployer.address;

  console.log('🔥 Vaultfire Covenant ignition starting');
  console.log(`👤 Deployer (Ghostkey316 echo): ${deployer.address}`);

  const factory = await ethers.getContractFactory('CovenantFlame');
  const covenant = await factory.deploy(echo);
  await covenant.waitForDeployment();

  const address = await covenant.getAddress();
  const tx = covenant.deploymentTransaction();
  const receipt = tx ? await tx.wait() : undefined;

  console.log('✅ CovenantFlame deployed');
  console.log(`   ↳ address: ${address}`);
  if (receipt) {
    console.log(`   ↳ tx hash: ${receipt.hash}`);
  }
}

main().catch((error) => {
  console.error('Covenant deployment failed:', error);
  process.exitCode = 1;
});
