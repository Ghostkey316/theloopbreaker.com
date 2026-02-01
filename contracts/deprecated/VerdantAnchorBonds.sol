// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../MissionEnforcement.sol";

/**
 * @title Verdant Anchor Bonds
 * @notice Earth regeneration > extraction economically
 *
 * Philosophy: Physical regeneration work required, not just carbon credits.
 * Makes ecological healing profitable.
 *
 * Key Innovation: Anti-greenwashing verification from local communities.
 * No surveillance creep - community attests to real work on the ground.
 */
contract VerdantAnchorBonds is ReentrancyGuard {

    // ============ Owner / Governance ============

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ============ Mission Enforcement (optional, off by default) ============

    MissionEnforcement public missionEnforcement;
    bool public missionEnforcementEnabled;

    event MissionEnforcementUpdated(address indexed previous, address indexed current);
    event MissionEnforcementEnabled(bool enabled);

    constructor() {
        owner = msg.sender;
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

        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.OPEN_SOURCE_VERIFIABLE),
            "Mission: open source"
        );
        require(
            missionEnforcement.isCompliantWithPrinciple(address(this), MissionEnforcement.CorePrinciple.PRIVACY_DEFAULT),
            "Mission: privacy default"
        );
    }

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address regenerator;
        address landowner;         // If different from regenerator
        string regeneratorName;
        string location;           // Where is regeneration happening?
        string projectType;        // Reforestation, soil restoration, etc.
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    struct RegenerationMetrics {
        uint256 timestamp;
        address submitter;
        uint256 soilHealthScore;        // 0-10000 (soil quality improving?)
        uint256 biodiversityScore;      // 0-10000 (species diversity increasing?)
        uint256 carbonSequestration;    // 0-10000 (carbon captured in soil/biomass?)
        uint256 waterQualityScore;      // 0-10000 (water cleaner?)
        uint256 ecosystemResilienceScore; // 0-10000 (can withstand droughts/storms?)
        bool physicalWorkVerified;      // Actual hands-on work?
        string regenerationNotes;
    }

    struct LocalVerification {
        address verifier;
        uint256 timestamp;
        string verifierLocation;        // Where is verifier located?
        bool confirmsPhysicalWork;      // Saw actual work being done?
        bool confirmsEcologicalImprovement; // Land actually improving?
        bool confirmsNoGreenwashing;    // Not just carbon credit theater?
        bool isLocalResident;           // Lives near the regeneration site?
        string relationship;            // "neighbor", "local farmer", etc.
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 regeneratorShare;
        uint256 landownerShare;
        uint256 earthFundShare;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => RegenerationMetrics[]) public bondMetrics;
    mapping(uint256 => LocalVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;

    uint256 public earthFund;  // Pool for funding more regeneration

    // Thresholds
    uint256 public constant REGENERATION_THRESHOLD = 4000;   // Score < 40 = extraction
    uint256 public constant GREENWASHING_THRESHOLD = 50;     // Need 50%+ local verification

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed regenerator, string location);
    event RegenerationMetricsSubmitted(uint256 indexed bondId, address submitter);
    event LocalVerificationAdded(uint256 indexed bondId, address indexed verifier);
    event BondDistributed(uint256 indexed bondId, uint256 regeneratorShare, uint256 landownerShare);
    event GreenwashingPenalty(uint256 indexed bondId, string reason);
    event PhysicalWorkConfirmed(uint256 indexed bondId, address verifier);

    // ============ Modifiers ============

    modifier onlyRegenerator(uint256 bondId) {
        require(bonds[bondId].regenerator == msg.sender, "Only bond regenerator");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create Verdant Anchor Bond
     * @param landowner Address of landowner (can be same as regenerator)
     * @param regeneratorName Name of regenerator
     * @param location Where is regeneration happening?
     * @param projectType What kind of regeneration work?
     */
    function createBond(
        address landowner,
        string memory regeneratorName,
        string memory location,
        string memory projectType
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(landowner != address(0), "Invalid landowner address");
        require(bytes(regeneratorName).length > 0, "Must specify regenerator name");
        require(bytes(location).length > 0, "Must specify location");
        require(bytes(projectType).length > 0, "Must specify project type");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            regenerator: msg.sender,
            landowner: landowner,
            regeneratorName: regeneratorName,
            location: location,
            projectType: projectType,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, location);
        return bondId;
    }

    /**
     * @notice Submit regeneration metrics
     * @dev Physical work verification required
     */
    function submitRegenerationMetrics(
        uint256 bondId,
        uint256 soilHealthScore,
        uint256 biodiversityScore,
        uint256 carbonSequestration,
        uint256 waterQualityScore,
        uint256 ecosystemResilienceScore,
        bool physicalWorkVerified,
        string memory regenerationNotes
    ) external bondExists(bondId) {
        bondMetrics[bondId].push(RegenerationMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            soilHealthScore: soilHealthScore,
            biodiversityScore: biodiversityScore,
            carbonSequestration: carbonSequestration,
            waterQualityScore: waterQualityScore,
            ecosystemResilienceScore: ecosystemResilienceScore,
            physicalWorkVerified: physicalWorkVerified,
            regenerationNotes: regenerationNotes
        }));

        emit RegenerationMetricsSubmitted(bondId, msg.sender);
    }

    /**
     * @notice Local community verification
     * @dev Anti-greenwashing - locals verify real work happening
     */
    function addLocalVerification(
        uint256 bondId,
        string memory verifierLocation,
        bool confirmsPhysicalWork,
        bool confirmsEcologicalImprovement,
        bool confirmsNoGreenwashing,
        bool isLocalResident,
        string memory relationship,
        string memory notes
    ) external bondExists(bondId) {
        bondVerifications[bondId].push(LocalVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            verifierLocation: verifierLocation,
            confirmsPhysicalWork: confirmsPhysicalWork,
            confirmsEcologicalImprovement: confirmsEcologicalImprovement,
            confirmsNoGreenwashing: confirmsNoGreenwashing,
            isLocalResident: isLocalResident,
            relationship: relationship,
            notes: notes
        }));

        if (confirmsPhysicalWork) {
            emit PhysicalWorkConfirmed(bondId, msg.sender);
        }

        emit LocalVerificationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate regeneration score
     * @dev Average of soil, biodiversity, carbon, water, resilience
     */
    function regenerationScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        RegenerationMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Neutral

        uint256 cutoff = block.timestamp - 7776000; // ~90 days
        uint256 count = 0;
        uint256 totalScore = 0;

        for (uint256 i = metrics.length; i > 0 && metrics[i-1].timestamp >= cutoff; i--) {
            RegenerationMetrics storage m = metrics[i-1];

            // No physical work = no credit
            if (!m.physicalWorkVerified) continue;

            uint256 score = (
                m.soilHealthScore +
                m.biodiversityScore +
                m.carbonSequestration +
                m.waterQualityScore +
                m.ecosystemResilienceScore
            ) / 5;

            totalScore += score;
            count++;
        }

        return count > 0 ? totalScore / count : 0;
    }

    /**
     * @notice Physical work verification multiplier
     * @dev Based on verified physical work (not just carbon credits)
     * @return multiplier 0-150 (0x to 1.5x)
     */
    function physicalWorkMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        RegenerationMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 100;

        uint256 totalEntries = 0;
        uint256 verifiedEntries = 0;

        for (uint256 i = 0; i < metrics.length; i++) {
            totalEntries++;
            if (metrics[i].physicalWorkVerified) verifiedEntries++;
        }

        uint256 verifiedPercent = (verifiedEntries * 100) / totalEntries;

        // 100% verified = 1.5x, 0% verified = 0x
        return (verifiedPercent * 150) / 100;
    }

    /**
     * @notice Local verification multiplier (anti-greenwashing)
     * @dev Based on verification from local community
     * @return multiplier 50-150 (0.5x to 1.5x)
     */
    function localVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        LocalVerification[] storage verifications = bondVerifications[bondId];

        if (verifications.length == 0) return 50; // No verification = penalty

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 localCount = 0;
        uint256 workConfirmations = 0;
        uint256 improvementConfirmations = 0;
        uint256 noGreenwashingConfirmations = 0;

        for (uint256 i = verifications.length; i > 0 && verifications[i-1].timestamp >= cutoff; i--) {
            LocalVerification storage v = verifications[i-1];
            recentCount++;
            if (v.isLocalResident) localCount++;
            if (v.confirmsPhysicalWork) workConfirmations++;
            if (v.confirmsEcologicalImprovement) improvementConfirmations++;
            if (v.confirmsNoGreenwashing) noGreenwashingConfirmations++;
        }

        if (recentCount == 0) return 70; // Old verifications

        uint256 localPercent = (localCount * 100) / recentCount;
        uint256 avgConfirmation = (
            (workConfirmations * 100 / recentCount) +
            (improvementConfirmations * 100 / recentCount) +
            (noGreenwashingConfirmations * 100 / recentCount)
        ) / 3;

        // Strong local verification
        if (localPercent >= 70 && avgConfirmation >= 80) return 150;
        // Moderate verification
        if (avgConfirmation >= 50) return 100;
        // Weak verification
        return 50 + (avgConfirmation / 2);
    }

    /**
     * @notice Time multiplier for sustained regeneration
     * @return multiplier 100-300 (1.0x to 3.0x over years)
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        // Regeneration takes time - reward sustained effort
        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 5) return 100 + (yearsElapsed * 40);
        if (yearsElapsed < 10) return 200 + ((yearsElapsed - 5) * 20);
        return 300;
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × Regeneration × PhysicalWork × LocalVerification × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 regen = regenerationScore(bondId);
        uint256 physicalWork = physicalWorkMultiplier(bondId);
        uint256 localVerif = localVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * regen * physicalWork * localVerif * time) / 1000000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if greenwashing penalty should apply
     * @dev Penalty if: regeneration < 40 OR no physical work OR low local verification
     */
    function shouldActivateGreenwashingPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 regen = regenerationScore(bondId);

        // Low regeneration (extraction, not regeneration)
        if (regen < REGENERATION_THRESHOLD) {
            return (true, "Low regeneration score - extraction not regeneration");
        }

        // No physical work verification
        uint256 physicalWork = physicalWorkMultiplier(bondId);
        if (physicalWork == 0) {
            return (true, "No physical work verified - carbon credit theater");
        }

        // Insufficient local verification (greenwashing)
        LocalVerification[] storage verifications = bondVerifications[bondId];
        if (verifications.length > 0) {
            uint256 localVerif = localVerificationMultiplier(bondId);
            if (localVerif <= 50) {
                return (true, "Insufficient local verification - greenwashing suspected");
            }
        } else {
            return (true, "No local verification - cannot confirm regeneration");
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 50% regenerator, 30% landowner, 20% earth fund IF regenerating
     *      100% regenerator if greenwashing
     */
    function distributeBond(uint256 bondId) external nonReentrant bondExists(bondId) {
        _requireMissionCompliance();
        Bond storage bond = bonds[bondId];
        require(
            bond.regenerator == msg.sender || bond.landowner == msg.sender,
            "Only bond participants"
        );

        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateGreenwashingPenalty(bondId);

        uint256 regeneratorShare;
        uint256 landownerShare;
        uint256 fundShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // Greenwashing penalty: 100% to regenerator (landowner penalized)
                regeneratorShare = absAppreciation;
                landownerShare = 0;
                fundShare = 0;
                reason = penaltyReason;
                emit GreenwashingPenalty(bondId, penaltyReason);
            } else {
                // Normal: 50% regenerator, 30% landowner, 20% fund
                regeneratorShare = (absAppreciation * 50) / 100;

                // If regenerator is landowner, they get both shares
                if (bond.regenerator == bond.landowner) {
                    regeneratorShare += (absAppreciation * 30) / 100;
                    landownerShare = 0;
                } else {
                    landownerShare = (absAppreciation * 30) / 100;
                }

                fundShare = (absAppreciation * 20) / 100;
                reason = "Earth regeneration verified - ecosystem healing";
            }
        } else {
            // Depreciation: Support regenerator
            regeneratorShare = uint256(-appreciation);
            landownerShare = 0;
            fundShare = 0;
            reason = "Support during ecological setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            regeneratorShare: regeneratorShare,
            landownerShare: landownerShare,
            earthFundShare: fundShare,
            reason: reason
        }));

        if (regeneratorShare > 0) {
            payable(bond.regenerator).transfer(regeneratorShare);
        }

        if (landownerShare > 0) {
            payable(bond.landowner).transfer(landownerShare);
        }

        if (fundShare > 0) {
            earthFund += fundShare;
        }

        emit BondDistributed(bondId, regeneratorShare, landownerShare);
    }

    // ============ Earth Fund Functions ============

    /**
     * @notice Donate to earth fund
     * @dev Anyone can contribute to fund more regeneration
     */
    function donateToEarthFund() external payable {
        require(msg.value > 0, "Must donate amount");
        earthFund += msg.value;
    }

    /**
     * @notice Get earth fund balance
     */
    function getEarthFund() external view returns (uint256) {
        return earthFund;
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

    function getLatestMetrics(uint256 bondId) external view returns (RegenerationMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }

    function getTotalPhysicalWorkEntries(uint256 bondId) external view bondExists(bondId) returns (uint256) {
        RegenerationMetrics[] storage metrics = bondMetrics[bondId];
        uint256 count = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            if (metrics[i].physicalWorkVerified) count++;
        }
        return count;
    }
}
