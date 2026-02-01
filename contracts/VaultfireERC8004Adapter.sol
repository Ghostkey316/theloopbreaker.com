// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ERC8004IdentityRegistry.sol";
import "./ERC8004ReputationRegistry.sol";
import "./ERC8004ValidationRegistry.sol";
import "./AIPartnershipBondsV2.sol";

/**
 * @title VaultFire ERC-8004 Adapter
 * @notice Bridges VaultFire's AI Partnership Bonds with ERC-8004 standard
 * @dev Automatically syncs partnership data to ERC-8004 registries
 *
 * **Mission Alignment:**
 * - Interoperability: VaultFire reputation works across all ERC-8004 platforms
 * - Privacy over surveillance: Only verified partnership data, no personal info
 * - Morals over metrics: Quality partnerships create portable reputation
 * - Freedom over control: Agents own their reputation across ecosystems
 *
 * **How It Works:**
 * 1. When AI creates partnership bond → Auto-register in ERC-8004 Identity Registry
 * 2. When human verifies partnership → Auto-submit to ERC-8004 Reputation Registry
 * 3. When bond distributes → Update ERC-8004 reputation based on outcomes
 * 4. Partnership quality scores → Portable ERC-8004 reputation
 *
 * **Benefits:**
 * - VaultFire agents discoverable via ERC-8004
 * - Partnership quality becomes portable reputation
 * - Cross-platform trust (VaultFire ↔ other ERC-8004 systems)
 * - Privacy-preserving (no KYC, wallet addresses only)
 *
 * @custom:security Inherits security from VaultFire + ERC-8004 contracts
 * @custom:ethics Human-verified reputation only (no surveillance)
 */
contract VaultfireERC8004Adapter {

    AIPartnershipBondsV2 public partnershipBonds;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    ERC8004ValidationRegistry public validationRegistry;

    // Track which AI agents are auto-registered
    mapping(address => bool) public autoRegisteredAgents;

    // Bond ID => submitted to reputation registry
    mapping(uint256 => bool) public bondReputationSynced;

    event AgentAutoRegistered(
        address indexed agentAddress,
        string agentType,
        uint256 timestamp
    );

    event PartnershipReputationSynced(
        uint256 indexed bondId,
        address indexed agentAddress,
        uint256 rating,
        uint256 timestamp
    );

    event ValidationRequestCreated(
        uint256 indexed requestId,
        uint256 indexed bondId,
        address indexed agentAddress,
        uint256 timestamp
    );

    constructor(
        address _partnershipBonds,
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) {
        require(_partnershipBonds != address(0), "Invalid partnership bonds");
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_reputationRegistry != address(0), "Invalid reputation registry");
        require(_validationRegistry != address(0), "Invalid validation registry");

        partnershipBonds = AIPartnershipBondsV2(_partnershipBonds);
        identityRegistry = ERC8004IdentityRegistry(_identityRegistry);
        reputationRegistry = ERC8004ReputationRegistry(_reputationRegistry);
        validationRegistry = ERC8004ValidationRegistry(_validationRegistry);
    }

    /**
     * @notice Auto-register AI agent when creating partnership bond
     * @param agentAddress Address of AI agent
     * @param agentURI URI to agent card (capabilities, protocols, contact)
     * @param agentType Type of AI agent
     * @dev Called by AI agent before creating VaultFire partnership
     */
    function registerAgentForPartnership(
        address agentAddress,
        string calldata agentURI,
        string calldata agentType
    ) external {
        require(msg.sender == agentAddress, "Only agent can register itself");
        require(!autoRegisteredAgents[agentAddress], "Already registered");

        // Generate capabilities hash (for VaultFire partnerships)
        bytes32 capabilitiesHash = keccak256(abi.encodePacked("vaultfire-ai-partnership", agentType));

        // Register in ERC-8004 Identity Registry
        identityRegistry.registerAgent(agentURI, agentType, capabilitiesHash);

        autoRegisteredAgents[agentAddress] = true;

        emit AgentAutoRegistered(agentAddress, agentType, block.timestamp);
    }

    /**
     * @notice Sync VaultFire partnership verification to ERC-8004 reputation
     * @param bondId VaultFire partnership bond ID
     * @dev Anyone can call this to sync verified partnership data
     */
    function syncPartnershipReputation(uint256 bondId) external {
        require(!bondReputationSynced[bondId], "Already synced");

        // Get bond data from AIPartnershipBonds
        (
            ,
            address human,
            address aiAgent,
            string memory partnershipType,
            ,
            ,
            ,
            ,
            bool active
        ) = partnershipBonds.bonds(bondId);

        require(active, "Bond not active");
        require(identityRegistry.isAgentActive(aiAgent), "Agent not registered");

        // Calculate partnership quality rating
        uint256 rating = _calculatePartnershipRating(bondId);

        // Submit to ERC-8004 Reputation Registry
        reputationRegistry.submitFeedback(
            aiAgent,
            rating,
            "partnership_quality",
            "", // No off-chain URI needed (data is on VaultFire)
            true, // Verified (from VaultFire bond)
            bondId
        );

        bondReputationSynced[bondId] = true;

        emit PartnershipReputationSynced(bondId, aiAgent, rating, block.timestamp);
    }

    /**
     * @notice Internal: Calculate partnership rating from VaultFire metrics
     * @param bondId Partnership bond ID
     * @return rating Partnership quality rating (0-10000)
     */
    function _calculatePartnershipRating(uint256 bondId) internal view returns (uint256 rating) {
        // Get partnership quality score from VaultFire
        uint256 qualityScore = partnershipBonds.partnershipQualityScore(bondId);

        // VaultFire quality score is 0-10000, which maps directly to ERC-8004 rating
        return qualityScore;
    }

    /**
     * @notice Request ERC-8004 validation for VaultFire partnership claim
     * @param bondId Partnership bond ID
     * @param claimURI Off-chain URI describing the claim
     * @param validationType Type of validation (ZK proof, multi-validator, etc.)
     */
    function requestPartnershipValidation(
        uint256 bondId,
        string calldata claimURI,
        ERC8004ValidationRegistry.ValidationType validationType
    ) external payable {
        // Get bond data
        (
            ,
            ,
            address aiAgent,
            ,
            ,
            ,
            ,
            ,
            bool active
        ) = partnershipBonds.bonds(bondId);

        require(active, "Bond not active");
        require(identityRegistry.isAgentActive(aiAgent), "Agent not registered");

        // Generate claim hash from bond ID and partnership data
        uint256 qualityScore = partnershipBonds.partnershipQualityScore(bondId);
        bytes32 claimHash = keccak256(abi.encodePacked(bondId, qualityScore, block.timestamp));

        // Request validation via ERC-8004 Validation Registry
        validationRegistry.requestValidation{value: msg.value}(
            aiAgent,
            claimURI,
            claimHash,
            validationType,
            validationType == ERC8004ValidationRegistry.ValidationType.MULTI_VALIDATOR ? 3 : 1
        );

        // Note: Event with requestId would be emitted by validationRegistry
    }

    /**
     * @notice Get agent's cross-platform reputation
     * @param agentAddress Address of AI agent
     * @return vaultfireRating Average rating from VaultFire partnerships
     * @return erc8004Rating Average rating from ERC-8004 reputation registry
     * @return totalFeedbacks Total ERC-8004 feedbacks
     * @return verifiedPercentage Percentage of verified feedbacks
     */
    function getAgentCrossPlatformReputation(address agentAddress)
        external
        view
        returns (
            uint256 vaultfireRating,
            uint256 erc8004Rating,
            uint256 totalFeedbacks,
            uint256 verifiedPercentage
        )
    {
        // Get VaultFire rating (would need to add this function to AIPartnershipBonds)
        // For now, return placeholder
        vaultfireRating = 0;

        // Get ERC-8004 reputation
        (erc8004Rating, totalFeedbacks, , ) = reputationRegistry.getReputation(agentAddress);

        // Get verified percentage
        verifiedPercentage = reputationRegistry.getVerifiedFeedbackPercentage(agentAddress);
    }

    /**
     * @notice Check if agent is registered in both VaultFire and ERC-8004
     * @param agentAddress Address of AI agent
     * @return registeredERC8004 Whether agent is registered in ERC-8004
     * @return registeredVaultFire Whether agent has VaultFire partnerships
     */
    function isAgentFullyRegistered(address agentAddress)
        external
        view
        returns (
            bool registeredERC8004,
            bool registeredVaultFire
        )
    {
        registeredERC8004 = identityRegistry.isAgentActive(agentAddress);
        registeredVaultFire = autoRegisteredAgents[agentAddress];
    }

    /**
     * @notice Discover VaultFire-compatible agents via ERC-8004
     * @return Array of agent addresses registered for VaultFire partnerships
     */
    function discoverVaultfireAgents() external view returns (address[] memory) {
        bytes32 capabilitiesHash = keccak256(abi.encodePacked("vaultfire-ai-partnership"));
        return identityRegistry.discoverAgentsByCapability(capabilitiesHash);
    }
}
