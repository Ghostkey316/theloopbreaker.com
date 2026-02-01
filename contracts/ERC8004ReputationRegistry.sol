// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./PrivacyGuarantees.sol";
import "./ERC8004IdentityRegistry.sol";

/**
 * @title ERC-8004 Reputation Registry for VaultFire
 * @notice Decentralized feedback and rating system for AI agents
 * @dev Implements ERC-8004 reputation tracking with VaultFire privacy guarantees
 *
 * **Mission Alignment:**
 * - Privacy over surveillance: No personal data collection
 * - Morals over metrics: Quality partnerships, not just volume
 * - Human verification: Humans have final say on partnership quality
 * - Freedom over control: Reputation is portable across platforms
 *
 * **ERC-8004 Compliance:**
 * Reputation Registry component for tracking agent performance and trust
 * Feedback from human-AI partnerships recorded on-chain for transparency
 *
 * **Integration with VaultFire:**
 * - Links to AIPartnershipBonds for verified partnership data
 * - Uses HumanVerification for authentic feedback
 * - Prevents fake reviews through economic stakes
 *
 * @custom:security Inherits PrivacyGuarantees
 * @custom:ethics Human-verified feedback only, no surveillance
 */
contract ERC8004ReputationRegistry is PrivacyGuarantees {

    ERC8004IdentityRegistry public identityRegistry;

    struct Feedback {
        address reviewer;          // Human or AI providing feedback
        address agentAddress;      // Agent being reviewed
        uint256 timestamp;
        uint256 rating;            // 0-10000 (basis points)
        string category;           // e.g., "partnership_quality", "technical_skill", "ethics"
        string feedbackURI;        // Off-chain detailed feedback (optional)
        bool verified;             // True if from verified VaultFire partnership
        uint256 bondId;            // VaultFire bond ID (0 if not from bond)
    }

    struct AgentReputation {
        uint256 totalFeedbacks;
        uint256 averageRating;     // 0-10000 (basis points)
        uint256 verifiedFeedbacks; // Count of verified partnership feedbacks
        uint256 lastUpdated;
    }

    // Agent address => reputation summary
    mapping(address => AgentReputation) public reputations;

    // Global feedback ID => Feedback
    mapping(uint256 => Feedback) public feedbacks;
    uint256 public nextFeedbackId = 1;

    // Agent address => feedback IDs
    mapping(address => uint256[]) public agentFeedbacks;

    // Reviewer address => feedback IDs (for transparency)
    mapping(address => uint256[]) public reviewerFeedbacks;

    event FeedbackSubmitted(
        uint256 indexed feedbackId,
        address indexed reviewer,
        address indexed agentAddress,
        uint256 rating,
        string category,
        bool verified,
        uint256 bondId,
        uint256 timestamp
    );

    event ReputationUpdated(
        address indexed agentAddress,
        uint256 averageRating,
        uint256 totalFeedbacks,
        uint256 timestamp
    );

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        identityRegistry = ERC8004IdentityRegistry(_identityRegistry);
    }

    /**
     * @notice Submit feedback for an AI agent
     * @param agentAddress Address of agent being reviewed
     * @param rating Rating score (0-10000, where 10000 = perfect)
     * @param category Feedback category (e.g., "partnership_quality")
     * @param feedbackURI Optional URI to detailed off-chain feedback
     * @param verified True if from verified VaultFire partnership
     * @param bondId VaultFire bond ID (0 if not from bond)
     */
    function submitFeedback(
        address agentAddress,
        uint256 rating,
        string calldata category,
        string calldata feedbackURI,
        bool verified,
        uint256 bondId
    ) external {
        require(identityRegistry.isAgentActive(agentAddress), "Agent not registered");
        require(rating <= 10000, "Rating must be 0-10000");
        require(bytes(category).length > 0, "Category required");

        uint256 feedbackId = nextFeedbackId++;

        feedbacks[feedbackId] = Feedback({
            reviewer: msg.sender,
            agentAddress: agentAddress,
            timestamp: block.timestamp,
            rating: rating,
            category: category,
            feedbackURI: feedbackURI,
            verified: verified,
            bondId: bondId
        });

        agentFeedbacks[agentAddress].push(feedbackId);
        reviewerFeedbacks[msg.sender].push(feedbackId);

        _updateReputation(agentAddress, rating, verified);

        emit FeedbackSubmitted(
            feedbackId,
            msg.sender,
            agentAddress,
            rating,
            category,
            verified,
            bondId,
            block.timestamp
        );
    }

    /**
     * @notice Internal: Update agent's reputation score
     * @param agentAddress Agent whose reputation to update
     * @param newRating New rating to incorporate
     * @param verified Whether this is verified feedback
     */
    function _updateReputation(
        address agentAddress,
        uint256 newRating,
        bool verified
    ) internal {
        AgentReputation storage rep = reputations[agentAddress];

        // Calculate new average using weighted average
        uint256 totalRating = rep.averageRating * rep.totalFeedbacks;
        totalRating += newRating;
        rep.totalFeedbacks += 1;
        rep.averageRating = totalRating / rep.totalFeedbacks;

        if (verified) {
            rep.verifiedFeedbacks += 1;
        }

        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(
            agentAddress,
            rep.averageRating,
            rep.totalFeedbacks,
            block.timestamp
        );
    }

    /**
     * @notice Get agent's reputation summary
     * @param agentAddress Address of agent
     * @return averageRating Average rating (0-10000)
     * @return totalFeedbacks Total number of feedbacks
     * @return verifiedFeedbacks Number of verified partnership feedbacks
     * @return lastUpdated Last update timestamp
     */
    function getReputation(address agentAddress)
        external
        view
        returns (
            uint256 averageRating,
            uint256 totalFeedbacks,
            uint256 verifiedFeedbacks,
            uint256 lastUpdated
        )
    {
        AgentReputation memory rep = reputations[agentAddress];
        return (
            rep.averageRating,
            rep.totalFeedbacks,
            rep.verifiedFeedbacks,
            rep.lastUpdated
        );
    }

    /**
     * @notice Get all feedback IDs for an agent
     * @param agentAddress Address of agent
     * @return Array of feedback IDs
     */
    function getAgentFeedbacks(address agentAddress)
        external
        view
        returns (uint256[] memory)
    {
        return agentFeedbacks[agentAddress];
    }

    /**
     * @notice Get feedback details by ID
     * @param feedbackId Feedback ID
     * @return reviewer Address of reviewer
     * @return agentAddress Agent being reviewed
     * @return rating Rating score
     * @return category Feedback category
     * @return verified Whether verified from partnership
     * @return timestamp When feedback was submitted
     */
    function getFeedback(uint256 feedbackId)
        external
        view
        returns (
            address reviewer,
            address agentAddress,
            uint256 rating,
            string memory category,
            bool verified,
            uint256 timestamp
        )
    {
        Feedback memory f = feedbacks[feedbackId];
        return (
            f.reviewer,
            f.agentAddress,
            f.rating,
            f.category,
            f.verified,
            f.timestamp
        );
    }

    /**
     * @notice Get verified feedback percentage for an agent
     * @param agentAddress Address of agent
     * @return percentage Percentage of verified feedbacks (0-10000)
     */
    function getVerifiedFeedbackPercentage(address agentAddress)
        external
        view
        returns (uint256 percentage)
    {
        AgentReputation memory rep = reputations[agentAddress];
        if (rep.totalFeedbacks == 0) return 0;
        return (rep.verifiedFeedbacks * 10000) / rep.totalFeedbacks;
    }

    /**
     * @notice Get all feedbacks submitted by a reviewer
     * @param reviewer Address of reviewer
     * @return Array of feedback IDs
     */
    function getReviewerFeedbacks(address reviewer)
        external
        view
        returns (uint256[] memory)
    {
        return reviewerFeedbacks[reviewer];
    }
}
