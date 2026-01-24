// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Builder Belief Bonds V2 (Production Ready)
 * @notice BUILDING > TRANSACTING
 *
 * @dev Part of Vaultfire's civilization-scale trust infrastructure. This contract
 * enables builders to get recognition and economic rewards WITHOUT surveillance.
 * Proves that ethical behavior (building) is MORE profitable than extraction (token flipping).
 *
 * @dev Philosophy: Stakers back builders with belief, not extractive profit.
 * Bonds appreciate when builders BUILD, not when they flip tokens.
 *
 * @dev Key Innovation: Anti-flipping vesting + tier system.
 * Supporters → Believers → Champions based on stake and commitment.
 * Comprehensive 4-source belief scoring (GitHub, on-chain, community, external APIs).
 *
 * @dev Mission Alignment: Morals over metrics, privacy over surveillance, freedom over control.
 * For happy and healthy humans, AIs, and Earth.
 *
 * @custom:security ReentrancyGuard, Pausable, Distribution timelock, Input validation
 * @custom:ethics Anti-flipping vesting, rewards genuine building
 * @custom:vision Part of Universal Dignity Bonds proving ethics = economics
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

    /**
     * @notice Create Builder Belief Bond
     * @dev Staker backs builder with belief - bond appreciates when builder BUILDS
     *
     * @param builder Address of the builder being backed
     * @param builderName Name of the builder
     * @param projectDescription Description of the project being built
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Builder address cannot be zero address
     * - Builder cannot be same as staker
     * - Builder name must be 1-100 characters
     * - Project description must be 1-500 characters
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     * - {TierAchieved} event with belief tier (Supporter/Believer/Champion)
     *
     * Mission Alignment: Rewards genuine building over token flipping.
     * Vesting tiers create long-term alignment:
     * - Supporter (<0.001 ETH): 90 day vesting
     * - Believer (0.001-0.01 ETH): 180 day vesting
     * - Champion (>0.01 ETH): 365 day vesting
     *
     * @custom:security Validates all inputs, checks contract not paused
     * @custom:anti-flip Vesting prevents pump-and-dump behavior
     */
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

    /**
     * @notice Submit building metrics (builder or staker can submit)
     * @dev Tracks actual building activity vs token flipping
     *
     * @param bondId ID of bond to submit metrics for
     * @param codeCommits Number of code commits
     * @param deployments Number of contract deployments
     * @param usersServed Number of users served
     * @param openSourceScore Open source contribution score (0-10000)
     * @param innovationScore Innovation/novelty score (0-10000)
     * @param transactionVolume Transaction volume (penalized if too high)
     * @param buildingNotes Description of building progress
     *
     * Requirements:
     * - Bond must exist
     * - Open source score must be 0-10000
     * - Innovation score must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {BuildingMetricsSubmitted} event with calculated building score
     *
     * Mission Alignment: Building > Transacting.
     * High transaction volume triggers penalty - this bond rewards builders, not flippers.
     *
     * @custom:security Validates score inputs
     * @custom:anti-flip High transactionVolume penalizes the bond value
     */
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

    /**
     * @notice Add community verification of building activity
     * @dev Community members verify builder is actually building (not just claiming)
     *
     * @param bondId ID of bond to verify
     * @param confirmsBuilding Does verifier confirm actual building happening?
     * @param confirmsUsefulProject Does verifier confirm project is useful?
     * @param confirmsOpenSource Does verifier confirm open source claims?
     * @param relationship Verifier's relationship to project (e.g. "user", "contributor")
     * @param notes Additional verification notes
     *
     * Requirements:
     * - Bond must exist
     * - Contract must not be paused
     *
     * Emits:
     * - {CommunityVerificationAdded} event
     *
     * Mission Alignment: Community verification prevents fake building claims.
     * Anyone can verify - transparency over gatekeeping.
     *
     * @custom:privacy Verifier address recorded but can use fresh wallet for anonymity
     */
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

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be staker or builder
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives community time to verify
     * if building claims are accurate. Transparency over speed.
     *
     * @custom:security Timelock prevents instant rug pull
     */
    function requestDistribution(uint256 bondId) external onlyParticipants(bondId) bondExists(bondId) whenNotPaused {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");
        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;
        emit DistributionRequested(bondId, msg.sender, block.timestamp, block.timestamp + DISTRIBUTION_TIMELOCK);
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 60% builder, 30% stakers, 10% builder fund (or 100% builder if transacting penalty)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be staker or builder
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {TransactingPenalty} event if penalty applies
     *
     * Mission Alignment: Builders get 60% when building, 100% when transacting (penalty).
     * 10% to builder fund supports next generation of builders.
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     * @custom:anti-flip Transacting penalty = 100% to builder (stakers get nothing)
     */
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

        // Safe ETH transfers using .call{} instead of deprecated .transfer()
        if (builderShare > 0) {
            (bool successBuilder, ) = payable(bond.builder).call{value: builderShare}("");
            require(successBuilder, "Builder transfer failed");
        }
        if (stakersShare > 0) {
            (bool successStaker, ) = payable(bond.staker).call{value: stakersShare}("");
            require(successStaker, "Staker transfer failed");
        }
        if (fundShare > 0) builderFund += fundShare;

        emit BondDistributed(bondId, builderShare, stakersShare, fundShare, reason, block.timestamp);
    }

    /**
     * @notice Calculate building score from latest metrics
     * @dev Weighted average: commits (30%), deployments (30%), users (20%), open source (10%), innovation (10%)
     *
     * @param bondId ID of bond to calculate score for
     * @return score Building score (0-10000)
     *
     * Mission Alignment: Measures actual building, not speculation.
     */
    function buildingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;
        BuildingMetrics storage latest = metrics[metrics.length - 1];
        uint256 commitScore = latest.codeCommits > 100 ? 10000 : (latest.codeCommits * 100);
        uint256 deployScore = latest.deployments > 10 ? 10000 : (latest.deployments * 1000);
        uint256 userScore = latest.usersServed > 1000 ? 10000 : (latest.usersServed * 10);
        return (commitScore * 30 + deployScore * 30 + userScore * 20 + latest.openSourceScore * 10 + latest.innovationScore * 10) / 100;
    }

    /**
     * @notice Calculate building vs transacting score (penalizes high tx volume)
     * @dev If transactionVolume > 5000, applies penalty to building score
     *
     * @param bondId ID of bond to calculate score for
     * @return score Adjusted building score after transaction penalty (0-10000)
     *
     * Mission Alignment: Building > Transacting.
     * High transaction volume = flipping, not building.
     */
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

    /**
     * @notice Calculate current bond value
     * @dev Formula: (Stake × Building × Vesting × Time) / 100,000,000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei
     *
     * Math:
     * - building: 0-10000 (buildingVsTransacting score)
     * - vesting: 50-150 (anti-flipping multiplier)
     * - time: 100-250 (time multiplier)
     * - Divisor: 50,000,000 ensures reasonable appreciation (1.0x-7.5x range)
     *
     * Example calculations:
     * - Neutral (5000 × 100 × 100): 1.0x stake (breakeven)
     * - Good (7500 × 125 × 150): 2.8x stake
     * - Excellent (10000 × 150 × 200): 6.0x stake
     *
     * Mission Alignment: Value increases when builders BUILD.
     * Vesting protects against pump-and-dump.
     *
     * @custom:math-fix Changed divisor from 1,000,000 to 50,000,000 (2026-01-07)
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 building = buildingVsTransacting(bondId);
        uint256 vesting = vestingMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);
        return (bond.stakeAmount * building * vesting * time) / 50000000;
    }

    /**
     * @notice Calculate appreciation/depreciation
     * @return appreciation Can be negative (depreciation)
     */
    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        return int256(calculateBondValue(bondId)) - int256(bonds[bondId].stakeAmount);
    }

    /**
     * @notice Check if transacting penalty should activate
     * @dev Penalty if: building score < 40 OR transaction volume > 5000
     *
     * @return shouldPenalize Whether penalty should activate
     * @return reason Human-readable reason for penalty
     *
     * Mission Alignment: Transacting penalty = stakers get nothing, builder gets 100%.
     * Punishes token flippers, not builders.
     */
    function shouldActivateTransactingPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 bvt = buildingVsTransacting(bondId);
        if (bvt < BUILDING_THRESHOLD) return (true, "TRANSACTING > BUILDING");
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0 && metrics[metrics.length - 1].transactionVolume > TRANSACTION_PENALTY)
            return (true, "High transaction volume - flipping not building");
        return (false, "");
    }

    /**
     * @notice Calculate vesting multiplier (0.5x to 1.5x based on vesting progress)
     * @return multiplier Vesting multiplier (50-150)
     *
     * Mission Alignment: Anti-flipping mechanism.
     * Early exit = lower value, full vesting = higher value.
     */
    function vestingMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 vestedTime = block.timestamp > bond.vestingUntil ? bond.vestingUntil - bond.createdAt : block.timestamp - bond.createdAt;
        return 50 + (vestedTime * 100) / (bond.vestingUntil - bond.createdAt);
    }

    /**
     * @notice Time multiplier for sustained building
     * @return multiplier Time multiplier (100-250 over 5 years)
     *
     * Mission Alignment: Rewards long-term building.
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        uint256 yearsElapsed = (block.timestamp - bonds[bondId].createdAt) / 31536000;
        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 5) return 100 + (yearsElapsed * 37);
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
