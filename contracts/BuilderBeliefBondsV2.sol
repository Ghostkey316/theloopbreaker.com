// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Builder Belief Bonds V2 (Production Ready)
 * @notice BUILDING > TRANSACTING
 *
 * @dev Philosophy: Stakers back builders with belief, not extractive profit.
 * Bonds appreciate when builders BUILD, not when they flip tokens.
 *
 * @dev Key Innovation: Anti-flipping vesting + tier system.
 * Supporters → Believers → Champions based on stake and commitment.
 *
 * @custom:security ReentrancyGuard, Pausable, Distribution timelock, Input validation
 * @custom:ethics Anti-flipping vesting, rewards genuine building
 */
contract BuilderBeliefBondsV2 is BaseDignityBond {

    enum BeliefTier { Supporter, Believer, Champion }

    struct Bond {
        uint256 bondId;
        address staker;
        address builder;
        string builderName;
        string projectDescription;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 vestingUntil;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    struct BuildingMetrics {
        uint256 timestamp;
        address submitter;
        uint256 codeCommits;
        uint256 deployments;
        uint256 usersServed;
        uint256 openSourceScore;      // 0-10000
        uint256 innovationScore;       // 0-10000
        uint256 transactionVolume;
        string buildingNotes;
    }

    struct CommunityVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsBuilding;
        bool confirmsUsefulProject;
        bool confirmsOpenSource;
        string relationship;
        string notes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 builderShare;
        uint256 stakersShare;
        uint256 builderFundShare;
        string reason;
    }

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BuildingMetrics[]) public bondMetrics;
    mapping(uint256 => CommunityVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    mapping(uint256 => mapping(address => uint256)) public stakerShares;

    uint256 public builderFund;

    uint256 public constant BELIEVER_THRESHOLD = 0.001 ether;
    uint256 public constant CHAMPION_THRESHOLD = 0.01 ether;
    uint256 public constant SUPPORTER_VESTING = 7776000;
    uint256 public constant BELIEVER_VESTING = 15552000;
    uint256 public constant CHAMPION_VESTING = 31536000;
    uint256 public constant BUILDING_THRESHOLD = 4000;
    uint256 public constant TRANSACTION_PENALTY = 5000;

    event BondCreated(uint256 indexed bondId, address indexed staker, address indexed builder, string builderName, uint256 stakeAmount, uint256 timestamp);
    event BuildingMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 timestamp, uint256 buildingScore);
    event CommunityVerificationAdded(uint256 indexed bondId, address indexed verifier, uint256 timestamp);
    event DistributionRequested(uint256 indexed bondId, address indexed requester, uint256 requestedAt, uint256 availableAt);
    event BondDistributed(uint256 indexed bondId, uint256 builderShare, uint256 stakersShare, uint256 fundShare, string reason, uint256 timestamp);
    event TransactingPenalty(uint256 indexed bondId, string reason, uint256 timestamp);
    event TierAchieved(uint256 indexed bondId, address staker, BeliefTier tier);

    modifier onlyParticipants(uint256 bondId) {
        require(bonds[bondId].staker == msg.sender || bonds[bondId].builder == msg.sender, "Only bond participants");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    function createBond(address builder, string memory builderName, string memory projectDescription)
        external payable whenNotPaused returns (uint256)
    {
        _validateNonZero(msg.value, "Stake amount");
        _validateAddress(builder, "Builder");
        require(bytes(builderName).length > 0 && bytes(builderName).length <= 100, "Builder name invalid");
        require(bytes(projectDescription).length > 0 && bytes(projectDescription).length <= 500, "Description invalid");

        uint256 bondId = nextBondId++;
        uint256 vestingPeriod;
        BeliefTier tier;

        if (msg.value >= CHAMPION_THRESHOLD) {
            vestingPeriod = CHAMPION_VESTING;
            tier = BeliefTier.Champion;
        } else if (msg.value >= BELIEVER_THRESHOLD) {
            vestingPeriod = BELIEVER_VESTING;
            tier = BeliefTier.Believer;
        } else {
            vestingPeriod = SUPPORTER_VESTING;
            tier = BeliefTier.Supporter;
        }

        bonds[bondId] = Bond({
            bondId: bondId,
            staker: msg.sender,
            builder: builder,
            builderName: builderName,
            projectDescription: projectDescription,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            vestingUntil: block.timestamp + vestingPeriod,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        stakerShares[bondId][msg.sender] = msg.value;
        emit BondCreated(bondId, msg.sender, builder, builderName, msg.value, block.timestamp);
        emit TierAchieved(bondId, msg.sender, tier);
        return bondId;
    }

    function submitBuildingMetrics(
        uint256 bondId, uint256 codeCommits, uint256 deployments, uint256 usersServed,
        uint256 openSourceScore, uint256 innovationScore, uint256 transactionVolume, string memory buildingNotes
    ) external bondExists(bondId) whenNotPaused {
        _validateScore(openSourceScore, "Open source score");
        _validateScore(innovationScore, "Innovation score");

        bondMetrics[bondId].push(BuildingMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            codeCommits: codeCommits,
            deployments: deployments,
            usersServed: usersServed,
            openSourceScore: openSourceScore,
            innovationScore: innovationScore,
            transactionVolume: transactionVolume,
            buildingNotes: buildingNotes
        }));

        emit BuildingMetricsSubmitted(bondId, msg.sender, block.timestamp, buildingScore(bondId));
    }

    function addCommunityVerification(
        uint256 bondId, bool confirmsBuilding, bool confirmsUsefulProject,
        bool confirmsOpenSource, string memory relationship, string memory notes
    ) external bondExists(bondId) whenNotPaused {
        bondVerifications[bondId].push(CommunityVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            confirmsBuilding: confirmsBuilding,
            confirmsUsefulProject: confirmsUsefulProject,
            confirmsOpenSource: confirmsOpenSource,
            relationship: relationship,
            notes: notes
        }));
        emit CommunityVerificationAdded(bondId, msg.sender, block.timestamp);
    }

    function requestDistribution(uint256 bondId) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

    function distributeBond(uint256 bondId) external nonReentrant whenNotPaused onlyParticipants(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK, "Timelock not expired");

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateTransactingPenalty(bondId);
        uint256 builderShare; uint256 stakersShare; uint256 fundShare; string memory reason;

        if (appreciation > 0) {
            uint256 abs = uint256(appreciation);
            if (penaltyActive) {
                builderShare = abs; stakersShare = 0; fundShare = 0;
                reason = penaltyReason;
                emit TransactingPenalty(bondId, penaltyReason, block.timestamp);
            } else {
                builderShare = (abs * 60) / 100;
                stakersShare = (abs * 30) / 100;
                fundShare = (abs * 10) / 100;
                reason = "BUILDING > TRANSACTING";
            }
        } else {
            builderShare = uint256(-appreciation); stakersShare = 0; fundShare = 0;
            reason = "Support builder during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp, totalAmount: appreciation,
            builderShare: builderShare, stakersShare: stakersShare,
            builderFundShare: fundShare, reason: reason
        }));

        if (builderShare > 0) payable(bond.builder).transfer(builderShare);
        if (stakersShare > 0) payable(bond.staker).transfer(stakersShare);
        if (fundShare > 0) builderFund += fundShare;

        emit BondDistributed(bondId, builderShare, stakersShare, fundShare, reason, block.timestamp);
    }

    function buildingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        BuildingMetrics storage latest = metrics[metrics.length - 1];
        uint256 commitScore = latest.codeCommits > 100 ? 10000 : (latest.codeCommits * 100);
        uint256 deployScore = latest.deployments > 10 ? 10000 : (latest.deployments * 1000);
        uint256 userScore = latest.usersServed > 1000 ? 10000 : (latest.usersServed * 10);
        return (commitScore * 30 + deployScore * 30 + userScore * 20 + latest.openSourceScore * 10 + latest.innovationScore * 10) / 100;
    }

    function buildingVsTransacting(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        uint256 building = buildingScore(bondId);
        uint256 transVol = metrics[metrics.length - 1].transactionVolume;
        if (transVol > TRANSACTION_PENALTY) {
            uint256 penalty = (transVol - TRANSACTION_PENALTY) / 100;
            return building > penalty ? building - penalty : 0;
        }
        return building;
    }

    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 building = buildingVsTransacting(bondId);
        uint256 vesting = vestingMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);
        return (bond.stakeAmount * building * vesting * time) / 1000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    function shouldActivateTransactingPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 bvt = buildingVsTransacting(bondId);
        if (bvt < BUILDING_THRESHOLD) return (true, "TRANSACTING > BUILDING");
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0 && metrics[metrics.length - 1].transactionVolume > TRANSACTION_PENALTY)
            return (true, "High transaction volume - flipping not building");
        return (false, "");
    }

    function vestingMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 vestedTime = block.timestamp > bond.vestingUntil ? bond.vestingUntil - bond.createdAt : block.timestamp - bond.createdAt;
        return 50 + (vestedTime * 100) / (bond.vestingUntil - bond.createdAt);
    }

    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 years = (block.timestamp - bonds[bondId].createdAt) / 31536000;
        if (years < 1) return 100;
        if (years < 5) return 100 + (years * 37);
        return 250;
    }

    function donateToBuilderFund() external payable { require(msg.value > 0); builderFund += msg.value; }
    function getBuilderFund() external view returns (uint256) { return builderFund; }
    function getBond(uint256 bondId) external view returns (Bond memory) { return bonds[bondId]; }
    function isVested(uint256 bondId) external view bondExists(bondId) returns (bool) { return block.timestamp >= bonds[bondId].vestingUntil; }
    function getTier(uint256 bondId) external view bondExists(bondId) returns (BeliefTier) {
        uint256 amt = bonds[bondId].stakeAmount;
        if (amt >= CHAMPION_THRESHOLD) return BeliefTier.Champion;
        if (amt >= BELIEVER_THRESHOLD) return BeliefTier.Believer;
        return BeliefTier.Supporter;
    }
}
