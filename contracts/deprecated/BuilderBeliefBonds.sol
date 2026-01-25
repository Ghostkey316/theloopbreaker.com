// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Builder Belief Bonds
 * @notice BUILDING > TRANSACTING
 *
 * Philosophy: Stakers back builders with belief, not extractive profit.
 * Bonds appreciate when builders BUILD, not when they flip tokens.
 *
 * Key Innovation: Anti-flipping vesting + tier system.
 * Supporters → Believers → Champions based on stake and commitment.
 */
contract BuilderBeliefBonds is ReentrancyGuard {

    // ============ Enums ============

    enum BeliefTier {
        Supporter,   // Small stakes, getting started
        Believer,    // Meaningful stakes, committed
        Champion     // Large stakes, long-term believers
    }

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address staker;
        address builder;
        string builderName;
        string projectDescription;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 vestingUntil;      // Anti-flipping vesting
        bool active;
    }

    struct BuildingMetrics {
        uint256 timestamp;
        address submitter;
        uint256 codeCommits;         // GitHub/on-chain code activity
        uint256 deployments;         // Contracts deployed
        uint256 usersServed;         // Real users using the project
        uint256 openSourceScore;     // 0-10000 (code public?)
        uint256 innovationScore;     // 0-10000 (revolutionary?)
        uint256 transactionVolume;   // Token transactions (should be LOW)
        string buildingNotes;
    }

    struct CommunityVerification {
        address verifier;
        uint256 timestamp;
        bool confirmsBuilding;       // Actually building or just talking?
        bool confirmsUsefulProject;  // Solving real problems?
        bool confirmsOpenSource;     // Code accessible?
        string relationship;         // "user", "contributor", "knows builder"
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

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => BuildingMetrics[]) public bondMetrics;
    mapping(uint256 => CommunityVerification[]) public bondVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;
    mapping(uint256 => mapping(address => uint256)) public stakerShares; // Track staker portions

    uint256 public builderFund;  // Pool for funding more builders

    // Tier thresholds
    uint256 public constant BELIEVER_THRESHOLD = 0.001 ether;  // ~$10-100
    uint256 public constant CHAMPION_THRESHOLD = 0.01 ether;   // ~$100-1000

    // Vesting periods (anti-flipping)
    uint256 public constant SUPPORTER_VESTING = 7776000;   // ~90 days
    uint256 public constant BELIEVER_VESTING = 15552000;   // ~180 days
    uint256 public constant CHAMPION_VESTING = 31536000;   // ~365 days

    // Building thresholds
    uint256 public constant BUILDING_THRESHOLD = 4000;     // Building score < 40 = transacting
    uint256 public constant TRANSACTION_PENALTY = 5000;    // Transactions > 50 = flipping

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed staker, address indexed builder);
    event BuildingMetricsSubmitted(uint256 indexed bondId, address submitter);
    event CommunityVerificationAdded(uint256 indexed bondId, address indexed verifier);
    event BondDistributed(uint256 indexed bondId, uint256 builderShare, uint256 stakersShare);
    event TransactingPenalty(uint256 indexed bondId, string reason);
    event TierAchieved(uint256 indexed bondId, address staker, BeliefTier tier);

    // ============ Modifiers ============

    modifier onlyStaker(uint256 bondId) {
        require(bonds[bondId].staker == msg.sender, "Only bond staker");
        _;
    }

    modifier onlyBuilder(uint256 bondId) {
        require(bonds[bondId].builder == msg.sender, "Only builder");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create Builder Belief Bond
     * @dev Vesting period based on stake amount (anti-flipping)
     * @param builder Address of builder
     * @param builderName Name of builder
     * @param projectDescription What are they building?
     */
    function createBond(
        address builder,
        string memory builderName,
        string memory projectDescription
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(builder != address(0), "Invalid builder address");
        require(bytes(builderName).length > 0, "Must specify builder name");
        require(bytes(projectDescription).length > 0, "Must describe project");

        uint256 bondId = nextBondId++;

        // Determine vesting based on stake (tier)
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
            active: true
        });

        stakerShares[bondId][msg.sender] = msg.value;

        emit BondCreated(bondId, msg.sender, builder);
        emit TierAchieved(bondId, msg.sender, tier);
        return bondId;
    }

    /**
     * @notice Submit building metrics
     * @dev Builder or community can submit
     */
    function submitBuildingMetrics(
        uint256 bondId,
        uint256 codeCommits,
        uint256 deployments,
        uint256 usersServed,
        uint256 openSourceScore,
        uint256 innovationScore,
        uint256 transactionVolume,
        string memory buildingNotes
    ) external bondExists(bondId) {
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

        emit BuildingMetricsSubmitted(bondId, msg.sender);
    }

    /**
     * @notice Community verification from users/contributors
     * @dev Verifies builder is actually building, not just talking
     */
    function addCommunityVerification(
        uint256 bondId,
        bool confirmsBuilding,
        bool confirmsUsefulProject,
        bool confirmsOpenSource,
        string memory relationship,
        string memory notes
    ) external bondExists(bondId) {
        bondVerifications[bondId].push(CommunityVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            confirmsBuilding: confirmsBuilding,
            confirmsUsefulProject: confirmsUsefulProject,
            confirmsOpenSource: confirmsOpenSource,
            relationship: relationship,
            notes: notes
        }));

        emit CommunityVerificationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate building score
     * @dev Weighted: commits (30%), deployments (30%), users (20%), open source (10%), innovation (10%)
     */
    function buildingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Neutral

        BuildingMetrics storage latest = metrics[metrics.length - 1];

        // Normalize metrics to 0-10000 scale
        uint256 commitScore = latest.codeCommits > 100 ? 10000 : (latest.codeCommits * 100);
        uint256 deployScore = latest.deployments > 10 ? 10000 : (latest.deployments * 1000);
        uint256 userScore = latest.usersServed > 1000 ? 10000 : (latest.usersServed * 10);

        return (
            commitScore * 30 +
            deployScore * 30 +
            userScore * 20 +
            latest.openSourceScore * 10 +
            latest.innovationScore * 10
        ) / 100;
    }

    /**
     * @notice Calculate building vs transacting ratio
     * @dev Returns 0-10000 (100 = building, 0 = transacting)
     */
    function buildingVsTransacting(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000;

        BuildingMetrics storage latest = metrics[metrics.length - 1];
        uint256 building = buildingScore(bondId);

        // Penalize high transaction volume
        if (latest.transactionVolume > TRANSACTION_PENALTY) {
            uint256 penalty = (latest.transactionVolume - TRANSACTION_PENALTY) / 100;
            return building > penalty ? building - penalty : 0;
        }

        return building;
    }

    /**
     * @notice Community verification multiplier
     * @dev Based on verifications from users/contributors
     * @return multiplier 70-130 (0.7x to 1.3x)
     */
    function communityVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        CommunityVerification[] storage verifications = bondVerifications[bondId];

        if (verifications.length == 0) return 100; // Neutral

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;
        uint256 buildingConfirmations = 0;
        uint256 usefulConfirmations = 0;
        uint256 openSourceConfirmations = 0;

        for (uint256 i = verifications.length; i > 0 && verifications[i-1].timestamp >= cutoff; i--) {
            recentCount++;
            if (verifications[i-1].confirmsBuilding) buildingConfirmations++;
            if (verifications[i-1].confirmsUsefulProject) usefulConfirmations++;
            if (verifications[i-1].confirmsOpenSource) openSourceConfirmations++;
        }

        if (recentCount == 0) return 100;

        uint256 avgRate = (
            (buildingConfirmations * 100 / recentCount) +
            (usefulConfirmations * 100 / recentCount) +
            (openSourceConfirmations * 100 / recentCount)
        ) / 3;

        if (avgRate >= 80) return 130;  // Strong verification
        if (avgRate >= 50) return 100;  // Moderate
        return 70 + (avgRate / 4);      // Weak
    }

    /**
     * @notice Vesting multiplier (anti-flipping)
     * @dev Rewards long-term belief, penalizes early exit
     * @return multiplier 50-150 (0.5x to 1.5x)
     */
    function vestingMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 vestedTime = block.timestamp > bond.vestingUntil ?
            bond.vestingUntil - bond.createdAt :
            block.timestamp - bond.createdAt;
        uint256 totalVesting = bond.vestingUntil - bond.createdAt;

        uint256 vestedPercent = (vestedTime * 100) / totalVesting;

        // Fully vested = 1.5x, not vested = 0.5x
        return 50 + vestedPercent;
    }

    /**
     * @notice Time multiplier for sustained building
     * @return multiplier 100-250 (1.0x to 2.5x over years)
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 5) return 100 + (yearsElapsed * 37);
        return 250;
    }

    /**
     * @notice Calculate bond value
     * @dev Formula: Stake × Building × Verification × Vesting × Time
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 building = buildingVsTransacting(bondId);
        uint256 verification = communityVerificationMultiplier(bondId);
        uint256 vesting = vestingMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        return (bond.stakeAmount * building * verification * vesting * time) / 100000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if transacting penalty should apply
     * @dev Penalty if: building score < 40 OR transactions > 50
     */
    function shouldActivateTransactingPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
        uint256 buildingVsTrans = buildingVsTransacting(bondId);

        // More transacting than building
        if (buildingVsTrans < BUILDING_THRESHOLD) {
            return (true, "TRANSACTING > BUILDING - token flipping detected");
        }

        BuildingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length > 0) {
            uint256 transVol = metrics[metrics.length - 1].transactionVolume;
            if (transVol > TRANSACTION_PENALTY) {
                return (true, "High transaction volume - flipping not building");
            }
        }

        return (false, "");
    }

    /**
     * @notice Distribute bond proceeds
     * @dev 60% builder, 30% stakers, 10% builder fund IF building
     *      100% builder if transacting
     */
    function distributeBond(uint256 bondId) external nonReentrant bondExists(bondId) {
        Bond storage bond = bonds[bondId];
        require(
            bond.staker == msg.sender || bond.builder == msg.sender,
            "Only bond participants"
        );

        int256 appreciation = calculateAppreciation(bondId);
        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateTransactingPenalty(bondId);

        uint256 builderShare;
        uint256 stakersShare;
        uint256 fundShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // Transacting penalty: 100% to builder (stakers penalized)
                builderShare = absAppreciation;
                stakersShare = 0;
                fundShare = 0;
                reason = penaltyReason;
                emit TransactingPenalty(bondId, penaltyReason);
            } else {
                // Normal: 60% builder, 30% stakers, 10% fund
                builderShare = (absAppreciation * 60) / 100;
                stakersShare = (absAppreciation * 30) / 100;
                fundShare = (absAppreciation * 10) / 100;
                reason = "BUILDING > TRANSACTING - genuine builder";
            }
        } else {
            // Depreciation: Support builder
            builderShare = uint256(-appreciation);
            stakersShare = 0;
            fundShare = 0;
            reason = "Support builder during setback";
        }

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            builderShare: builderShare,
            stakersShare: stakersShare,
            builderFundShare: fundShare,
            reason: reason
        }));

        if (builderShare > 0) {
            payable(bond.builder).transfer(builderShare);
        }

        if (stakersShare > 0) {
            payable(bond.staker).transfer(stakersShare);
        }

        if (fundShare > 0) {
            builderFund += fundShare;
        }

        emit BondDistributed(bondId, builderShare, stakersShare);
    }

    // ============ Builder Fund Functions ============

    /**
     * @notice Donate to builder fund
     * @dev Anyone can contribute to fund more builders
     */
    function donateToBuilderFund() external payable {
        require(msg.value > 0, "Must donate amount");
        builderFund += msg.value;
    }

    /**
     * @notice Get builder fund balance
     */
    function getBuilderFund() external view returns (uint256) {
        return builderFund;
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

    function getLatestMetrics(uint256 bondId) external view returns (BuildingMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }

    function isVested(uint256 bondId) external view bondExists(bondId) returns (bool) {
        return block.timestamp >= bonds[bondId].vestingUntil;
    }

    function getTier(uint256 bondId) external view bondExists(bondId) returns (BeliefTier) {
        uint256 stakeAmount = bonds[bondId].stakeAmount;
        if (stakeAmount >= CHAMPION_THRESHOLD) return BeliefTier.Champion;
        if (stakeAmount >= BELIEVER_THRESHOLD) return BeliefTier.Believer;
        return BeliefTier.Supporter;
    }
}
