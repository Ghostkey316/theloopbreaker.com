// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Escape Velocity Bonds
 * @notice Little guy escaping poverty - $50-$500 stakes
 *
 * Philosophy: Too small for suits to exploit, big enough to change a life.
 * Pay it forward: People who escape help the next person.
 *
 * Key Innovation: Recapture protection - prevents falling back into poverty.
 * 80% to escaper, 20% to pay-it-forward pool for next escapers.
 */
contract EscapeVelocityBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address staker;
        string stakerName;          // Optional pseudonym
        uint256 stakeAmount;
        uint256 initialIncome;      // Poverty baseline
        uint256 createdAt;
        bool active;
        bool escaped;               // Achieved escape velocity
    }

    struct EscapeMetrics {
        uint256 timestamp;
        uint256 currentIncome;      // Current income level
        uint256 autonomyGain;       // 0-10000 (control over time/decisions?)
        uint256 stabilityScore;     // 0-10000 (can weather setbacks?)
        uint256 peopleHelped;       // Pay-it-forward count
        string progressNotes;
    }

    struct CommunityVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsEscape;
        bool confirmsPaidForward;
        string relationship;        // "helped by", "knows from", etc.
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 escaperShare;
        uint256 payItForwardShare;
        string reason;
    }

    // ============ State Variables ============

    uint256 public constant MIN_STAKE = 0.00005 ether; // ~$50 equiv on Base
    uint256 public constant MAX_STAKE = 0.0005 ether;  // ~$500 equiv

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => EscapeMetrics[]) public bondMetrics;
    mapping(uint256 => CommunityVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;

    uint256 public payItForwardPool;  // Pool for helping next escapers

    // Thresholds
    uint256 public constant ESCAPE_VELOCITY_THRESHOLD = 15000;  // 150% income gain = escape
    uint256 public constant RECAPTURE_THRESHOLD = 10000;        // Falling below 100% = recapture

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed staker, uint256 initialIncome);
    event ProgressSubmitted(uint256 indexed bondId, uint256 currentIncome);
    event EscapeVelocityAchieved(uint256 indexed bondId, uint256 incomeGain);
    event RecaptureWarning(uint256 indexed bondId, string reason);
    event CommunityVerificationAdded(uint256 indexed bondId, address indexed verifier);
    event BondDistributed(uint256 indexed bondId, uint256 escaperShare, uint256 payItForwardShare);
    event PayItForwardContribution(uint256 amount);

    // ============ Modifiers ============

    modifier onlyStaker(uint256 bondId) {
        require(bonds[bondId].staker == msg.sender, "Only bond staker");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create Escape Velocity Bond
     * @dev Stakes must be $50-$500 to prevent suit exploitation
     * @param stakerName Optional pseudonym (can be empty)
     * @param initialIncome Starting income (poverty baseline)
     */
    function createBond(
        string memory stakerName,
        uint256 initialIncome
    ) external payable returns (uint256) {
        require(msg.value >= MIN_STAKE && msg.value <= MAX_STAKE, "Stake must be $50-$500 equivalent");
        require(initialIncome > 0, "Must specify initial income");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            staker: msg.sender,
            stakerName: stakerName,
            stakeAmount: msg.value,
            initialIncome: initialIncome,
            createdAt: block.timestamp,
            active: true,
            escaped: false
        });

        emit BondCreated(bondId, msg.sender, initialIncome);
        return bondId;
    }

    /**
     * @notice Submit escape progress
     * @dev Track income growth, autonomy, stability, people helped
     */
    function submitProgress(
        uint256 bondId,
        uint256 currentIncome,
        uint256 autonomyGain,
        uint256 stabilityScore,
        uint256 peopleHelped,
        string memory progressNotes
    ) external onlyStaker(bondId) bondExists(bondId) {
        bondMetrics[bondId].push(EscapeMetrics({
            timestamp: block.timestamp,
            currentIncome: currentIncome,
            autonomyGain: autonomyGain,
            stabilityScore: stabilityScore,
            peopleHelped: peopleHelped,
            progressNotes: progressNotes
        }));

        // Check if escape velocity achieved
        uint256 incomeGain = calculateIncomeGain(bondId);
        if (incomeGain >= ESCAPE_VELOCITY_THRESHOLD && !bonds[bondId].escaped) {
            bonds[bondId].escaped = true;
            emit EscapeVelocityAchieved(bondId, incomeGain);
        }

        // Check for recapture (falling back)
        if (bonds[bondId].escaped && incomeGain < RECAPTURE_THRESHOLD) {
            emit RecaptureWarning(bondId, "Income falling back toward poverty - recapture risk");
        }

        emit ProgressSubmitted(bondId, currentIncome);
    }

    /**
     * @notice Community verification from people helped or who know staker
     * @dev Verifies escape is real and pay-it-forward is happening
     */
    function addCommunityVerification(
        uint256 bondId,
        bool confirmsEscape,
        bool confirmsPaidForward,
        string memory relationship,
        string memory notes
    ) external bondExists(bondId) {
        bondVerifications[bondId].push(CommunityVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            confirmsEscape: confirmsEscape,
            confirmsPaidForward: confirmsPaidForward,
            relationship: relationship,
            notes: notes
        }));

        emit CommunityVerificationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate income gain percentage
     * @dev Returns 10000 = 100% gain (doubled income)
     */
    function calculateIncomeGain(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 0;

        Bond storage bond = bonds[bondId];
        EscapeMetrics storage latest = metrics[metrics.length - 1];

        if (latest.currentIncome <= bond.initialIncome) return 0;

        uint256 gain = ((latest.currentIncome - bond.initialIncome) * 10000) / bond.initialIncome;
        return gain;
    }

    /**
     * @notice Calculate escape success multiplier
     * @dev Based on income gain, autonomy, stability
     * @return multiplier 50-250 (0.5x to 2.5x)
     */
    function escapeSuccessMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        EscapeMetrics storage latest = metrics[metrics.length - 1];
        uint256 incomeGain = calculateIncomeGain(bondId);

        // Income component (0-150)
        uint256 incomeMultiplier = 100 + (incomeGain / 100); // 100% gain = 1.5x
        if (incomeMultiplier > 150) incomeMultiplier = 150;

        // Autonomy/stability component (average, scaled to 0-100)
        uint256 qualityScore = (latest.autonomyGain + latest.stabilityScore) / 2;
        uint256 qualityMultiplier = qualityScore / 100;

        return incomeMultiplier + qualityMultiplier;
    }

    /**
     * @notice Pay-it-forward multiplier
     * @dev Based on people helped
     * @return multiplier 100-200 (1.0x to 2.0x)
     */
    function payItForwardMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        uint256 peopleHelped = metrics[metrics.length - 1].peopleHelped;

        // Each person helped = +20% (capped at 2.0x)
        uint256 multiplier = 100 + (peopleHelped * 20);
        return multiplier > 200 ? 200 : multiplier;
    }

    /**
     * @notice Community verification multiplier
     * @dev Based on verifications from people helped
     * @return multiplier 70-130 (0.7x to 1.3x)
     */
    function communityVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        CommunityVerification[] storage verifications = bondVerifications[bondId];
        uint256 verificationsLength = verifications.length;

        if (verificationsLength == 0) return 100; // Neutral

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 escapeConfirmations = 0;
        uint256 payForwardConfirmations = 0;

        for (uint256 i = verificationsLength; i > 0;) {
            unchecked { --i; }
            if (verifications[i].timestamp < cutoff) break;

            unchecked {
                ++recentCount;
                if (verifications[i].confirmsEscape) ++escapeConfirmations;
                if (verifications[i].confirmsPaidForward) ++payForwardConfirmations;
            }
        }

        if (recentCount == 0) return 100;

        uint256 avgRate = ((escapeConfirmations * 100 / recentCount) + (payForwardConfirmations * 100 / recentCount)) / 2;

        if (avgRate >= 80) return 130;  // Strong verification
        if (avgRate >= 50) return 100;  // Moderate
        return 70 + (avgRate / 4);      // Weak
    }

    /**
     * @notice Time multiplier
     * @return multiplier 100-200 (1.0x to 2.0x over 3 years)
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 33);
        return 200;
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × EscapeSuccess × PayItForward × Verification × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 escape = escapeSuccessMultiplier(bondId);
        uint256 payForward = payItForwardMultiplier(bondId);
        uint256 verification = communityVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * escape * payForward * verification * time) / 100000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if recapture penalty should apply
     * @dev Penalty if falling back into poverty after escape
     */
    function shouldActivateRecapturePenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        Bond storage bond = bonds[bondId];

        // Only applies if escaped before
        if (!bond.escaped) return (false, "");

        uint256 incomeGain = calculateIncomeGain(bondId);

        // Falling back below escape velocity
        if (incomeGain < RECAPTURE_THRESHOLD) {
            return (true, "Recapture - falling back into poverty");
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 80% to escaper, 20% to pay-it-forward pool (or 100% escaper if recapture)
     */
    function distributeBond(uint256 bondId) external nonReentrant onlyStaker(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        (bool recapturePenalty, string memory penaltyReason) = shouldActivateRecapturePenalty(bondId);

        uint256 escaperShare;
        uint256 payForwardShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (recapturePenalty) {
                // Recapture: 100% to escaper (need support)
                escaperShare = absAppreciation;
                payForwardShare = 0;
                reason = penaltyReason;
            } else {
                // Normal: 80% escaper, 20% pay-it-forward
                escaperShare = (absAppreciation * 80) / 100;
                payForwardShare = (absAppreciation * 20) / 100;
                reason = "Escape velocity maintained - paying it forward";
            }
        } else {
            // Depreciation: 100% to escaper as support
            escaperShare = uint256(-appreciation);
            payForwardShare = 0;
            reason = "Support during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            escaperShare: escaperShare,
            payItForwardShare: payForwardShare,
            reason: reason
        }));

        if (escaperShare > 0) {
            payable(bond.staker).transfer(escaperShare);
        }

        if (payForwardShare > 0) {
            payItForwardPool += payForwardShare;
            emit PayItForwardContribution(payForwardShare);
        }

        emit BondDistributed(bondId, escaperShare, payForwardShare);
    }

    // ============ Pay-It-Forward Pool Functions ============

    /**
     * @notice Donate to pay-it-forward pool
     * @dev Anyone can contribute to help next escapers
     */
    function donateToPayItForward() external payable {
        require(msg.value > 0, "Must donate amount");
        payItForwardPool += msg.value;
        emit PayItForwardContribution(msg.value);
    }

    /**
     * @notice Get pay-it-forward pool balance
     */
    function getPayItForwardPool() external view returns (uint256) {
        return payItForwardPool;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getVerificationsCount(uint256 bondId) external view returns (uint256) {
        return bondVerifications[bondId].length;
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (EscapeMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }

    function hasEscaped(uint256 bondId) external view bondExists(bondId) returns (bool) {
        return bonds[bondId].escaped;
    }
}
