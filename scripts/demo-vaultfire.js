/**
 * Vaultfire Protocol — Interactive Demo Script
 *
 * Walks through the complete Vaultfire trust loop on any supported chain
 * (Base mainnet, Avalanche mainnet, or Avalanche Fuji testnet).
 *
 * This is designed for the Avalanche Build Games demo/showcase.
 *
 * Steps:
 *   1. Register an AI agent in ERC8004IdentityRegistry
 *   2. Create a Partnership Bond between the deployer and the agent
 *   3. Submit a reputation feedback (belief attestation simulation)
 *   4. Check reputation scores
 *   5. Show the full trust loop working
 *
 * Usage:
 *   npx hardhat run scripts/demo-vaultfire.js --network avalancheFuji
 *   npx hardhat run scripts/demo-vaultfire.js --network baseMainnet
 *   npx hardhat run scripts/demo-vaultfire.js --network hardhat
 *
 * Required environment variables:
 *   PRIVATE_KEY — deployer wallet private key
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Contract addresses — resolved per network
// ---------------------------------------------------------------------------

const BASE_MAINNET_CONTRACTS = {
  PrivacyGuarantees: "0x227e27e7776d3ee14128BC66216354495E113B19",
  MissionEnforcement: "0x8568F4020FCD55915dB3695558dD6D2532599e56",
  AntiSurveillance: "0x722E37A7D6f27896C688336AaaFb0dDA80D25E57",
  ERC8004IdentityRegistry: "0x35978DB675576598F0781dA2133E94cdCf4858bC",
  BeliefAttestationVerifier: "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
  ERC8004ReputationRegistry: "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
  ERC8004ValidationRegistry: "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
  AIPartnershipBondsV2: "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4",
  AIAccountabilityBondsV2: "0xf92baef9523BC264144F80F9c31D5c5C017c6Da8",
  VaultfireERC8004Adapter: "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
  MultisigGovernance: "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
  FlourishingMetricsOracle: "0x83dd216449B3F0574E39043ECFE275946fa492e9",
  ProductionBeliefAttestationVerifier: "0xa5CEC47B48999EB398707838E3A18dd20A1ae272",
};

function loadFujiContracts() {
  const fujiPath = path.join(__dirname, "..", "deployments", "fuji-deployment.json");
  if (fs.existsSync(fujiPath)) {
    const data = JSON.parse(fs.readFileSync(fujiPath, "utf8"));
    return data.contracts;
  }
  return null;
}

function resolveContracts(networkName) {
  if (networkName === "baseMainnet") {
    return BASE_MAINNET_CONTRACTS;
  }
  if (networkName === "avalancheFuji") {
    const fuji = loadFujiContracts();
    if (!fuji) {
      console.error(
        "\n  [ERROR] No Fuji deployment found.\n" +
        "  Run the deployment first:\n" +
        "    npx hardhat run scripts/deploy-fuji-ready.js --network avalancheFuji\n"
      );
      process.exit(1);
    }
    return fuji;
  }
  // For hardhat local network, we deploy fresh contracts inline
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function banner(title) {
  console.log("\n" + "=".repeat(80));
  console.log("  " + title);
  console.log("=".repeat(80) + "\n");
}

function step(num, title) {
  console.log("-".repeat(60));
  console.log(`  Step ${num}: ${title}`);
  console.log("-".repeat(60) + "\n");
}

function result(label, value) {
  console.log(`    ${label}: ${value}`);
}

async function deployFresh(name, args = []) {
  const Factory = await hre.ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  return { contract, address: await contract.getAddress() };
}

// ---------------------------------------------------------------------------
// Main Demo
// ---------------------------------------------------------------------------

async function main() {
  const networkName = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  banner("VAULTFIRE PROTOCOL — INTERACTIVE DEMO");
  console.log(`  Network : ${networkName} (Chain ID ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance : ${hre.ethers.formatEther(balance)} ${networkName.includes("avax") || networkName.includes("avalanche") || networkName.includes("Fuji") ? "AVAX" : "ETH"}`);
  console.log();

  // ========================================================================
  // Resolve or deploy contracts
  // ========================================================================
  let addresses = resolveContracts(networkName);
  let identityRegistry, partnershipBonds, reputationRegistry;

  if (addresses) {
    // Attach to existing deployed contracts
    console.log("  Using deployed contracts from " + networkName + "\n");
    identityRegistry = await hre.ethers.getContractAt(
      "ERC8004IdentityRegistry",
      addresses.ERC8004IdentityRegistry
    );
    partnershipBonds = await hre.ethers.getContractAt(
      "AIPartnershipBondsV2",
      addresses.AIPartnershipBondsV2
    );
    reputationRegistry = await hre.ethers.getContractAt(
      "ERC8004ReputationRegistry",
      addresses.ERC8004ReputationRegistry
    );
  } else {
    // Local Hardhat network — deploy fresh contracts for the demo
    console.log("  Deploying fresh contracts on local Hardhat network...\n");

    const ir = await deployFresh("ERC8004IdentityRegistry");
    identityRegistry = ir.contract;

    const bv = await deployFresh("BeliefAttestationVerifier");

    const pb = await deployFresh("AIPartnershipBondsV2");
    partnershipBonds = pb.contract;

    const rr = await deployFresh("ERC8004ReputationRegistry", [ir.address]);
    reputationRegistry = rr.contract;

    addresses = {
      ERC8004IdentityRegistry: ir.address,
      AIPartnershipBondsV2: pb.address,
      ERC8004ReputationRegistry: rr.address,
    };

    console.log("  Contracts deployed locally.\n");
  }

  // We need a second signer to act as the AI agent (different from deployer)
  let agentSigner;
  if (signers.length > 1) {
    agentSigner = signers[1];
  } else {
    // On live networks with a single signer, create a random wallet for the agent
    agentSigner = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
    // Fund the agent wallet with a small amount for gas
    const fundTx = await deployer.sendTransaction({
      to: agentSigner.address,
      value: hre.ethers.parseEther("0.01"),
    });
    await fundTx.wait();
    console.log(`  Funded demo agent wallet: ${agentSigner.address}\n`);
  }

  // ========================================================================
  // Step 1: Register an AI Agent
  // ========================================================================
  step(1, "Register an AI Agent in ERC8004IdentityRegistry");

  const agentURI = "https://vaultfire.io/agents/demo-sentinel";
  const agentType = "autonomous-sentinel";
  const capabilities = ["protocol-monitoring", "health-checks", "metrics-reporting"];
  const capabilitiesHash = hre.ethers.keccak256(
    hre.ethers.toUtf8Bytes(capabilities.join(","))
  );

  // Check if already registered
  const isActive = await identityRegistry.isAgentActive(agentSigner.address);
  if (isActive) {
    console.log("  Agent is already registered. Skipping registration.\n");
  } else {
    const regTx = await identityRegistry
      .connect(agentSigner)
      .registerAgent(agentURI, agentType, capabilitiesHash);
    const regReceipt = await regTx.wait();
    console.log("  Agent registered successfully.\n");
    result("TX Hash", regReceipt.hash);
  }

  result("Agent Address", agentSigner.address);
  result("Agent URI", agentURI);
  result("Agent Type", agentType);
  result("Capabilities Hash", capabilitiesHash);

  // Verify registration
  const agentData = await identityRegistry.getAgent(agentSigner.address);
  result("Registered At", new Date(Number(agentData.registeredAt) * 1000).toISOString());
  result("Active", agentData.active.toString());

  const totalAgents = await identityRegistry.getTotalAgents();
  result("Total Agents in Registry", totalAgents.toString());
  console.log();

  // ========================================================================
  // Step 2: Create a Partnership Bond
  // ========================================================================
  step(2, "Create a Partnership Bond (Human <> AI Agent)");

  const stakeAmount = hre.ethers.parseEther("0.001");
  const partnershipType = "trust-infrastructure-sentinel";

  console.log(`  Human (deployer) : ${deployer.address}`);
  console.log(`  AI Agent         : ${agentSigner.address}`);
  console.log(`  Partnership Type : ${partnershipType}`);
  console.log(`  Stake Amount     : ${hre.ethers.formatEther(stakeAmount)} ${networkName.includes("avax") || networkName.includes("avalanche") || networkName.includes("Fuji") ? "AVAX" : "ETH"}\n`);

  const bondTx = await partnershipBonds
    .connect(deployer)
    .createBond(agentSigner.address, partnershipType, { value: stakeAmount });
  const bondReceipt = await bondTx.wait();

  // Parse BondCreated event
  let bondId;
  for (const log of bondReceipt.logs) {
    try {
      const parsed = partnershipBonds.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });
      if (parsed && parsed.name === "BondCreated") {
        bondId = parsed.args.bondId;
        break;
      }
    } catch {
      // Not our event, skip
    }
  }

  console.log("  Partnership Bond created successfully.\n");
  result("Bond ID", bondId ? bondId.toString() : "N/A");
  result("TX Hash", bondReceipt.hash);

  // Read bond details
  if (bondId !== undefined) {
    const bond = await partnershipBonds.getBond(bondId);
    result("Bond Human", bond.human);
    result("Bond AI Agent", bond.aiAgent);
    result("Bond Stake", hre.ethers.formatEther(bond.stakeAmount));
    result("Bond Active", bond.active.toString());
    result("Created At", new Date(Number(bond.createdAt) * 1000).toISOString());
  }
  console.log();

  // ========================================================================
  // Step 3: Submit a Reputation Feedback (Belief Attestation Simulation)
  // ========================================================================
  step(3, "Submit Reputation Feedback (Belief Attestation)");

  const rating = 8500; // 85% — high trust score
  const category = "partnership_quality";
  const feedbackURI = "ipfs://QmDemo...VaultfireBuildGames2026";
  const verified = true;
  const feedbackBondId = bondId ? bondId : 0;

  console.log(`  Reviewer       : ${deployer.address} (human partner)`);
  console.log(`  Agent Reviewed : ${agentSigner.address}`);
  console.log(`  Rating         : ${rating / 100}% (${rating} basis points)`);
  console.log(`  Category       : ${category}`);
  console.log(`  Verified       : ${verified} (from active bond)\n`);

  const feedbackTx = await reputationRegistry
    .connect(deployer)
    .submitFeedback(
      agentSigner.address,
      rating,
      category,
      feedbackURI,
      verified,
      feedbackBondId
    );
  const feedbackReceipt = await feedbackTx.wait();

  console.log("  Feedback submitted successfully.\n");
  result("TX Hash", feedbackReceipt.hash);
  console.log();

  // ========================================================================
  // Step 4: Check Reputation Scores
  // ========================================================================
  step(4, "Check Reputation Scores");

  const reputation = await reputationRegistry.getReputation(agentSigner.address);

  result("Average Rating", `${Number(reputation.averageRating) / 100}% (${reputation.averageRating.toString()} bps)`);
  result("Total Feedbacks", reputation.totalFeedbacks.toString());
  result("Verified Feedbacks", reputation.verifiedFeedbacks.toString());
  result(
    "Last Updated",
    reputation.lastUpdated > 0
      ? new Date(Number(reputation.lastUpdated) * 1000).toISOString()
      : "N/A"
  );
  console.log();

  // ========================================================================
  // Step 5: Full Trust Loop Summary
  // ========================================================================
  banner("TRUST LOOP COMPLETE");

  console.log("  The Vaultfire Protocol trust loop has been demonstrated:\n");
  console.log("    1. IDENTITY    — AI agent registered with ERC-8004 identity");
  console.log("                     on-chain, discoverable, verifiable.\n");
  console.log("    2. PARTNERSHIP — Economic bond created between human and AI.");
  console.log("                     Stake locked. Both parties accountable.\n");
  console.log("    3. ATTESTATION — Human partner submitted verified feedback.");
  console.log("                     Belief attestation recorded on-chain.\n");
  console.log("    4. REPUTATION  — Agent reputation score computed from");
  console.log("                     verified partnership data. Portable.\n");
  console.log("  This is the foundation of verifiable trust between");
  console.log("  humans and AI agents. No gatekeeping. No surveillance.");
  console.log("  Just cryptographic proof of partnership quality.\n");

  console.log("-".repeat(60));
  console.log("  Contract Addresses Used:");
  console.log("-".repeat(60));
  console.log(`    ERC8004IdentityRegistry  : ${addresses.ERC8004IdentityRegistry}`);
  console.log(`    AIPartnershipBondsV2     : ${addresses.AIPartnershipBondsV2}`);
  console.log(`    ERC8004ReputationRegistry: ${addresses.ERC8004ReputationRegistry}`);
  console.log();

  if (networkName === "avalancheFuji") {
    console.log("  View on Snowtrace:");
    console.log(`    https://testnet.snowtrace.io/address/${addresses.ERC8004IdentityRegistry}`);
    console.log(`    https://testnet.snowtrace.io/address/${addresses.AIPartnershipBondsV2}`);
    console.log(`    https://testnet.snowtrace.io/address/${addresses.ERC8004ReputationRegistry}`);
  } else if (networkName === "baseMainnet") {
    console.log("  View on BaseScan:");
    console.log(`    https://basescan.org/address/${addresses.ERC8004IdentityRegistry}`);
    console.log(`    https://basescan.org/address/${addresses.AIPartnershipBondsV2}`);
    console.log(`    https://basescan.org/address/${addresses.ERC8004ReputationRegistry}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("  Vaultfire Protocol — Trust Infrastructure for the AI Age");
  console.log("  Dashboard: https://theloopbreaker.com");
  console.log("  GitHub: https://github.com/Ghostkey316/ghostkey-316-vaultfire-init");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n  Demo failed:\n");
    console.error(error);
    process.exit(1);
  });
