#!/usr/bin/env node

'use strict';

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const ghostEcho = process.env.GHOSTKEY_ECHO || deployer.address;
  const guardian = process.env.GUARDIAN_ADDRESS || deployer.address;
  const rewardStreamAddress = process.env.REWARD_STREAM_ADDRESS;
  const attestorAddress = process.env.DILITHIUM_ATTESTOR_ADDRESS;

  if (!rewardStreamAddress) {
    throw new Error('REWARD_STREAM_ADDRESS env var is required');
  }
  if (!attestorAddress) {
    throw new Error('DILITHIUM_ATTESTOR_ADDRESS env var is required');
  }

  console.log('🚀 Sovereign ignition initiated');
  console.log(`   ↳ deployer: ${deployer.address}`);
  console.log(`   ↳ guardian: ${guardian}`);
  console.log(`   ↳ rewardStream: ${rewardStreamAddress}`);
  console.log(`   ↳ attestor: ${attestorAddress}`);

  const covenantFactory = await ethers.getContractFactory('CovenantFlame');
  const covenant = await covenantFactory.deploy(ghostEcho);
  await covenant.waitForDeployment();
  const covenantAddress = await covenant.getAddress();
  const covenantTx = covenant.deploymentTransaction();
  if (covenantTx) {
    await covenantTx.wait();
  }
  console.log(`🔥 CovenantFlame @ ${covenantAddress}`);

  const oracleFactory = await ethers.getContractFactory('BeliefOracle');
  const oracle = await oracleFactory.deploy(attestorAddress, rewardStreamAddress, guardian, ghostEcho);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  const oracleTx = oracle.deploymentTransaction();
  if (oracleTx) {
    await oracleTx.wait();
  }
  console.log(`🔮 BeliefOracle @ ${oracleAddress}`);

  const rewardStream = await ethers.getContractAt('RewardStream', rewardStreamAddress);
  try {
    const governorTx = await rewardStream.updateGovernorTimelock(oracleAddress);
    await governorTx.wait();
    console.log('   ↳ RewardStream governor set to BeliefOracle');
  } catch (error) {
    console.warn('⚠️  Unable to set RewardStream governor:', error.message);
  }

  const freedomFactory = await ethers.getContractFactory('FreedomVow');
  const freedom = await freedomFactory.deploy(attestorAddress, rewardStreamAddress, guardian, ghostEcho);
  await freedom.waitForDeployment();
  const freedomAddress = await freedom.getAddress();
  const freedomTx = freedom.deploymentTransaction();
  if (freedomTx) {
    await freedomTx.wait();
  }
  console.log(`🕊️  FreedomVow @ ${freedomAddress}`);

  try {
    const adminTx = await rewardStream.transferAdmin(freedomAddress);
    await adminTx.wait();
    console.log('   ↳ RewardStream admin transferred to FreedomVow');
  } catch (error) {
    console.warn('⚠️  Unable to transfer RewardStream admin:', error.message);
  }

  const recordTx = await covenant.recordIgnition(oracleAddress, freedomAddress);
  await recordTx.wait();
  console.log('📜 Covenant record updated');

  console.log('✅ Sovereign stack online.');
}

main().catch((error) => {
  console.error('Deploy sequence failed:', error);
  process.exitCode = 1;
});
