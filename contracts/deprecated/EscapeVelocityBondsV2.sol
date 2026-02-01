// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../BaseYieldPoolBond.sol";
import "../MissionEnforcement.sol";

/**
 * @title Escape Velocity Bonds V2 (Production Ready)
 * @notice Little guy escaping poverty - $50-$500 stakes
 *
 * @custom:security ReentrancyGuard, Pausable, YieldPool
 * @custom:security-enhancement Added yield pool funding mechanism (2026 Audit), Distribution timelock, Input validation
 * @custom:ethics Pay-it-forward, recapture protection
 */
contract EscapeVelocityBondsV2 is BaseYieldPoolBond {

    // ============ Mission Enforcement (optional, off by default) ============

    MissionEnforcement public missionEnforcement;
    bool public missionEnforcementEnabled;

    event MissionEnforcementUpdated(address indexed previous, address indexed current);
    event MissionEnforcementEnabled(bool enabled);

    struct Bond {
        uint256 bondId;
        address staker;
        string stakerName;
        uint256 stakeAmount;
        uint256 initialIncome;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
        bool escaped;
    }

    struct EscapeMetrics {
        uint256 timestamp;
        uint256 currentIncome;
        uint256 autonomyGain;       // 0-10000
        uint256 stabilityScore;     // 0-10000
        uint256 peopleHelped;
        string progressNotes;
    }

    struct CommunityVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsEscape;
        bool confirmsPaidForward;
        string relationship;
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 escaperShare;
        uint256 payItForwardShare;
        string reason;
    }

    uint256 public constant MIN_STAKE = 0.00005 ether;
    uint256 public constant MAX_STAKE = 0.0005 ether;
    uint256 public constant ESCAPE_VELOCITY_THRESHOLD = 15000;
    uint256 public constant RECAPTURE_THRESHOLD = 10000;

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => EscapeMetrics[]) public bondMetrics;
    mapping(uint256 => CommunityVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    uint256 public payItForwardPool;

    event BondCreated(uint256 indexed bondId, address indexed staker, uint256 initialIncome, uint256 stakeAmount, uint256 timestamp);
    event ProgressSubmitted(uint256 indexed bondId, uint256 currentIncome, uint256 timestamp);
    event EscapeVelocityAchieved(uint256 indexed bondId, uint256 incomeGain);
    event RecaptureWarning(uint256 indexed bondId, string reason);
    event DistributionRequested(uint256 indexed bondId, address indexed staker, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 escaperShare, uint256 payItForwardShare, string reason, uint256 timestamp);

    modifier onlyStaker(uint256 bondId) { require(bonds[bondId].staker == msg.sender, "Only staker"); _; }
    modifier bondExists(uint256 bondId) { require(bonds[bondId].active, "Bond does not exist"); _; }

    constructor() {
        // Mission enforcement is optional/off by default.
        missionEnforcementEnabled = false;
    }

    function setMissionEnforcement(address mission) external onlyOwner {
        address previous = address(missionEnforcement);
        missionEnforcement = MissionEnforcement(mission);
        emit MissionEnforcementUpdated(previous, mission);
    }

    function setMissionEnforcementEnabled(bool enabled) external onlyOwner {
        missionEnforcementEnabled = enabled;
        emit MissionEnforcementEnabled(enabled);
    }

    function _requireMissionCompliance() internal view {
        if (!missionEnforcementEnabled) return;
        address m = address(missionEnforcement);
        require(m != address(0), "MissionEnforcement not set");

        // Minimal gating set (can expand over time):
        // - No KYC (wallets only)
        // - Privacy default
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.NO_KYC_WALLET_ONLY),
            "Mission: no kyc"
        );
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.PRIVACY_DEFAULT),
            "Mission: privacy default"
        );
    }

    /**
     * @notice Create Escape Velocity Bond for poverty escape
     * @dev Small stakes ($50-$500) help people escape poverty - too small for suits to exploit
     *
     * @param stakerName Name of person escaping poverty
     * @param initialIncome Initial income level (for tracking gain)
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Stake must be MIN_STAKE to MAX_STAKE (0.00005-0.0005 ETH)
     * - Initial income must be > 0
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event
     *
     * Mission Alignment: Small enough suits can't exploit, big enough to change lives.
     * Poverty escape at $50-$500 stakes. Pay-it-forward pool helps next person.
     *
     * @custom:ethics Recapture protection - warns if income falls after escape achieved
     */
    function createBond(string memory stakerName, uint256 initialIncome) external payable whenNotPaused returns (uint256) {
        require(msg.value >= MIN_STAKE && msg.value <= MAX_STAKE, "Stake must be $50-$500 equivalent");
        _validateNonZero(initialIncome, "Initial income");

        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond({
            bondId: bondId, staker: msg.sender, stakerName: stakerName,
            stakeAmount: msg.value, initialIncome: initialIncome, createdAt: block.timestamp,
            distributionRequestedAt: 0, distributionPending: false, active: true, escaped: false
        });

        emit BondCreated(bondId, msg.sender, initialIncome, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit progress toward poverty escape
     * @dev Tracks income gain, autonomy, stability, and pay-it-forward impact
     *
     * @param bondId ID of bond to submit progress for
     * @param currentIncome Current income level
     * @param autonomyGain Autonomy gain score (0-10000)
     * @param stabilityScore Financial stability score (0-10000)
     * @param peopleHelped Number of people helped (pay-it-forward metric)
     * @param progressNotes Description of progress
     *
     * Requirements:
     * - Caller must be staker
     * - Bond must exist
     * - Autonomy gain must be 0-10000
     * - Stability score must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {ProgressSubmitted} event
     * - {EscapeVelocityAchieved} event if income gain >= 150%
     * - {RecaptureWarning} event if income falling after escape
     *
     * Mission Alignment: Escape velocity = 1.5x initial income.
     * Recapture protection warns if falling back into poverty.
     *
     * @custom:security Validates score inputs
     */
    function submitProgress(
        uint256 bondId, uint256 currentIncome, uint256 autonomyGain,
        uint256 stabilityScore, uint256 peopleHelped, string memory progressNotes
    ) external onlyStaker(bondId) bondExists(bondId) whenNotPaused {
        _validateScore(autonomyGain, "Autonomy gain");
        _validateScore(stabilityScore, "Stability score");

        bondMetrics[bondId].push(EscapeMetrics({
            timestamp: block.timestamp, currentIncome: currentIncome,
            autonomyGain: autonomyGain, stabilityScore: stabilityScore,
            peopleHelped: peopleHelped, progressNotes: progressNotes
        }));

        uint256 incomeGain = calculateIncomeGain(bondId);
        if (incomeGain >= ESCAPE_VELOCITY_THRESHOLD && !bonds[bondId].escaped) {
            bonds[bondId].escaped = true;
            emit EscapeVelocityAchieved(bondId, incomeGain);
        }

        if (bonds[bondId].escaped && incomeGain < RECAPTURE_THRESHOLD) {
            emit RecaptureWarning(bondId, "Income falling back - recapture risk");
        }

        emit ProgressSubmitted(bondId, currentIncome, block.timestamp);
    }

    function requestDistribution(uint256 bondId) external onlyStaker(bondId) bondExists(bondId) whenNotPaused {
        _requireMissionCompliance();
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 80% to escaper, 20% to pay-it-forward pool (helps next person)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be staker
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     *
     * Mission Alignment: 80% to escaper, 20% pay-it-forward.
     * Helps next generation escape poverty.
     *
     * @custom:security ReentrancyGuard, timelock protection
     */
    function distributeBond(uint256 bondId) external nonReentrant whenNotPaused onlyStaker(bondId) bondExists(bondId) {
        _requireMissionCompliance();
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK, "Timelock not expired");

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation");

        uint256 escaperShare; uint256 payItForwardShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);

            
            // CRITICAL FIX: Check yield pool can cover appreciation

            
            _useYieldPool(bondId, abs);
            escaperShare = (abs * 80) / 100;
            payItForwardShare = (abs * 20) / 100;
            reason = bond.escaped ? "Escape achieved - pay it forward" : "Progress toward escape";
        } else {
            escaperShare = uint256(-appreciation); payItForwardShare = 0;
            reason = "Support during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp, totalAmount: appreciation,
            escaperShare: escaperShare, payItForwardShare: payItForwardShare, reason: reason
        }));

        // Safe ETH transfer using .call{} instead of deprecated .transfer()
        // CRITICAL FIX: Explicit balance checks before transfers

        uint256 totalPayout = escaperShare + payItForwardShare;

        require(address(this).balance >= totalPayout, "Insufficient contract balance for distribution");


        if (escaperShare > 0) {
            require(address(this).balance >= escaperShare, "Insufficient balance for escaper share");
            (bool success, ) = payable(bond.staker).call{value: escaperShare}("");
            require(success, "Escaper transfer failed");
        }
        if (payItForwardShare > 0) payItForwardPool += payItForwardShare;

        emit BondDistributed(bondId, escaperShare, payItForwardShare, reason, block.timestamp);
    }

    function calculateIncomeGain(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        EscapeMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 0;
        Bond storage bond = bonds[bondId];
        uint256 current = metrics[metrics.length - 1].currentIncome;
        if (current <= bond.initialIncome) return 0;
        return ((current - bond.initialIncome) * 10000) / bond.initialIncome;
    }

    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 incomeGain = calculateIncomeGain(bondId);
        return bonds[bondId].stakeAmount + (bonds[bondId].stakeAmount * incomeGain) / 10000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    function getBond(uint256 bondId) external view returns (Bond memory) { return bonds[bondId]; }
}
