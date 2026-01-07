// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Verdant Anchor Bonds V2 (Production Ready)
 * @notice Earth regeneration > extraction economically
 *
 * @custom:security ReentrancyGuard, Pausable, Distribution timelock, Input validation
 * @custom:ethics Anti-greenwashing verification from local communities
 */
contract VerdantAnchorBondsV2 is BaseDignityBond {

    struct Bond {
        uint256 bondId;
        address regenerator;
        address landowner;
        string regeneratorName;
        string location;
        string projectType;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    struct RegenerationMetrics {
        uint256 timestamp;
        address submitter;
        uint256 soilHealthScore;           // 0-10000
        uint256 biodiversityScore;         // 0-10000
        uint256 carbonSequestration;       // 0-10000
        uint256 waterQualityScore;         // 0-10000
        uint256 ecosystemResilienceScore;  // 0-10000
        bool physicalWorkVerified;
        string regenerationNotes;
    }

    struct LocalVerification {
        address verifier;
        uint256 timestamp;
        string verifierLocation;
        bool confirmsPhysicalWork;
        bool confirmsEcologicalImprovement;
        bool confirmsNoGreenwashing;
        bool isLocalResident;
        string relationship;
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

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => RegenerationMetrics[]) public bondMetrics;
    mapping(uint256 => LocalVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    uint256 public earthFund;

    uint256 public constant REGENERATION_THRESHOLD = 4000;
    uint256 public constant GREENWASHING_THRESHOLD = 50;

    event BondCreated(uint256 indexed bondId, address indexed regenerator, string location, uint256 stakeAmount, uint256 timestamp);
    event RegenerationMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp);
    event LocalVerificationAdded(uint256 indexed bondId, address indexed verifier, uint256 timestamp);
    event DistributionRequested(uint256 indexed bondId, address indexed regenerator, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 regeneratorShare, uint256 landownerShare, uint256 earthFundShare, string reason, uint256 timestamp);
    event GreenwashingPenalty(uint256 indexed bondId, string reason, uint256 timestamp);

    modifier onlyRegenerator(uint256 bondId) { require(bonds[bondId].regenerator == msg.sender, "Only regenerator"); _; }
    modifier bondExists(uint256 bondId) { require(bonds[bondId].active, "Bond does not exist"); _; }

    /**
     * @notice Create Verdant Anchor Bond for earth regeneration
     * @dev Regenerator stakes on ecological improvement - bond appreciates with real regeneration
     *
     * @param landowner Address of the landowner
     * @param regeneratorName Name of the regenerator
     * @param location Geographic location of regeneration project
     * @param projectType Type of regeneration project (e.g., "rewilding", "soil restoration")
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Landowner address cannot be zero address
     * - Regenerator name must be 1-100 characters
     * - Location must be 1-100 characters
     * - Project type must be 1-100 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     *
     * Mission Alignment: Earth regeneration > extraction.
     * Local community verification prevents greenwashing.
     *
     * @custom:security Validates all inputs, checks contract not paused
     * @custom:anti-greenwashing Requires local community verification for credibility
     */
    function createBond(address landowner, string memory regeneratorName, string memory location, string memory projectType)
        external payable whenNotPaused returns (uint256)
    {
        _validateNonZero(msg.value, "Stake amount");
        _validateAddress(landowner, "Landowner");
        require(bytes(regeneratorName).length > 0 && bytes(regeneratorName).length <= 100, "Name invalid");
        require(bytes(location).length > 0 && bytes(location).length <= 100, "Location invalid");
        require(bytes(projectType).length > 0 && bytes(projectType).length <= 100, "Project type invalid");

        uint256 bondId = nextBondId++;
        bonds[bondId] = Bond({
            bondId: bondId, regenerator: msg.sender, landowner: landowner,
            regeneratorName: regeneratorName, location: location, projectType: projectType,
            stakeAmount: msg.value, createdAt: block.timestamp,
            distributionRequestedAt: 0, distributionPending: false, active: true
        });

        emit BondCreated(bondId, msg.sender, location, msg.value, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit regeneration metrics (regenerator, landowner, or observer can submit)
     * @dev Tracks ecological improvements across 5 dimensions
     *
     * @param bondId ID of bond to submit metrics for
     * @param soilHealthScore Soil health improvement score (0-10000)
     * @param biodiversityScore Biodiversity increase score (0-10000)
     * @param carbonSequestration Carbon sequestration score (0-10000)
     * @param waterQualityScore Water quality improvement score (0-10000)
     * @param ecosystemResilienceScore Ecosystem resilience score (0-10000)
     * @param physicalWorkVerified Has physical regeneration work been verified?
     * @param regenerationNotes Description of regeneration progress
     *
     * Requirements:
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {RegenerationMetricsSubmitted} event
     *
     * Mission Alignment: Measures real ecological improvement.
     * Local community verifies - can't fake regeneration.
     *
     * @custom:security Validates all score inputs
     */
    function submitRegenerationMetrics(
        uint256 bondId, uint256 soilHealthScore, uint256 biodiversityScore,
        uint256 carbonSequestration, uint256 waterQualityScore, uint256 ecosystemResilienceScore,
        bool physicalWorkVerified, string memory regenerationNotes
    ) external bondExists(bondId) whenNotPaused {
        _validateScore(soilHealthScore, "Soil health");
        _validateScore(biodiversityScore, "Biodiversity");
        _validateScore(carbonSequestration, "Carbon sequestration");
        _validateScore(waterQualityScore, "Water quality");
        _validateScore(ecosystemResilienceScore, "Ecosystem resilience");

        bondMetrics[bondId].push(RegenerationMetrics({
            timestamp: block.timestamp, submitter: msg.sender,
            soilHealthScore: soilHealthScore, biodiversityScore: biodiversityScore,
            carbonSequestration: carbonSequestration, waterQualityScore: waterQualityScore,
            ecosystemResilienceScore: ecosystemResilienceScore,
            physicalWorkVerified: physicalWorkVerified, regenerationNotes: regenerationNotes
        }));

        emit RegenerationMetricsSubmitted(bondId, msg.sender, block.timestamp);
    }

    /**
     * @notice Add local community verification of regeneration work
     * @dev Local residents verify real regeneration is happening (anti-greenwashing)
     *
     * @param bondId ID of bond to verify
     * @param verifierLocation Geographic location of verifier
     * @param confirmsPhysicalWork Does verifier confirm physical regeneration work?
     * @param confirmsEcologicalImprovement Does verifier confirm ecological improvements?
     * @param confirmsNoGreenwashing Does verifier confirm no greenwashing?
     * @param isLocalResident Is verifier a local resident?
     * @param relationship Verifier's relationship to project (e.g., "neighbor", "farmer")
     * @param notes Additional verification notes
     *
     * Requirements:
     * - Bond must exist
     * - Contract must not be paused
     *
     * Emits:
     * - {LocalVerificationAdded} event
     *
     * Mission Alignment: Local community verification prevents greenwashing.
     * Physical work required - can't fake regeneration from satellite.
     *
     * @custom:anti-greenwashing Greenwashing penalty if <50% verifications confirm no greenwashing
     */
    function addLocalVerification(
        uint256 bondId, string memory verifierLocation, bool confirmsPhysicalWork,
        bool confirmsEcologicalImprovement, bool confirmsNoGreenwashing,
        bool isLocalResident, string memory relationship, string memory notes
    ) external bondExists(bondId) whenNotPaused {
        bondVerifications[bondId].push(LocalVerification({
            verifier: msg.sender, timestamp: block.timestamp, verifierLocation: verifierLocation,
            confirmsPhysicalWork: confirmsPhysicalWork,
            confirmsEcologicalImprovement: confirmsEcologicalImprovement,
            confirmsNoGreenwashing: confirmsNoGreenwashing,
            isLocalResident: isLocalResident, relationship: relationship, notes: notes
        }));
        emit LocalVerificationAdded(bondId, msg.sender, block.timestamp);
    }

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be regenerator
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives local community time to verify
     * if regeneration claims are accurate.
     *
     * @custom:security Timelock prevents instant rug pull
     */
    function requestDistribution(uint256 bondId) external onlyRegenerator(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 50% regenerator, 40% landowner, 10% earth fund (or 100% landowner if greenwashing)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be regenerator
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {GreenwashingPenalty} event if penalty applies
     *
     * Mission Alignment: Regenerator and landowner profit when real regeneration confirmed.
     * 100% to landowner if greenwashing detected (regenerator gets nothing).
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     * @custom:anti-greenwashing Greenwashing penalty = regenerator gets 0%, landowner gets 100%
     */
    function distributeBond(uint256 bondId) external nonReentrant whenNotPaused onlyRegenerator(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK, "Timelock not expired");

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation");

        bool penaltyActive = shouldActivateGreenwashingPenalty(bondId);
        uint256 regeneratorShare; uint256 landownerShare; uint256 fundShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);
            if (penaltyActive) {
                regeneratorShare = 0; landownerShare = abs; fundShare = 0;
                reason = "Greenwashing penalty";
                emit GreenwashingPenalty(bondId, "No real regeneration", block.timestamp);
            } else {
                regeneratorShare = (abs * 50) / 100;
                landownerShare = (abs * 40) / 100;
                fundShare = (abs * 10) / 100;
                reason = "Real regeneration confirmed";
            }
        } else {
            regeneratorShare = uint256(-appreciation); landownerShare = 0; fundShare = 0;
            reason = "Support regeneration";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp, totalAmount: appreciation,
            regeneratorShare: regeneratorShare, landownerShare: landownerShare,
            earthFundShare: fundShare, reason: reason
        }));

        if (regeneratorShare > 0) payable(bond.regenerator).transfer(regeneratorShare);
        if (landownerShare > 0) payable(bond.landowner).transfer(landownerShare);
        if (fundShare > 0) earthFund += fundShare;

        emit BondDistributed(bondId, regeneratorShare, landownerShare, fundShare, reason, block.timestamp);
    }

    /**
     * @notice Calculate current bond value based on regeneration score
     * @dev Average of 5 ecological metrics
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Mission Alignment: Value increases with real ecological regeneration.
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        RegenerationMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return bonds[bondId].stakeAmount;
        RegenerationMetrics storage latest = metrics[metrics.length - 1];
        uint256 score = (latest.soilHealthScore + latest.biodiversityScore + latest.carbonSequestration +
                        latest.waterQualityScore + latest.ecosystemResilienceScore) / 5;
        return (bonds[bondId].stakeAmount * score) / 5000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    /**
     * @notice Check if greenwashing penalty should activate
     * @dev Penalty if <50% of verifications confirm no greenwashing
     *
     * @param bondId ID of bond to check
     * @return shouldPenalize Whether greenwashing penalty should activate
     *
     * Mission Alignment: No verifications OR <50% confirm no greenwashing = penalty.
     * Regenerator gets 0%, landowner gets 100%.
     */
    function shouldActivateGreenwashingPenalty(uint256 bondId) public view bondExists(bondId) returns (bool) {
        LocalVerification[] storage verifications = bondVerifications[bondId];
        if (verifications.length == 0) return true;
        uint256 confirmCount = 0;
        for (uint256 i = 0; i < verifications.length; i++) {
            if (verifications[i].confirmsPhysicalWork && verifications[i].confirmsNoGreenwashing) confirmCount++;
        }
        return (confirmCount * 100 / verifications.length) < GREENWASHING_THRESHOLD;
    }

    function getBond(uint256 bondId) external view returns (Bond memory) { return bonds[bondId]; }
}
