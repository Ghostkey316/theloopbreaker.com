// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Fan Belief Bonds
 * @notice AUTHENTICITY > CORRUPTION - Rewarding long-term belief in authentic players/teams
 *
 * Philosophy: Fans stake on players/teams they believe maintain integrity.
 * Long-term belief in authentic competition rewarded. Corruption destroys bonds.
 *
 * Key Innovation: Multi-year compounding + zero tolerance for integrity violations.
 */
contract FanBeliefBond is ReentrancyGuard {

    // ============ Enums ============

    enum IntegrityStatus {
        Corrupted,    // Integrity violation detected (0% value)
        Declining,    // Performance/integrity declining (50% value)
        Stable,       // Maintaining integrity (100% value)
        Rising,       // Improving integrity (150% value)
        Elite         // Elite sustained integrity (200%+ value)
    }

    enum ViolationType {
        None,
        MatchFixing,
        PEDUsage,
        GamblingViolation,
        LoadManagementAbuse,
        TankingParticipation
    }

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address fanAddress;
        address playerOrTeamAddress;
        string playerOrTeamName;
        string bondType;            // "player" or "team"
        string league;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 maturityDate;       // Minimum holding period
        bool active;
        bool settled;
        ViolationType violation;
    }

    struct IntegritySnapshot {
        uint256 timestamp;
        address submitter;
        uint256 competitiveEffort;    // From Competitive Integrity Bond (0-10000)
        uint256 teamworkScore;        // From Teamwork Integrity Bond (0-10000)
        uint256 overallIntegrity;     // Combined score (0-10000)
        bool cleanRecord;             // No violations this period
        string notes;
    }

    struct CorruptionReport {
        uint256 timestamp;
        address reporter;
        ViolationType violationType;
        string evidence;
        bool investigated;
        bool confirmed;
        string investigationNotes;
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 fanShare;
        uint256 redistributionPool;   // Forfeited stakes go here
        IntegrityStatus status;
        uint256 timeMult;
        uint256 integrityScore;
        uint256 consistencyScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => IntegritySnapshot[]) public bondIntegritySnapshots;
    mapping(uint256 => CorruptionReport[]) public bondCorruptionReports;
    mapping(uint256 => Distribution[]) public bondDistributions;
    mapping(address => uint256[]) public fanBonds; // Track all bonds for a fan

    mapping(address => bool) public authorizedOracles;
    mapping(address => bool) public authorizedInvestigators;

    uint256 public redistributionPool;  // Pool of forfeited stakes from corruption
    uint256 public yieldPool;  // Pool that funds bond appreciation

    address public owner;

    // Time multipliers (in seconds)
    uint256 public constant ONE_YEAR = 31536000;
    uint256 public constant TWO_YEARS = 63072000;
    uint256 public constant THREE_YEARS = 94608000;
    uint256 public constant FIVE_YEARS = 157680000;

    // Integrity thresholds
    uint256 public constant CORRUPTED_THRESHOLD = 0;       // Any corruption = 0
    uint256 public constant DECLINING_THRESHOLD = 5000;    // < 50 = declining
    uint256 public constant STABLE_THRESHOLD = 7000;       // 50-70 = stable
    uint256 public constant RISING_THRESHOLD = 8500;       // 70-85 = rising
    uint256 public constant ELITE_THRESHOLD = 8500;        // 85+ = elite

    // Violation penalties (multiplied by stake)
    uint256 public constant MATCH_FIXING_PENALTY = 10000;        // 100% forfeit
    uint256 public constant PED_PENALTY = 8000;                  // 80% forfeit
    uint256 public constant GAMBLING_PENALTY = 7000;             // 70% forfeit
    uint256 public constant LOAD_MANAGEMENT_PENALTY = 3000;      // 30% forfeit
    uint256 public constant TANKING_PENALTY = 5000;              // 50% forfeit

    // Clean record bonus
    uint256 public constant FIVE_YEAR_CLEAN_BONUS = 2000;  // +20% for 5-year clean record

    // ============ Events ============

    event BondCreated(
        uint256 indexed bondId,
        address indexed fanAddress,
        address indexed playerOrTeamAddress,
        string name,
        uint256 maturityDate
    );
    event IntegritySnapshotRecorded(uint256 indexed bondId, uint256 overallIntegrity, bool cleanRecord);
    event CorruptionReported(uint256 indexed bondId, ViolationType violationType, address reporter);
    event CorruptionConfirmed(uint256 indexed bondId, ViolationType violationType, uint256 forfeitAmount);
    event BondSettled(uint256 indexed bondId, IntegrityStatus status, uint256 fanShare);
    event BondForfeited(uint256 indexed bondId, ViolationType violationType, uint256 amount);

    // ============ Modifiers ============

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        _;
    }

    modifier onlyAuthorizedInvestigator() {
        require(authorizedInvestigators[msg.sender], "Not authorized investigator");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        authorizedOracles[msg.sender] = true;
        authorizedInvestigators[msg.sender] = true;
    }

    /**
     * @notice Fund the yield pool to enable bond appreciation
     */
    function fundYieldPool() external payable {
        require(msg.value > 0, "Must send ETH");
        yieldPool += msg.value;
    }

    /**
     * @notice Owner can withdraw excess yield pool funds
     */
    function withdrawYieldPool(uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        require(amount <= yieldPool, "Insufficient yield pool");
        yieldPool -= amount;
        payable(owner).transfer(amount);
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new Fan Belief Bond
     * @param playerOrTeamAddress Wallet address of player/team
     * @param playerOrTeamName Name
     * @param bondType "player" or "team"
     * @param league League name
     * @param maturityYears Years to hold (1, 2, 3, 5+)
     */
    function createBond(
        address playerOrTeamAddress,
        string memory playerOrTeamName,
        string memory bondType,
        string memory league,
        uint256 maturityYears
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Stake must be > 0");
        require(msg.value >= 0.001 ether, "Minimum stake 0.001 ETH");
        require(maturityYears >= 1 && maturityYears <= 10, "Maturity 1-10 years");
        require(
            keccak256(bytes(bondType)) == keccak256(bytes("player")) ||
            keccak256(bytes(bondType)) == keccak256(bytes("team")),
            "Bond type must be 'player' or 'team'"
        );

        uint256 maturityDate = block.timestamp + (maturityYears * ONE_YEAR);
        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            fanAddress: msg.sender,
            playerOrTeamAddress: playerOrTeamAddress,
            playerOrTeamName: playerOrTeamName,
            bondType: bondType,
            league: league,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            maturityDate: maturityDate,
            active: true,
            settled: false,
            violation: ViolationType.None
        });

        fanBonds[msg.sender].push(bondId);

        emit BondCreated(bondId, msg.sender, playerOrTeamAddress, playerOrTeamName, maturityDate);
        return bondId;
    }

    /**
     * @notice Record integrity snapshot (from other bond contracts)
     * @param bondId The bond ID
     * @param competitiveEffort Competitive integrity score (0-10000)
     * @param teamworkScore Teamwork integrity score (0-10000)
     * @param cleanRecord No violations this period?
     * @param notes Additional context
     */
    function recordIntegritySnapshot(
        uint256 bondId,
        uint256 competitiveEffort,
        uint256 teamworkScore,
        bool cleanRecord,
        string memory notes
    ) external onlyAuthorizedOracle {
        require(bonds[bondId].active, "Bond not active");
        require(competitiveEffort <= 10000, "Competitive effort out of range");
        require(teamworkScore <= 10000, "Teamwork score out of range");

        uint256 overallIntegrity = (competitiveEffort + teamworkScore) / 2;

        bondIntegritySnapshots[bondId].push(IntegritySnapshot({
            timestamp: block.timestamp,
            submitter: msg.sender,
            competitiveEffort: competitiveEffort,
            teamworkScore: teamworkScore,
            overallIntegrity: overallIntegrity,
            cleanRecord: cleanRecord,
            notes: notes
        }));

        emit IntegritySnapshotRecorded(bondId, overallIntegrity, cleanRecord);
    }

    /**
     * @notice Report potential corruption
     * @param bondId The bond ID
     * @param violationType Type of violation
     * @param evidence Evidence/details
     */
    function reportCorruption(
        uint256 bondId,
        ViolationType violationType,
        string memory evidence
    ) external {
        require(bonds[bondId].active, "Bond not active");
        require(violationType != ViolationType.None, "Must specify violation type");

        bondCorruptionReports[bondId].push(CorruptionReport({
            timestamp: block.timestamp,
            reporter: msg.sender,
            violationType: violationType,
            evidence: evidence,
            investigated: false,
            confirmed: false,
            investigationNotes: ""
        }));

        emit CorruptionReported(bondId, violationType, msg.sender);
    }

    /**
     * @notice Confirm corruption after investigation
     * @param bondId The bond ID
     * @param reportIndex Index of the corruption report
     * @param confirmed Was corruption confirmed?
     * @param investigationNotes Investigation details
     */
    function confirmCorruption(
        uint256 bondId,
        uint256 reportIndex,
        bool confirmed,
        string memory investigationNotes
    ) external onlyAuthorizedInvestigator {
        require(bonds[bondId].active, "Bond not active");
        require(reportIndex < bondCorruptionReports[bondId].length, "Invalid report index");

        CorruptionReport storage report = bondCorruptionReports[bondId][reportIndex];
        require(!report.investigated, "Already investigated");

        report.investigated = true;
        report.confirmed = confirmed;
        report.investigationNotes = investigationNotes;

        if (confirmed) {
            bonds[bondId].violation = report.violationType;
            bonds[bondId].active = false;

            // Forfeit bond based on violation type
            uint256 forfeitAmount = _calculateForfeitAmount(bonds[bondId].stakeAmount, report.violationType);
            redistributionPool += forfeitAmount;

            emit CorruptionConfirmed(bondId, report.violationType, forfeitAmount);
            emit BondForfeited(bondId, report.violationType, forfeitAmount);

            // Reward whistleblower (10% of forfeited amount)
            uint256 whistleblowerReward = forfeitAmount / 10;
            if (whistleblowerReward > 0) {
                payable(report.reporter).transfer(whistleblowerReward);
                redistributionPool -= whistleblowerReward;
            }
        }
    }

    /**
     * @notice Settle bond at maturity
     * @param bondId The bond ID
     */
    function settleBond(uint256 bondId) external nonReentrant {
        Bond storage bond = bonds[bondId];
        require(bond.active, "Bond not active");
        require(!bond.settled, "Already settled");
        require(block.timestamp >= bond.maturityDate, "Not yet mature");
        require(msg.sender == bond.fanAddress, "Only bond owner can settle");

        // Check for violations
        if (bond.violation != ViolationType.None) {
            // Bond forfeited due to corruption
            bond.settled = true;
            bond.active = false;
            emit BondSettled(bondId, IntegrityStatus.Corrupted, 0);
            return;
        }

        // Calculate scores
        uint256 integrityScore = _calculateAverageIntegrityScore(bondId);
        uint256 consistencyScore = _calculateConsistencyScore(bondId);
        uint256 timeMult = _calculateTimeMultiplier(bond.createdAt, bond.maturityDate);

        // Determine status
        IntegrityStatus status;
        if (integrityScore >= ELITE_THRESHOLD && consistencyScore >= 8000) {
            status = IntegrityStatus.Elite;
        } else if (integrityScore >= RISING_THRESHOLD) {
            status = IntegrityStatus.Rising;
        } else if (integrityScore >= STABLE_THRESHOLD) {
            status = IntegrityStatus.Stable;
        } else if (integrityScore >= DECLINING_THRESHOLD) {
            status = IntegrityStatus.Declining;
        } else {
            status = IntegrityStatus.Corrupted;
        }

        // Calculate fan share
        uint256 fanShare = _calculateFanShare(bond.stakeAmount, status, timeMult, consistencyScore);

        // Check for 5-year clean bonus
        if (block.timestamp - bond.createdAt >= FIVE_YEARS && _hasCleanRecord(bondId)) {
            fanShare = (fanShare * (10000 + FIVE_YEAR_CLEAN_BONUS)) / 10000;
        }

        // Record distribution
        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: int256(fanShare),
            fanShare: fanShare,
            redistributionPool: 0,
            status: status,
            timeMult: timeMult,
            integrityScore: integrityScore,
            consistencyScore: consistencyScore,
            reason: status == IntegrityStatus.Elite ? "Elite sustained integrity - maximum appreciation" :
                    status == IntegrityStatus.Rising ? "Rising integrity - strong appreciation" :
                    status == IntegrityStatus.Stable ? "Stable integrity - moderate appreciation" :
                    "Declining integrity - limited appreciation"
        }));

        bond.settled = true;
        bond.active = false;

        // Calculate appreciation needed
        uint256 appreciationNeeded = fanShare > bond.stakeAmount ? fanShare - bond.stakeAmount : 0;

        // Check if yield pool can cover appreciation
        if (appreciationNeeded > 0) {
            require(yieldPool >= appreciationNeeded, "Insufficient yield pool for appreciation");
            yieldPool -= appreciationNeeded;
        }

        // Transfer to fan
        if (fanShare > 0) {
            payable(bond.fanAddress).transfer(fanShare);
        }

        emit BondSettled(bondId, status, fanShare);
    }

    /**
     * @notice Early withdrawal (forfeit appreciation)
     * @param bondId The bond ID
     */
    function earlyWithdrawal(uint256 bondId) external nonReentrant {
        Bond storage bond = bonds[bondId];
        require(bond.active, "Bond not active");
        require(!bond.settled, "Already settled");
        require(msg.sender == bond.fanAddress, "Only bond owner can withdraw");
        require(block.timestamp < bond.maturityDate, "Already mature, use settleBond");

        // Early withdrawal = return stake only, no appreciation
        uint256 returnAmount = bond.stakeAmount;

        bond.settled = true;
        bond.active = false;

        payable(bond.fanAddress).transfer(returnAmount);

        emit BondSettled(bondId, IntegrityStatus.Stable, returnAmount);
    }

    // ============ Internal Functions ============

    function _calculateAverageIntegrityScore(uint256 bondId) internal view returns (uint256) {
        IntegritySnapshot[] storage snapshots = bondIntegritySnapshots[bondId];
        if (snapshots.length == 0) return 5000; // Neutral if no data

        uint256 totalScore = 0;
        for (uint256 i = 0; i < snapshots.length; i++) {
            totalScore += snapshots[i].overallIntegrity;
        }
        return totalScore / snapshots.length;
    }

    function _calculateConsistencyScore(uint256 bondId) internal view returns (uint256) {
        IntegritySnapshot[] storage snapshots = bondIntegritySnapshots[bondId];
        if (snapshots.length < 2) return 5000; // Need at least 2 snapshots

        // Calculate variance in integrity scores
        uint256 avgIntegrity = _calculateAverageIntegrityScore(bondId);
        uint256 totalDeviation = 0;

        for (uint256 i = 0; i < snapshots.length; i++) {
            uint256 deviation = snapshots[i].overallIntegrity > avgIntegrity ?
                snapshots[i].overallIntegrity - avgIntegrity :
                avgIntegrity - snapshots[i].overallIntegrity;
            totalDeviation += deviation;
        }

        uint256 avgDeviation = totalDeviation / snapshots.length;

        // Lower deviation = higher consistency
        // Max deviation is 10000, so invert
        return avgDeviation < 10000 ? 10000 - avgDeviation : 0;
    }

    function _calculateTimeMultiplier(uint256 createdAt, uint256 maturityDate) internal view returns (uint256) {
        uint256 duration = maturityDate - createdAt;

        if (duration >= FIVE_YEARS) {
            return 50000; // 5x
        } else if (duration >= THREE_YEARS) {
            return 40000; // 4x
        } else if (duration >= TWO_YEARS) {
            return 30000; // 3x
        } else if (duration >= ONE_YEAR) {
            return 20000; // 2x
        } else {
            return 10000; // 1x
        }
    }

    function _calculateFanShare(
        uint256 stakeAmount,
        IntegrityStatus status,
        uint256 timeMult,
        uint256 consistencyScore
    ) internal pure returns (uint256) {
        uint256 baseValue = stakeAmount;

        // Apply status multiplier
        if (status == IntegrityStatus.Corrupted) {
            return 0;
        } else if (status == IntegrityStatus.Declining) {
            baseValue = (baseValue * 5000) / 10000; // 50%
        } else if (status == IntegrityStatus.Stable) {
            baseValue = (baseValue * 10000) / 10000; // 100%
        } else if (status == IntegrityStatus.Rising) {
            baseValue = (baseValue * 15000) / 10000; // 150%
        } else if (status == IntegrityStatus.Elite) {
            baseValue = (baseValue * 20000) / 10000; // 200%
        }

        // Apply time multiplier
        baseValue = (baseValue * timeMult) / 10000;

        // Apply consistency bonus (up to +20%)
        uint256 consistencyBonus = (consistencyScore * 2000) / 10000; // Max 20% bonus
        baseValue = (baseValue * (10000 + consistencyBonus)) / 10000;

        return baseValue;
    }

    function _calculateForfeitAmount(uint256 stakeAmount, ViolationType violationType) internal pure returns (uint256) {
        if (violationType == ViolationType.MatchFixing) {
            return stakeAmount; // 100% forfeit
        } else if (violationType == ViolationType.PEDUsage) {
            return (stakeAmount * PED_PENALTY) / 10000;
        } else if (violationType == ViolationType.GamblingViolation) {
            return (stakeAmount * GAMBLING_PENALTY) / 10000;
        } else if (violationType == ViolationType.LoadManagementAbuse) {
            return (stakeAmount * LOAD_MANAGEMENT_PENALTY) / 10000;
        } else if (violationType == ViolationType.TankingParticipation) {
            return (stakeAmount * TANKING_PENALTY) / 10000;
        }
        return 0;
    }

    function _hasCleanRecord(uint256 bondId) internal view returns (bool) {
        IntegritySnapshot[] storage snapshots = bondIntegritySnapshots[bondId];
        for (uint256 i = 0; i < snapshots.length; i++) {
            if (!snapshots[i].cleanRecord) {
                return false;
            }
        }
        return snapshots.length > 0;
    }

    // ============ Admin Functions ============

    function addAuthorizedOracle(address oracle) external {
        require(msg.sender == address(this) || authorizedOracles[msg.sender], "Not authorized");
        authorizedOracles[oracle] = true;
    }

    function removeAuthorizedOracle(address oracle) external {
        require(msg.sender == address(this) || authorizedOracles[msg.sender], "Not authorized");
        authorizedOracles[oracle] = false;
    }

    function addAuthorizedInvestigator(address investigator) external {
        require(msg.sender == address(this) || authorizedInvestigators[msg.sender], "Not authorized");
        authorizedInvestigators[investigator] = true;
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getFanBonds(address fan) external view returns (uint256[] memory) {
        return fanBonds[fan];
    }

    function getIntegritySnapshots(uint256 bondId) external view returns (IntegritySnapshot[] memory) {
        return bondIntegritySnapshots[bondId];
    }

    function getCorruptionReports(uint256 bondId) external view returns (CorruptionReport[] memory) {
        return bondCorruptionReports[bondId];
    }

    function getDistributions(uint256 bondId) external view returns (Distribution[] memory) {
        return bondDistributions[bondId];
    }

    function getRedistributionPool() external view returns (uint256) {
        return redistributionPool;
    }
}
