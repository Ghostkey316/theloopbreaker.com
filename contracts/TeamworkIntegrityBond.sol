// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Teamwork Integrity Bonds
 * @notice TEAM > INDIVIDUAL - Rewarding teamwork over stat padding
 *
 * Philosophy: Bonds appreciate when players make teammates better and prioritize winning.
 * Stat padding and selfish play penalize bonds.
 *
 * Key Innovation: Teammate verification (anonymous) + algorithmic stat padding detection.
 */
contract TeamworkIntegrityBond is ReentrancyGuard {

    // ============ Enums ============

    enum TeamworkLevel {
        StatChaser,   // Obvious stat padding (< 40 score)
        Neutral,      // Mixed performance (40-70 score)
        TeamPlayer,   // Good teammate (70-85 score)
        Champion      // Elite team-first player (85+ score)
    }

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address playerAddress;      // Wallet representing the player
        string playerName;
        string teamName;
        string league;
        string season;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 seasonEndDate;
        bool active;
        bool settled;
    }

    struct ChemistryMetrics {
        uint256 timestamp;
        address submitter;
        uint256 assistRatio;          // 0-10000 (passing vs hero ball)
        uint256 defensiveEffort;      // 0-10000 (help defense, communication)
        uint256 benchSupport;         // 0-10000 (celebrating teammates)
        uint256 plusMinusDifferential; // 0-10000 (team better with player on court)
        string dataSource;
    }

    struct WinningVsStats {
        uint256 timestamp;
        address submitter;
        uint256 performanceInWins;     // 0-10000
        uint256 performanceInLosses;   // 0-10000
        uint256 clutchPerformance;     // 0-10000 (big moments)
        uint256 sacrificeScore;        // 0-10000 (charges, screens, tough assignments)
        bool statPaddingDetected;
        string reason;
    }

    struct TeammateVerification {
        address verifier;              // Anonymous wallet (not linked to real teammate)
        uint256 timestamp;
        uint256 makesBetter;           // 0-10 "Does player make teammates better?"
        uint256 prioritizesWinning;    // 0-10 "Prioritizes winning over stats?"
        bool wouldWantInPlayoffs;      // "Want them in playoff series?"
        string relationship;           // "teammate", "coach", "staff"
        bool verified;                 // Has relationship been verified?
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 playerShare;
        uint256 teammatesShare;
        uint256 fansShare;
        TeamworkLevel rating;
        uint256 chemistryScore;
        uint256 winPriorityScore;
        uint256 teammateConsensusScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => ChemistryMetrics[]) public bondChemistryMetrics;
    mapping(uint256 => WinningVsStats[]) public bondWinningMetrics;
    mapping(uint256 => TeammateVerification[]) public bondTeammateVerifications;
    mapping(uint256 => Distribution[]) public bondDistributions;

    mapping(address => bool) public authorizedOracles;
    mapping(address => bool) public verifiedTeammates;

    uint256 public teammateCompensationPool;  // Pool for compensating teammates of stat chasers
    uint256 public yieldPool;  // Pool that funds bond appreciation

    address public owner;
    address public pendingOwner;
    bool public paused;

    // Yield pool requirements
    uint256 public constant MINIMUM_YIELD_POOL_BALANCE = 1 ether;

    // Scoring thresholds
    uint256 public constant STAT_CHASER_THRESHOLD = 4000;  // < 40 = stat padding
    uint256 public constant NEUTRAL_THRESHOLD = 7000;      // 40-70 = neutral
    uint256 public constant TEAM_PLAYER_THRESHOLD = 8500;  // 70-85 = team player
    uint256 public constant CHAMPION_THRESHOLD = 8500;     // 85+ = champion

    // Teammate verification requirements
    uint256 public constant MIN_TEAMMATE_VERIFICATIONS = 5;
    uint256 public constant TEAMMATE_CONSENSUS_THRESHOLD = 7000; // 70% positive required

    // Stat padding detection flags
    uint256 public constant STAT_PADDING_WIN_LOSS_DELTA = 3000; // 30% worse in losses = flag
    uint256 public constant CLUTCH_DISAPPEARANCE_THRESHOLD = 4000; // < 40 in clutch = flag

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed playerAddress, string playerName, string season);
    event ChemistryMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 assistRatio);
    event WinningMetricsSubmitted(uint256 indexed bondId, address submitter, bool statPaddingDetected);
    event TeammateVerificationAdded(uint256 indexed bondId, address indexed verifier, uint256 makesBetter);
    event BondSettled(uint256 indexed bondId, TeamworkLevel rating, uint256 playerShare, uint256 teammatesShare);
    event StatPaddingDetected(uint256 indexed bondId, string reason, uint256 penaltyAmount);
    event YieldPoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event YieldPoolWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event OwnershipTransferInitiated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event Paused();
    event Unpaused();

    // ============ Modifiers ============

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        authorizedOracles[msg.sender] = true;
    }

    /**
     * @notice Fund the yield pool to enable bond appreciation
     */
    function fundYieldPool() external payable {
        require(msg.value > 0, "Must send ETH");
        yieldPool += msg.value;
        emit YieldPoolFunded(msg.sender, msg.value, yieldPool);
    }

    /**
     * @notice Owner can withdraw excess yield pool funds
     */
    function withdrawYieldPool(uint256 amount) external nonReentrant {
        require(msg.sender == owner, "Only owner");
        require(amount <= yieldPool, "Insufficient yield pool");
        require(yieldPool - amount >= MINIMUM_YIELD_POOL_BALANCE, "Cannot withdraw below minimum balance");
        yieldPool -= amount;
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
        emit YieldPoolWithdrawn(msg.sender, amount, yieldPool);
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new Teamwork Integrity Bond
     * @param playerName Name of the player
     * @param teamName Team name
     * @param league League name
     * @param season Season identifier
     * @param seasonEndDate Unix timestamp when season ends
     */
    function createBond(
        string memory playerName,
        string memory teamName,
        string memory league,
        string memory season,
        uint256 seasonEndDate
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value > 0, "Stake must be > 0");
        require(seasonEndDate > block.timestamp, "Season end must be in future");
        require(msg.value >= 0.1 ether, "Minimum stake 0.1 ETH for player bonds");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            playerAddress: msg.sender,
            playerName: playerName,
            teamName: teamName,
            league: league,
            season: season,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            seasonEndDate: seasonEndDate,
            active: true,
            settled: false
        });

        emit BondCreated(bondId, msg.sender, playerName, season);
        return bondId;
    }

    /**
     * @notice Submit chemistry metrics for a player
     * @param bondId The bond ID
     * @param assistRatio Assist ratio (0-10000)
     * @param defensiveEffort Defensive effort (0-10000)
     * @param benchSupport Bench celebrations (0-10000)
     * @param plusMinusDifferential Plus/minus differential (0-10000)
     * @param dataSource Source of the data
     */
    function submitChemistryMetrics(
        uint256 bondId,
        uint256 assistRatio,
        uint256 defensiveEffort,
        uint256 benchSupport,
        uint256 plusMinusDifferential,
        string memory dataSource
    ) external onlyAuthorizedOracle {
        require(bonds[bondId].active, "Bond not active");
        require(assistRatio <= 10000, "Assist ratio out of range");
        require(defensiveEffort <= 10000, "Defensive effort out of range");
        require(benchSupport <= 10000, "Bench support out of range");
        require(plusMinusDifferential <= 10000, "Plus/minus out of range");

        bondChemistryMetrics[bondId].push(ChemistryMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            assistRatio: assistRatio,
            defensiveEffort: defensiveEffort,
            benchSupport: benchSupport,
            plusMinusDifferential: plusMinusDifferential,
            dataSource: dataSource
        }));

        emit ChemistryMetricsSubmitted(bondId, msg.sender, assistRatio);
    }

    /**
     * @notice Submit winning vs stats analysis
     * @param bondId The bond ID
     * @param performanceInWins Performance in winning games (0-10000)
     * @param performanceInLosses Performance in losing games (0-10000)
     * @param clutchPerformance Clutch performance (0-10000)
     * @param sacrificeScore Sacrificing stats for team (0-10000)
     * @param statPaddingDetected Was stat padding detected?
     * @param reason Explanation
     */
    function submitWinningMetrics(
        uint256 bondId,
        uint256 performanceInWins,
        uint256 performanceInLosses,
        uint256 clutchPerformance,
        uint256 sacrificeScore,
        bool statPaddingDetected,
        string memory reason
    ) external onlyAuthorizedOracle {
        require(bonds[bondId].active, "Bond not active");
        require(performanceInWins <= 10000, "Performance in wins out of range");
        require(performanceInLosses <= 10000, "Performance in losses out of range");
        require(clutchPerformance <= 10000, "Clutch performance out of range");
        require(sacrificeScore <= 10000, "Sacrifice score out of range");

        bondWinningMetrics[bondId].push(WinningVsStats({
            timestamp: block.timestamp,
            submitter: msg.sender,
            performanceInWins: performanceInWins,
            performanceInLosses: performanceInLosses,
            clutchPerformance: clutchPerformance,
            sacrificeScore: sacrificeScore,
            statPaddingDetected: statPaddingDetected,
            reason: reason
        }));

        emit WinningMetricsSubmitted(bondId, msg.sender, statPaddingDetected);

        if (statPaddingDetected) {
            emit StatPaddingDetected(bondId, reason, 0);
        }
    }

    /**
     * @notice Teammates verify player culture contribution (anonymous)
     * @param bondId The bond ID
     * @param makesBetter Does player make teammates better? (0-10)
     * @param prioritizesWinning Prioritizes winning over stats? (0-10)
     * @param wouldWantInPlayoffs Want them in playoff series?
     * @param relationship "teammate", "coach", "staff"
     */
    function submitTeammateVerification(
        uint256 bondId,
        uint256 makesBetter,
        uint256 prioritizesWinning,
        bool wouldWantInPlayoffs,
        string memory relationship
    ) external {
        require(bonds[bondId].active, "Bond not active");
        require(makesBetter <= 10, "makesBetter out of range (0-10)");
        require(prioritizesWinning <= 10, "prioritizesWinning out of range (0-10)");
        require(
            keccak256(bytes(relationship)) == keccak256(bytes("teammate")) ||
            keccak256(bytes(relationship)) == keccak256(bytes("coach")) ||
            keccak256(bytes(relationship)) == keccak256(bytes("staff")),
            "Invalid relationship"
        );

        // In production, would verify relationship via ZK proof or third-party verification
        // For now, allow anonymous submissions
        bondTeammateVerifications[bondId].push(TeammateVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            makesBetter: makesBetter,
            prioritizesWinning: prioritizesWinning,
            wouldWantInPlayoffs: wouldWantInPlayoffs,
            relationship: relationship,
            verified: false // Would be verified off-chain
        }));

        emit TeammateVerificationAdded(bondId, msg.sender, makesBetter);
    }

    /**
     * @notice Calculate final teamwork score and distribute bond
     * @param bondId The bond ID
     */
    function settleBond(uint256 bondId) external nonReentrant {
        Bond storage bond = bonds[bondId];
        require(bond.active, "Bond not active");
        require(!bond.settled, "Already settled");
        require(block.timestamp >= bond.seasonEndDate, "Season not ended");

        // Calculate scores
        uint256 chemistryScore = _calculateChemistryScore(bondId);
        uint256 winPriorityScore = _calculateWinPriorityScore(bondId);
        uint256 teammateConsensusScore = _calculateTeammateConsensusScore(bondId);

        // Combined score
        uint256 overallScore = (chemistryScore + winPriorityScore + teammateConsensusScore) / 3;

        // Determine teamwork level
        TeamworkLevel level;
        if (overallScore >= CHAMPION_THRESHOLD) {
            level = TeamworkLevel.Champion;
        } else if (overallScore >= TEAM_PLAYER_THRESHOLD) {
            level = TeamworkLevel.TeamPlayer;
        } else if (overallScore >= NEUTRAL_THRESHOLD) {
            level = TeamworkLevel.Neutral;
        } else {
            level = TeamworkLevel.StatChaser;
        }

        // Calculate distribution
        (uint256 playerShare, uint256 teammatesShare, uint256 fansShare) = _calculateDistribution(
            bond.stakeAmount,
            level,
            overallScore
        );

        // Record distribution
        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: int256(bond.stakeAmount),
            playerShare: playerShare,
            teammatesShare: teammatesShare,
            fansShare: fansShare,
            rating: level,
            chemistryScore: chemistryScore,
            winPriorityScore: winPriorityScore,
            teammateConsensusScore: teammateConsensusScore,
            reason: level == TeamworkLevel.StatChaser ? "Stat padding detected - compensation to teammates" :
                    level == TeamworkLevel.Champion ? "Elite team player - maximum appreciation" :
                    "Team-first player - shared appreciation"
        }));

        bond.settled = true;
        bond.active = false;

        // Calculate total payout needed
        uint256 totalPayout = playerShare + teammatesShare + fansShare;
        uint256 appreciationNeeded = totalPayout > bond.stakeAmount ? totalPayout - bond.stakeAmount : 0;

        // Check if yield pool can cover appreciation
        if (appreciationNeeded > 0) {
            require(yieldPool >= appreciationNeeded, "Insufficient yield pool for appreciation");
            yieldPool -= appreciationNeeded;
        }

        // Transfer funds
        if (playerShare > 0) {
            payable(bond.playerAddress).transfer(playerShare);
        }
        if (teammatesShare > 0) {
            teammateCompensationPool += teammatesShare;
        }
        // fansShare would be distributed separately

        emit BondSettled(bondId, level, playerShare, teammatesShare);
    }

    // ============ Internal Functions ============

    function _calculateChemistryScore(uint256 bondId) internal view returns (uint256) {
        ChemistryMetrics[] storage metrics = bondChemistryMetrics[bondId];
        uint256 metricsLength = metrics.length;
        if (metricsLength == 0) return 5000; // Neutral if no data

        uint256 totalScore = 0;
        for (uint256 i = 0; i < metricsLength;) {
            uint256 gameScore = (
                metrics[i].assistRatio +
                metrics[i].defensiveEffort +
                metrics[i].benchSupport +
                metrics[i].plusMinusDifferential
            ) / 4;
            totalScore += gameScore;
            unchecked { ++i; }
        }
        return totalScore / metricsLength;
    }

    function _calculateWinPriorityScore(uint256 bondId) internal view returns (uint256) {
        WinningVsStats[] storage metrics = bondWinningMetrics[bondId];
        uint256 metricsLength = metrics.length;
        if (metricsLength == 0) return 5000; // Neutral if no data

        uint256 totalScore = 0;
        uint256 statPaddingCount = 0;

        for (uint256 i = 0; i < metricsLength;) {
            // Calculate base score
            uint256 winLossDelta = metrics[i].performanceInWins > metrics[i].performanceInLosses ?
                (metrics[i].performanceInWins - metrics[i].performanceInLosses) : 0;

            // Penalize if performs much better in losses (stat padding indicator)
            if (metrics[i].performanceInLosses > metrics[i].performanceInWins &&
                (metrics[i].performanceInLosses - metrics[i].performanceInWins) > STAT_PADDING_WIN_LOSS_DELTA) {
                unchecked { statPaddingCount++; }
            }

            uint256 gameScore = (
                (10000 - winLossDelta) + // Lower delta is better (consistent)
                metrics[i].clutchPerformance +
                metrics[i].sacrificeScore
            ) / 3;

            totalScore += gameScore;
            unchecked { ++i; }
        }

        uint256 avgScore = totalScore / metricsLength;

        // Penalize for stat padding
        if (statPaddingCount > metricsLength / 4) { // More than 25% stat padding games
            avgScore = (avgScore * 5000) / 10000; // 50% penalty
        }

        return avgScore;
    }

    function _calculateTeammateConsensusScore(uint256 bondId) internal view returns (uint256) {
        TeammateVerification[] storage verifications = bondTeammateVerifications[bondId];
        uint256 verificationsLength = verifications.length;
        if (verificationsLength < MIN_TEAMMATE_VERIFICATIONS) {
            return 5000; // Neutral if insufficient verifications
        }

        uint256 totalMakesBetter = 0;
        uint256 totalPrioritizesWinning = 0;
        uint256 wouldWantCount = 0;

        for (uint256 i = 0; i < verificationsLength;) {
            totalMakesBetter += verifications[i].makesBetter;
            totalPrioritizesWinning += verifications[i].prioritizesWinning;
            if (verifications[i].wouldWantInPlayoffs) {
                unchecked { wouldWantCount++; }
            }
            unchecked { ++i; }
        }

        uint256 avgMakesBetter = (totalMakesBetter * 1000) / verificationsLength; // Convert to 0-10000 scale
        uint256 avgPrioritizesWinning = (totalPrioritizesWinning * 1000) / verificationsLength;
        uint256 playoffWantedPct = (wouldWantCount * 10000) / verificationsLength;

        return (avgMakesBetter + avgPrioritizesWinning + playoffWantedPct) / 3;
    }

    function _calculateDistribution(
        uint256 stakeAmount,
        TeamworkLevel level,
        uint256 overallScore
    ) internal pure returns (uint256 playerShare, uint256 teammatesShare, uint256 fansShare) {
        if (level == TeamworkLevel.StatChaser) {
            // Stat chaser: 0% to player, 100% to teammates as compensation
            playerShare = 0;
            teammatesShare = stakeAmount;
            fansShare = 0;
        } else if (level == TeamworkLevel.Neutral) {
            // Neutral: Minor appreciation, mostly to teammates
            uint256 total = (stakeAmount * 11000) / 10000; // 10% appreciation
            playerShare = (total * 3000) / 10000; // 30%
            teammatesShare = (total * 5000) / 10000; // 50%
            fansShare = total - playerShare - teammatesShare; // 20%
        } else if (level == TeamworkLevel.TeamPlayer) {
            // Team player: Good appreciation, shared
            uint256 total = (stakeAmount * 16000) / 10000; // 60% appreciation
            playerShare = (total * 6000) / 10000; // 60%
            teammatesShare = (total * 3000) / 10000; // 30%
            fansShare = total - playerShare - teammatesShare; // 10%
        } else {
            // Champion: Maximum appreciation
            uint256 total = (stakeAmount * 22000) / 10000; // 120% appreciation
            playerShare = (total * 6000) / 10000; // 60%
            teammatesShare = (total * 3000) / 10000; // 30%
            fansShare = total - playerShare - teammatesShare; // 10%
        }
    }

    // ============ Admin Functions ============

    function addAuthorizedOracle(address oracle) external {
        require(msg.sender == owner, "Only owner");
        require(oracle != address(0), "Invalid oracle address");
        authorizedOracles[oracle] = true;
        emit OracleAdded(oracle);
    }

    function removeAuthorizedOracle(address oracle) external {
        require(msg.sender == owner, "Only owner");
        authorizedOracles[oracle] = false;
        emit OracleRemoved(oracle);
    }

    /**
     * @notice Initiate ownership transfer (2-step process)
     */
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Only owner");
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

    /**
     * @notice Pause contract (emergency only)
     */
    function pause() external {
        require(msg.sender == owner, "Only owner");
        paused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external {
        require(msg.sender == owner, "Only owner");
        paused = false;
        emit Unpaused();
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getChemistryMetrics(uint256 bondId) external view returns (ChemistryMetrics[] memory) {
        return bondChemistryMetrics[bondId];
    }

    function getWinningMetrics(uint256 bondId) external view returns (WinningVsStats[] memory) {
        return bondWinningMetrics[bondId];
    }

    function getTeammateVerifications(uint256 bondId) external view returns (TeammateVerification[] memory) {
        return bondTeammateVerifications[bondId];
    }

    function getDistributions(uint256 bondId) external view returns (Distribution[] memory) {
        return bondDistributions[bondId];
    }
}
