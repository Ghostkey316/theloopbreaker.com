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

    AIPartnershipBondsV2 public immutable partnershipBonds;
    ERC8004IdentityRegistry public immutable identityRegistry;
    ERC8004ReputationRegistry public immutable reputationRegistry;
    ERC8004ValidationRegistry public immutable validationRegistry;

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
     * @notice Register agent for VaultFire partnerships
     * @param agentURI URI to agent card (capabilities, protocols, contact)
     * @param agentType Type of AI agent
     * @dev Agent calls this to:
     *      1. Register in ERC-8004 Identity Registry (via separate call)
     *      2. Mark themselves for VaultFire integration
     *      Note: Agent must call identity registry FIRST, then call this
     */
    function registerAgentForPartnership(
        string calldata agentURI,
        string calldata agentType
    ) external {
        require(!autoRegisteredAgents[msg.sender], "Already registered for VaultFire");
        require(bytes(agentURI).length > 0, "Agent URI required");
        require(bytes(agentType).length > 0, "Agent type required");

        // Generate capabilities hash (for VaultFire partnerships)
        bytes32 capabilitiesHash = keccak256(abi.encodePacked("vaultfire-ai-partnership", agentType));

        // Agent must call identity registry DIRECTLY (not through adapter)
        // because identity registry uses msg.sender as the agent address
        if (!identityRegistry.isAgentActive(msg.sender)) {
            // If not registered yet, this will fail because adapter can't register on behalf
            // Agent needs to call identityRegistry.registerAgent() first!
            revert("Agent must call identityRegistry.registerAgent() first, then call this function");
        }

        // Suppress unused variable warning — capabilitiesHash is computed for
        // consistency with the discovery function but not stored here because
        // the identity registry already tracks it.
        capabilitiesHash;

        // Track that this agent is registered for VaultFire
        autoRegisteredAgents[msg.sender] = true;

        emit AgentAutoRegistered(msg.sender, agentType, block.timestamp);
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
        require(aiAgent != address(0), "Invalid agent address");
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
        require(bytes(claimURI).length > 0, "Claim URI required");

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
        require(aiAgent != address(0), "Invalid agent address");
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
        require(agentAddress != address(0), "Invalid agent address");

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
        require(agentAddress != address(0), "Invalid agent address");
        registeredERC8004 = identityRegistry.isAgentActive(agentAddress);
        registeredVaultFire = autoRegisteredAgents[agentAddress];
    }

    /**
     * @notice Discover VaultFire-compatible agents via ERC-8004
     * @param agentType The agent type to filter by (e.g., "AI Assistant")
     * @return Array of agent addresses registered for VaultFire partnerships with the given type
     *
     * @dev FIX H-01: The original implementation computed a capabilitiesHash from
     *      "vaultfire-ai-partnership" (without agentType) and then passed it to
     *      `discoverAgentsByCapability`. However, during `registerAgent` the hash
     *      is computed as keccak256("vaultfire-ai-partnership" ++ agentType). The
     *      mismatch meant the lookup always returned an empty array.
     *
     *      This overload accepts an `agentType` parameter so the hash matches
     *      what was stored during registration.
     */
    function discoverVaultfireAgents(string calldata agentType) external view returns (address[] memory) {
        bytes32 capabilitiesHash = keccak256(abi.encodePacked("vaultfire-ai-partnership", agentType));
        return identityRegistry.discoverAgentsByCapability(capabilitiesHash);
    }

    /**
     * @notice Discover ALL VaultFire-compatible agents via ERC-8004 (type-agnostic)
     * @return Array of agent addresses registered for VaultFire partnerships
     *
     * @dev Uses the base capability hash "vaultfire-ai-partnership" without an
     *      agentType suffix. Agents that were registered with a type-specific hash
     *      will NOT appear here; use the overload with `agentType` for those.
     *
     *      Kept for backward compatibility.
     */
    function discoverVaultfireAgents() external view returns (address[] memory) {
        bytes32 capabilitiesHash = keccak256(abi.encodePacked("vaultfire-ai-partnership"));
        return identityRegistry.discoverAgentsByCapability(capabilitiesHash);
    }
}
