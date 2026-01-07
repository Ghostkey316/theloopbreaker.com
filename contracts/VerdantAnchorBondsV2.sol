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

    function requestDistribution(uint256 bondId) external onlyRegenerator(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

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
