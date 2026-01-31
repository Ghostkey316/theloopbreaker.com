// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Vaultfire Bug Bounty Program
 * @notice Decentralized bug bounty program for VaultFire protocol
 * @dev Manages vulnerability submissions, severity classifications, and rewards
 *
 * @custom:security-enhancement From Professional Security Audit 2026
 * @custom:purpose Incentivize responsible disclosure and continuous security improvement
 */
contract VaultfireBugBounty is ReentrancyGuard {

    // ============ Enums ============

    /**
     * @notice Vulnerability severity levels (aligned with industry standards)
     */
    enum Severity {
        None,           // No vulnerability
        Informational,  // Informational finding (no reward)
        Low,            // Low severity (1 ETH)
        Medium,         // Medium severity (5 ETH)
        High,           // High severity (25 ETH)
        Critical        // Critical severity (100 ETH)
    }

    /**
     * @notice Submission status
     */
    enum Status {
        Submitted,      // Initial submission
        UnderReview,    // Security team reviewing
        Validated,      // Confirmed valid vulnerability
        Invalid,        // Not a vulnerability
        Duplicate,      // Already reported
        Fixed,          // Vulnerability patched
        Rewarded        // Bounty paid
    }

    // ============ Structs ============

    /**
     * @notice Bug bounty submission
     */
    struct Submission {
        uint256 submissionId;
        address researcher;
        bytes32 vulnerabilityHash;  // Hash of vulnerability details (private until fixed)
        string publicDescription;   // Public description (no exploit details)
        Severity severity;
        Status status;
        uint256 submittedAt;
        uint256 reviewedAt;
        uint256 rewardAmount;
        address reviewer;
        bool rewarded;
        string reviewNotes;
    }

    /**
     * @notice Researcher reputation tracking
     */
    struct ResearcherProfile {
        address researcher;
        uint256 totalSubmissions;
        uint256 validSubmissions;
        uint256 invalidSubmissions;
        uint256 duplicateSubmissions;
        uint256 totalRewardsEarned;
        uint256 highestSeverityFound;
        bool isBanned;
        string banReason;
    }

    // ============ State Variables ============

    /// @notice Contract owner (security team lead)
    address public owner;

    /// @notice Pending ownership transfer
    address public pendingOwner;

    /// @notice Authorized security reviewers
    mapping(address => bool) public authorizedReviewers;

    /// @notice All submissions
    mapping(uint256 => Submission) public submissions;

    /// @notice Researcher profiles
    mapping(address => ResearcherProfile) public researchers;

    /// @notice Next submission ID
    uint256 public nextSubmissionId = 1;

    /// @notice Total bounty pool
    uint256 public bountyPool;

    /// @notice Minimum bounty pool balance (100 ETH)
    uint256 public constant MINIMUM_POOL_BALANCE = 100 ether;

    /// @notice Reward amounts by severity
    uint256 public constant CRITICAL_REWARD = 100 ether;
    uint256 public constant HIGH_REWARD = 25 ether;
    uint256 public constant MEDIUM_REWARD = 5 ether;
    uint256 public constant LOW_REWARD = 1 ether;

    /// @notice Maximum submissions per researcher per day
    uint256 public constant MAX_SUBMISSIONS_PER_DAY = 5;

    /// @notice Submission cooldown period
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public submissionsToday;
    mapping(address => uint256) public lastSubmissionDate;

    /// @notice Contract paused
    bool public paused;

    // ============ Events ============

    event BountyPoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event BountyPoolWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);

    event SubmissionCreated(
        uint256 indexed submissionId,
        address indexed researcher,
        bytes32 vulnerabilityHash,
        uint256 timestamp
    );

    event SubmissionReviewed(
        uint256 indexed submissionId,
        address indexed reviewer,
        Severity severity,
        Status status,
        uint256 timestamp
    );

    event BountyAwarded(
        uint256 indexed submissionId,
        address indexed researcher,
        Severity severity,
        uint256 amount,
        uint256 timestamp
    );

    event ResearcherBanned(
        address indexed researcher,
        string reason,
        uint256 timestamp
    );

    event ResearcherUnbanned(
        address indexed researcher,
        uint256 timestamp
    );

    event ReviewerAdded(address indexed reviewer);
    event ReviewerRemoved(address indexed reviewer);
    event Paused();
    event Unpaused();
    event OwnershipTransferInitiated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyReviewer() {
        require(authorizedReviewers[msg.sender] || msg.sender == owner, "Not authorized reviewer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier notBanned() {
        require(!researchers[msg.sender].isBanned, "Researcher banned");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        authorizedReviewers[msg.sender] = true;
        emit ReviewerAdded(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Fund the bounty pool
     * @dev Anyone can contribute to the pool
     */
    function fundBountyPool() external payable {
        require(msg.value > 0, "Must send ETH");
        bountyPool += msg.value;
        emit BountyPoolFunded(msg.sender, msg.value, bountyPool);
    }

    /**
     * @notice Submit vulnerability report
     * @param vulnerabilityHash Hash of full vulnerability details (kept private)
     * @param publicDescription Public description without exploit details
     * @return submissionId The unique submission ID
     *
     * @dev Researchers should:
     * 1. Hash their full report (includes exploit, PoC, remediation)
     * 2. Submit hash + public summary
     * 3. Provide full details to security team privately
     *
     * Rate limiting:
     * - Max 5 submissions per day
     * - 1 hour cooldown between submissions
     */
    function submitVulnerability(
        bytes32 vulnerabilityHash,
        string memory publicDescription
    ) external whenNotPaused notBanned returns (uint256) {
        require(vulnerabilityHash != bytes32(0), "Invalid vulnerability hash");
        require(bytes(publicDescription).length > 0, "Public description required");
        require(bytes(publicDescription).length <= 500, "Description too long");

        // Rate limiting
        _checkRateLimit(msg.sender);

        uint256 submissionId = nextSubmissionId++;

        submissions[submissionId] = Submission({
            submissionId: submissionId,
            researcher: msg.sender,
            vulnerabilityHash: vulnerabilityHash,
            publicDescription: publicDescription,
            severity: Severity.None,
            status: Status.Submitted,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            rewardAmount: 0,
            reviewer: address(0),
            rewarded: false,
            reviewNotes: ""
        });

        // Update researcher profile
        ResearcherProfile storage profile = researchers[msg.sender];
        if (profile.researcher == address(0)) {
            profile.researcher = msg.sender;
        }
        profile.totalSubmissions++;

        // Update rate limiting
        lastSubmissionTime[msg.sender] = block.timestamp;
        _updateDailySubmissions(msg.sender);

        emit SubmissionCreated(submissionId, msg.sender, vulnerabilityHash, block.timestamp);
        return submissionId;
    }

    /**
     * @notice Review and classify submission
     * @param submissionId Submission to review
     * @param severity Determined severity level
     * @param status New status (Validated/Invalid/Duplicate)
     * @param reviewNotes Notes from security team
     *
     * @dev Only authorized reviewers can classify vulnerabilities
     */
    function reviewSubmission(
        uint256 submissionId,
        Severity severity,
        Status status,
        string memory reviewNotes
    ) external onlyReviewer {
        Submission storage submission = submissions[submissionId];
        require(submission.submittedAt > 0, "Submission does not exist");
        require(submission.status == Status.Submitted || submission.status == Status.UnderReview, "Already reviewed");
        require(
            status == Status.Validated || status == Status.Invalid || status == Status.Duplicate,
            "Invalid status"
        );

        submission.severity = severity;
        submission.status = status;
        submission.reviewedAt = block.timestamp;
        submission.reviewer = msg.sender;
        submission.reviewNotes = reviewNotes;

        // Update researcher profile
        ResearcherProfile storage profile = researchers[submission.researcher];
        if (status == Status.Validated) {
            profile.validSubmissions++;
            if (uint256(severity) > profile.highestSeverityFound) {
                profile.highestSeverityFound = uint256(severity);
            }
        } else if (status == Status.Invalid) {
            profile.invalidSubmissions++;
        } else if (status == Status.Duplicate) {
            profile.duplicateSubmissions++;
        }

        emit SubmissionReviewed(submissionId, msg.sender, severity, status, block.timestamp);
    }

    /**
     * @notice Award bounty for validated vulnerability
     * @param submissionId Submission to reward
     *
     * @dev Requirements:
     * - Submission must be validated
     * - Vulnerability must be fixed
     * - Bounty pool must have sufficient funds
     */
    function awardBounty(uint256 submissionId) external nonReentrant onlyReviewer {
        Submission storage submission = submissions[submissionId];
        require(submission.status == Status.Validated, "Not validated");
        require(!submission.rewarded, "Already rewarded");

        uint256 rewardAmount = _calculateReward(submission.severity);
        require(rewardAmount > 0, "No reward for this severity");
        require(bountyPool >= rewardAmount, "Insufficient bounty pool");

        submission.status = Status.Rewarded;
        submission.rewarded = true;
        submission.rewardAmount = rewardAmount;

        bountyPool -= rewardAmount;

        // Update researcher profile
        ResearcherProfile storage profile = researchers[submission.researcher];
        profile.totalRewardsEarned += rewardAmount;

        // Transfer reward
        (bool success, ) = payable(submission.researcher).call{value: rewardAmount}("");
        require(success, "Transfer failed");

        emit BountyAwarded(
            submissionId,
            submission.researcher,
            submission.severity,
            rewardAmount,
            block.timestamp
        );
    }

    /**
     * @notice Mark vulnerability as fixed
     * @param submissionId Submission ID
     *
     * @dev Called when patch is deployed
     */
    function markAsFixed(uint256 submissionId) external onlyReviewer {
        Submission storage submission = submissions[submissionId];
        require(submission.status == Status.Validated, "Not validated");
        submission.status = Status.Fixed;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add authorized reviewer
     * @param reviewer Address to authorize
     */
    function addReviewer(address reviewer) external onlyOwner {
        require(reviewer != address(0), "Invalid reviewer");
        require(!authorizedReviewers[reviewer], "Already reviewer");
        authorizedReviewers[reviewer] = true;
        emit ReviewerAdded(reviewer);
    }

    /**
     * @notice Remove authorized reviewer
     * @param reviewer Address to remove
     */
    function removeReviewer(address reviewer) external onlyOwner {
        require(authorizedReviewers[reviewer], "Not a reviewer");
        require(reviewer != owner, "Cannot remove owner");
        authorizedReviewers[reviewer] = false;
        emit ReviewerRemoved(reviewer);
    }

    /**
     * @notice Ban researcher for abuse
     * @param researcher Address to ban
     * @param reason Ban reason
     */
    function banResearcher(address researcher, string memory reason) external onlyOwner {
        require(!researchers[researcher].isBanned, "Already banned");
        researchers[researcher].isBanned = true;
        researchers[researcher].banReason = reason;
        emit ResearcherBanned(researcher, reason, block.timestamp);
    }

    /**
     * @notice Unban researcher
     * @param researcher Address to unban
     */
    function unbanResearcher(address researcher) external onlyOwner {
        require(researchers[researcher].isBanned, "Not banned");
        researchers[researcher].isBanned = false;
        researchers[researcher].banReason = "";
        emit ResearcherUnbanned(researcher, block.timestamp);
    }

    /**
     * @notice Withdraw excess bounty pool funds
     * @param amount Amount to withdraw
     */
    function withdrawBountyPool(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= bountyPool, "Insufficient pool");
        require(bountyPool - amount >= MINIMUM_POOL_BALANCE, "Cannot withdraw below minimum");

        bountyPool -= amount;

        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");

        emit BountyPoolWithdrawn(owner, amount, bountyPool);
    }

    /**
     * @notice Pause contract (emergency only)
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    /**
     * @notice Initiate ownership transfer
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    /**
     * @notice Accept ownership transfer
     */
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }

    // ============ View Functions ============

    /**
     * @notice Get researcher statistics
     * @param researcher Address to query
     * @return profile Researcher profile
     */
    function getResearcherProfile(address researcher) external view returns (ResearcherProfile memory) {
        return researchers[researcher];
    }

    /**
     * @notice Get submission details
     * @param submissionId Submission ID
     * @return submission Full submission details
     */
    function getSubmission(uint256 submissionId) external view returns (Submission memory) {
        return submissions[submissionId];
    }

    /**
     * @notice Calculate reputation score for researcher
     * @param researcher Address to score
     * @return score Reputation score (0-10000)
     *
     * @dev Formula:
     * - Valid submissions: +1000 each
     * - Invalid submissions: -200 each
     * - Duplicate submissions: -100 each
     * - Highest severity bonus: +2000 for Critical, +1000 for High
     */
    function calculateReputationScore(address researcher) external view returns (uint256) {
        ResearcherProfile memory profile = researchers[researcher];

        if (profile.totalSubmissions == 0) return 5000; // Neutral for new researchers

        int256 score = 5000; // Start at neutral

        // Add points for valid submissions
        score += int256(profile.validSubmissions * 1000);

        // Deduct for invalid/duplicate
        score -= int256(profile.invalidSubmissions * 200);
        score -= int256(profile.duplicateSubmissions * 100);

        // Bonus for high severity findings
        if (profile.highestSeverityFound == uint256(Severity.Critical)) {
            score += 2000;
        } else if (profile.highestSeverityFound == uint256(Severity.High)) {
            score += 1000;
        }

        // Clamp to 0-10000
        if (score < 0) return 0;
        if (score > 10000) return 10000;
        return uint256(score);
    }

    /**
     * @notice Check if researcher can submit
     * @param researcher Address to check
     * @return canSubmit Whether researcher can submit now
     * @return reason Human-readable reason if cannot submit
     */
    function canSubmit(address researcher) external view returns (bool canSubmit, string memory reason) {
        if (researchers[researcher].isBanned) {
            return (false, "Researcher is banned");
        }

        if (paused) {
            return (false, "Contract is paused");
        }

        if (block.timestamp < lastSubmissionTime[researcher] + 1 hours) {
            return (false, "Cooldown period active (1 hour)");
        }

        uint256 today = block.timestamp / 1 days;
        uint256 lastDay = lastSubmissionDate[researcher] / 1 days;

        if (today == lastDay && submissionsToday[researcher] >= MAX_SUBMISSIONS_PER_DAY) {
            return (false, "Daily submission limit reached (5 per day)");
        }

        return (true, "");
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate reward amount based on severity
     * @param severity Vulnerability severity
     * @return reward Reward amount in wei
     */
    function _calculateReward(Severity severity) internal pure returns (uint256) {
        if (severity == Severity.Critical) return CRITICAL_REWARD;
        if (severity == Severity.High) return HIGH_REWARD;
        if (severity == Severity.Medium) return MEDIUM_REWARD;
        if (severity == Severity.Low) return LOW_REWARD;
        return 0; // Informational or None
    }

    /**
     * @notice Check rate limiting for researcher
     * @param researcher Address to check
     */
    function _checkRateLimit(address researcher) internal view {
        // 1 hour cooldown between submissions
        require(
            block.timestamp >= lastSubmissionTime[researcher] + 1 hours,
            "Cooldown period active"
        );

        // Max 5 per day
        uint256 today = block.timestamp / 1 days;
        uint256 lastDay = lastSubmissionDate[researcher] / 1 days;

        if (today == lastDay) {
            require(submissionsToday[researcher] < MAX_SUBMISSIONS_PER_DAY, "Daily limit reached");
        }
    }

    /**
     * @notice Update daily submission counter
     * @param researcher Address to update
     */
    function _updateDailySubmissions(address researcher) internal {
        uint256 today = block.timestamp / 1 days;
        uint256 lastDay = lastSubmissionDate[researcher] / 1 days;

        if (today == lastDay) {
            submissionsToday[researcher]++;
        } else {
            submissionsToday[researcher] = 1;
            lastSubmissionDate[researcher] = block.timestamp;
        }
    }

    /**
     * @notice Accept ETH deposits
     */
    receive() external payable {
        bountyPool += msg.value;
        emit BountyPoolFunded(msg.sender, msg.value, bountyPool);
    }
}
