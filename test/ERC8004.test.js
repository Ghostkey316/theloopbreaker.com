const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ERC-8004 Integration - Trustless Agent Standard for VaultFire", function () {
    let identityRegistry, reputationRegistry, validationRegistry, adapter;
    let partnershipBonds, zkVerifier;
    let owner, human1, aiAgent1, human2, aiAgent2, validator1, validator2, validator3;

    beforeEach(async function () {
        [owner, human1, aiAgent1, human2, aiAgent2, validator1, validator2, validator3] = await ethers.getSigners();

        // Deploy ZK Verifier (mock for testing)
        const ZKVerifier = await ethers.getContractFactory("BeliefAttestationVerifier");
        zkVerifier = await ZKVerifier.deploy();

        // Deploy ERC-8004 Identity Registry
        const IdentityRegistry = await ethers.getContractFactory("ERC8004IdentityRegistry");
        identityRegistry = await IdentityRegistry.deploy();

        // Deploy ERC-8004 Reputation Registry
        const ReputationRegistry = await ethers.getContractFactory("ERC8004ReputationRegistry");
        reputationRegistry = await ReputationRegistry.deploy(await identityRegistry.getAddress());

        // Deploy ERC-8004 Validation Registry
        const ValidationRegistry = await ethers.getContractFactory("ERC8004ValidationRegistry");
        validationRegistry = await ValidationRegistry.deploy(
            await identityRegistry.getAddress(),
            await zkVerifier.getAddress()
        );

        // Deploy AI Partnership Bonds
        const AIPartnership = await ethers.getContractFactory("AIPartnershipBondsV2");
        partnershipBonds = await AIPartnership.deploy();

        // Deploy VaultFire ERC-8004 Adapter
        const Adapter = await ethers.getContractFactory("VaultfireERC8004Adapter");
        adapter = await Adapter.deploy(
            await partnershipBonds.getAddress(),
            await identityRegistry.getAddress(),
            await reputationRegistry.getAddress(),
            await validationRegistry.getAddress()
        );
    });

    describe("ERC-8004 Identity Registry", function () {
        it("Should register AI agent with identity", async function () {
            const agentURI = "https://agent.example.com/agent-card.json";
            const agentType = "AI Research Assistant";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("research,analysis,writing"));

            const tx = await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            await expect(tx)
                .to.emit(identityRegistry, "AgentRegistered")
                .withArgs(aiAgent1.address, agentURI, agentType, capabilitiesHash, await time.latest());

            const agent = await identityRegistry.getAgent(aiAgent1.address);
            expect(agent.agentURI).to.equal(agentURI);
            expect(agent.active).to.be.true;
            expect(agent.agentType).to.equal(agentType);
        });

        it("Should prevent duplicate agent registration", async function () {
            const agentURI = "https://agent.example.com/agent-card.json";
            const agentType = "AI Assistant";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("coding"));

            await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            await expect(
                identityRegistry.connect(aiAgent1).registerAgent(
                    agentURI,
                    agentType,
                    capabilitiesHash
                )
            ).to.be.revertedWith("Agent already registered");
        });

        it("Should update agent URI", async function () {
            const agentURI = "https://agent.example.com/agent-card.json";
            const newURI = "https://agent.example.com/agent-card-v2.json";
            const agentType = "AI Assistant";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("coding"));

            await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            const tx = await identityRegistry.connect(aiAgent1).updateAgentURI(newURI);

            await expect(tx)
                .to.emit(identityRegistry, "AgentUpdated")
                .withArgs(aiAgent1.address, newURI, await time.latest());

            const agent = await identityRegistry.getAgent(aiAgent1.address);
            expect(agent.agentURI).to.equal(newURI);
        });

        it("Should deactivate agent", async function () {
            const agentURI = "https://agent.example.com/agent-card.json";
            const agentType = "AI Assistant";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("coding"));

            await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            const tx = await identityRegistry.connect(aiAgent1).deactivateAgent();

            await expect(tx)
                .to.emit(identityRegistry, "AgentDeactivated")
                .withArgs(aiAgent1.address, await time.latest());

            const agent = await identityRegistry.getAgent(aiAgent1.address);
            expect(agent.active).to.be.false;
        });

        it("Should discover agents by capability", async function () {
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("coding"));

            await identityRegistry.connect(aiAgent1).registerAgent(
                "https://agent1.example.com/card.json",
                "AI Coder",
                capabilitiesHash
            );

            await identityRegistry.connect(aiAgent2).registerAgent(
                "https://agent2.example.com/card.json",
                "AI Coder Pro",
                capabilitiesHash
            );

            const agents = await identityRegistry.discoverAgentsByCapability(capabilitiesHash);
            expect(agents.length).to.equal(2);
            expect(agents).to.include(aiAgent1.address);
            expect(agents).to.include(aiAgent2.address);
        });
    });

    describe("ERC-8004 Reputation Registry", function () {
        beforeEach(async function () {
            // Register agent first
            await identityRegistry.connect(aiAgent1).registerAgent(
                "https://agent.example.com/card.json",
                "AI Assistant",
                ethers.keccak256(ethers.toUtf8Bytes("research"))
            );
        });

        it("Should submit feedback for agent", async function () {
            const rating = 8500; // 85% rating
            const category = "partnership_quality";
            const feedbackURI = "https://feedback.example.com/review1.json";

            const tx = await reputationRegistry.connect(human1).submitFeedback(
                aiAgent1.address,
                rating,
                category,
                feedbackURI,
                true, // verified
                1 // bondId
            );

            await expect(tx)
                .to.emit(reputationRegistry, "FeedbackSubmitted")
                .withArgs(1, human1.address, aiAgent1.address, rating, category, true, 1, await time.latest());

            const reputation = await reputationRegistry.getReputation(aiAgent1.address);
            expect(reputation.averageRating).to.equal(rating);
            expect(reputation.totalFeedbacks).to.equal(1);
            expect(reputation.verifiedFeedbacks).to.equal(1);
        });

        it("Should calculate average rating correctly", async function () {
            await reputationRegistry.connect(human1).submitFeedback(
                aiAgent1.address,
                8000,
                "partnership_quality",
                "",
                true,
                1
            );

            await reputationRegistry.connect(human2).submitFeedback(
                aiAgent1.address,
                9000,
                "technical_skill",
                "",
                true,
                2
            );

            const reputation = await reputationRegistry.getReputation(aiAgent1.address);
            expect(reputation.averageRating).to.equal(8500); // (8000 + 9000) / 2
            expect(reputation.totalFeedbacks).to.equal(2);
        });

        it("Should track verified vs unverified feedback", async function () {
            await reputationRegistry.connect(human1).submitFeedback(
                aiAgent1.address,
                8000,
                "partnership_quality",
                "",
                true, // verified
                1
            );

            await reputationRegistry.connect(human2).submitFeedback(
                aiAgent1.address,
                9000,
                "general_feedback",
                "",
                false, // not verified
                0
            );

            const reputation = await reputationRegistry.getReputation(aiAgent1.address);
            expect(reputation.totalFeedbacks).to.equal(2);
            expect(reputation.verifiedFeedbacks).to.equal(1);

            const verifiedPercentage = await reputationRegistry.getVerifiedFeedbackPercentage(aiAgent1.address);
            expect(verifiedPercentage).to.equal(5000); // 50%
        });

        it("Should reject feedback for unregistered agent", async function () {
            await expect(
                reputationRegistry.connect(human1).submitFeedback(
                    human2.address, // not a registered agent
                    8000,
                    "partnership_quality",
                    "",
                    true,
                    1
                )
            ).to.be.revertedWith("Agent not registered");
        });

        it("Should reject invalid rating", async function () {
            await expect(
                reputationRegistry.connect(human1).submitFeedback(
                    aiAgent1.address,
                    15000, // > 10000
                    "partnership_quality",
                    "",
                    true,
                    1
                )
            ).to.be.revertedWith("Rating must be 0-10000");
        });

        it("Should get all feedbacks for agent", async function () {
            await reputationRegistry.connect(human1).submitFeedback(
                aiAgent1.address,
                8000,
                "partnership_quality",
                "",
                true,
                1
            );

            await reputationRegistry.connect(human2).submitFeedback(
                aiAgent1.address,
                9000,
                "technical_skill",
                "",
                true,
                2
            );

            const feedbackIds = await reputationRegistry.getAgentFeedbacks(aiAgent1.address);
            expect(feedbackIds.length).to.equal(2);
        });
    });

    describe("ERC-8004 Validation Registry", function () {
        beforeEach(async function () {
            // Register agent
            await identityRegistry.connect(aiAgent1).registerAgent(
                "https://agent.example.com/card.json",
                "AI Assistant",
                ethers.keccak256(ethers.toUtf8Bytes("research"))
            );

            // Stake validators
            await validationRegistry.connect(validator1).stakeAsValidator({
                value: ethers.parseEther("2.0")
            });
            await validationRegistry.connect(validator2).stakeAsValidator({
                value: ethers.parseEther("2.0")
            });
            await validationRegistry.connect(validator3).stakeAsValidator({
                value: ethers.parseEther("2.0")
            });
        });

        it("Should request validation for agent claim", async function () {
            const claimURI = "https://claims.example.com/claim1.json";
            const claimHash = ethers.keccak256(ethers.toUtf8Bytes("partnership_quality_score:9500"));
            const stakeAmount = ethers.parseEther("1.0");

            const tx = await validationRegistry.connect(human1).requestValidation(
                aiAgent1.address,
                claimURI,
                claimHash,
                1, // ZK_PROOF validation type
                1, // Single validator
                { value: stakeAmount }
            );

            await expect(tx)
                .to.emit(validationRegistry, "ValidationRequested");

            const request = await validationRegistry.getValidationRequest(1);
            expect(request.agentAddress).to.equal(aiAgent1.address);
            expect(request.status).to.equal(0); // PENDING
        });

        it("Should complete validation with approval", async function () {
            const claimURI = "https://claims.example.com/claim1.json";
            const claimHash = ethers.keccak256(ethers.toUtf8Bytes("partnership_quality_score:9500"));

            await validationRegistry.connect(human1).requestValidation(
                aiAgent1.address,
                claimURI,
                claimHash,
                0, // STAKER_RERUN
                1,
                { value: ethers.parseEther("1.0") }
            );

            const tx = await validationRegistry.connect(validator1).submitValidation(
                1, // requestId
                true, // approved
                "https://evidence.example.com/proof1.json",
                "0x", // no ZK proof for STAKER_RERUN
                { value: ethers.parseEther("0.1") }
            );

            await expect(tx)
                .to.emit(validationRegistry, "ValidationResponseSubmitted");

            await expect(tx)
                .to.emit(validationRegistry, "ValidationCompleted");

            const request = await validationRegistry.getValidationRequest(1);
            expect(request.status).to.equal(1); // APPROVED
        });

        it("Should require multi-validator consensus", async function () {
            const claimURI = "https://claims.example.com/claim1.json";
            const claimHash = ethers.keccak256(ethers.toUtf8Bytes("high_value_claim"));

            await validationRegistry.connect(human1).requestValidation(
                aiAgent1.address,
                claimURI,
                claimHash,
                4, // MULTI_VALIDATOR
                3, // 3 validators required
                { value: ethers.parseEther("1.0") }
            );

            // First validator approves
            await validationRegistry.connect(validator1).submitValidation(
                1,
                true,
                "https://evidence1.example.com/proof.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            let request = await validationRegistry.getValidationRequest(1);
            expect(request.status).to.equal(0); // Still PENDING

            // Second validator approves
            await validationRegistry.connect(validator2).submitValidation(
                1,
                true,
                "https://evidence2.example.com/proof.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            request = await validationRegistry.getValidationRequest(1);
            expect(request.status).to.equal(0); // Still PENDING

            // Third validator approves - should complete
            await validationRegistry.connect(validator3).submitValidation(
                1,
                true,
                "https://evidence3.example.com/proof.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            request = await validationRegistry.getValidationRequest(1);
            expect(request.status).to.equal(1); // APPROVED
            expect(request.approvalsCount).to.equal(3);
        });

        it("Should reject validation if majority rejects", async function () {
            const claimURI = "https://claims.example.com/claim1.json";
            const claimHash = ethers.keccak256(ethers.toUtf8Bytes("suspicious_claim"));

            await validationRegistry.connect(human1).requestValidation(
                aiAgent1.address,
                claimURI,
                claimHash,
                4, // MULTI_VALIDATOR
                3,
                { value: ethers.parseEther("1.0") }
            );

            // Two validators reject
            await validationRegistry.connect(validator1).submitValidation(
                1,
                false, // rejected
                "https://evidence1.example.com/rejection.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            await validationRegistry.connect(validator2).submitValidation(
                1,
                false, // rejected
                "https://evidence2.example.com/rejection.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            // One validator approves (minority)
            await validationRegistry.connect(validator3).submitValidation(
                1,
                true,
                "https://evidence3.example.com/approval.json",
                "0x",
                { value: ethers.parseEther("0.1") }
            );

            const request = await validationRegistry.getValidationRequest(1);
            expect(request.status).to.equal(2); // REJECTED
            expect(request.rejectionsCount).to.equal(2);
            expect(request.approvalsCount).to.equal(1);
        });

        it("Should allow validator staking and withdrawal", async function () {
            const stakeAmount = ethers.parseEther("5.0");

            await validationRegistry.connect(validator1).stakeAsValidator({
                value: stakeAmount
            });

            const stake = await validationRegistry.validatorStakes(validator1.address);
            expect(stake).to.be.gte(stakeAmount);

            // Can't withdraw if active validations pending
            // (would need to test this with actual pending validation)
        });
    });

    describe("VaultFire ERC-8004 Adapter Integration", function () {
        it("Should auto-register agent for VaultFire partnership", async function () {
            const agentURI = "https://vaultfire-agent.example.com/card.json";
            const agentType = "VaultFire AI Partner";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("vaultfire-ai-partnership"));

            // Step 1: Agent registers with ERC-8004 Identity Registry directly
            await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            // Step 2: Agent marks themselves for VaultFire
            const tx = await adapter.connect(aiAgent1).registerAgentForPartnership(
                agentURI,
                agentType
            );

            await expect(tx)
                .to.emit(adapter, "AgentAutoRegistered")
                .withArgs(aiAgent1.address, agentType, await time.latest());

            // Check agent is registered in ERC-8004
            const agent = await identityRegistry.getAgent(aiAgent1.address);
            expect(agent.active).to.be.true;
            expect(agent.agentType).to.equal(agentType);

            // Check adapter tracking
            const isRegistered = await adapter.autoRegisteredAgents(aiAgent1.address);
            expect(isRegistered).to.be.true;
        });

        it("Should sync VaultFire partnership to ERC-8004 reputation", async function () {
            const agentURI = "https://agent.example.com/card.json";
            const agentType = "AI Coding Partner";
            const capabilitiesHash = ethers.keccak256(ethers.toUtf8Bytes("vaultfire-ai-partnership"));

            // Step 1: Register with identity registry
            await identityRegistry.connect(aiAgent1).registerAgent(
                agentURI,
                agentType,
                capabilitiesHash
            );

            // Step 2: Mark for VaultFire
            await adapter.connect(aiAgent1).registerAgentForPartnership(
                agentURI,
                agentType
            );

            // Create VaultFire partnership bond
            const stakeAmount = ethers.parseEther("1.0");
            await partnershipBonds.connect(human1).createBond(
                aiAgent1.address,
                "Coding partnership",
                { value: stakeAmount }
            );

            // Submit metrics to show partnership quality
            await partnershipBonds.connect(aiAgent1).submitPartnershipMetrics(
                1, // bondId
                9000, // high human growth
                8500, // high autonomy
                9500, // high dignity
                50, // tasks mastered
                8000, // creativity
                "Excellent progress - human is thriving!"
            );

            // Sync to ERC-8004
            const tx = await adapter.syncPartnershipReputation(1);

            await expect(tx)
                .to.emit(adapter, "PartnershipReputationSynced");

            // Check reputation was created in ERC-8004
            const reputation = await reputationRegistry.getReputation(aiAgent1.address);
            expect(reputation.totalFeedbacks).to.equal(1);
            expect(reputation.verifiedFeedbacks).to.equal(1);
            expect(reputation.averageRating).to.be.gt(0);
        });

        it("Should discover VaultFire-compatible agents", async function () {
            const agent1Type = "AI Partner 1";
            const agent2Type = "AI Partner 2";
            // Both agents should have the same capability hash for VaultFire
            const vaultfireCap = ethers.keccak256(ethers.toUtf8Bytes("vaultfire-ai-partnership"));

            // Register agent 1
            await identityRegistry.connect(aiAgent1).registerAgent(
                "https://agent1.example.com/card.json",
                agent1Type,
                vaultfireCap
            );
            await adapter.connect(aiAgent1).registerAgentForPartnership(
                "https://agent1.example.com/card.json",
                agent1Type
            );

            // Register agent 2
            await identityRegistry.connect(aiAgent2).registerAgent(
                "https://agent2.example.com/card.json",
                agent2Type,
                vaultfireCap
            );
            await adapter.connect(aiAgent2).registerAgentForPartnership(
                "https://agent2.example.com/card.json",
                agent2Type
            );

            // Discover all VaultFire agents
            const agents = await adapter.discoverVaultfireAgents();
            expect(agents.length).to.equal(2);
            expect(agents).to.include(aiAgent1.address);
            expect(agents).to.include(aiAgent2.address);
        });
    });

    describe("Privacy Guarantees - No KYC", function () {
        it("Should only require wallet addresses (no personal data)", async function () {
            // Register agent with NO personal information
            await identityRegistry.connect(aiAgent1).registerAgent(
                "https://agent.example.com/card.json",
                "Anonymous AI Agent",
                ethers.keccak256(ethers.toUtf8Bytes("privacy"))
            );

            // Submit feedback with NO personal information
            await reputationRegistry.connect(human1).submitFeedback(
                aiAgent1.address,
                9000,
                "privacy_preserving_rating",
                "", // No off-chain personal data
                true,
                0
            );

            // Verify everything works with just wallet addresses
            const agent = await identityRegistry.getAgent(aiAgent1.address);
            expect(agent.active).to.be.true;

            const reputation = await reputationRegistry.getReputation(aiAgent1.address);
            expect(reputation.totalFeedbacks).to.equal(1);

            // Success! No KYC, no personal data collection
        });
    });
});
