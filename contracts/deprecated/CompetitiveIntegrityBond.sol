// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Competitive Integrity Bonds
 * @notice COMPETITION > MANIPULATION - Making sports real again
 *
 * Philosophy: Trying to win must be more profitable than tanking/rigging.
 * Bonds appreciate when teams compete authentically, depreciate when they tank.
 *
 * Key Innovation: Fan verification from BOTH teams + algorithmic tanking detection.
 */
contract CompetitiveIntegrityBond is ReentrancyGuard {

    // ============ Enums ============

    enum IntegrityLevel {
        Tanking,      // Obviously not trying (< 40 score)
        Questionable, // Mixed effort (40-60 score)
        Competitive,  // Legitimate competition (60-80 score)
        Elite         // Maximum effort (80+ score)
    }

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address teamAddress;        // Wallet representing the team
        string teamName;
        string league;              // "NBA", "NFL", "MLB", etc.
        string season;              // "2024-25"
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 seasonEndDate;
        bool active;
        bool settled;
    }

    struct EffortMetrics {
        uint256 timestamp;
        address submitter;          // Oracle or authorized reporter
        uint256 hustleScore;        // 0-10000 (loose balls, charges, defensive effort)
        uint256 fourthQuarterScore; // 0-10000 (closing games effort)
        uint256 backToBackScore;    // 0-10000 (effort on tired nights)
        uint256 bigGameScore;       // 0-10000 (showing up for important games)
        string dataSource;          // "NBA Stats API", "ESPN", etc.
    }

    struct TankingDetection {
        uint256 timestamp;
        address submitter;
        uint256 winProbabilityDelta;    // Expected wins vs actual (0-10000)
        uint256 suspiciousInjuryScore;  // 0-10000 (stars resting suspiciously)
        uint256 fourthQuarterQuitScore; // 0-10000 (giving up when behind)
        uint256 seasonTrajectoryScore;  // 0-10000 (fighting vs giving up)
        string algorithmVersion;
    }

    struct FanVerification {
        address fanWallet;
        uint256 timestamp;
        string teamAffiliation;     // "home" or "away"
        bool attestsCompetitive;    // "Was this a competitive game?"
        uint256 gameId;
        string nftTicketStub;       // Proof of attendance
        string geographicProof;     // IP + wallet location
    }

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 teamShare;
        uint256 playersShare;
        uint256 fansShare;
        IntegrityLevel seasonRating;
        uint256 effortScore;
        uint256 tankingScore;
        uint256 fanConsensusScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => EffortMetrics[]) public bondEffortMetrics;
    mapping(uint256 => TankingDetection[]) public bondTankingDetection;
    mapping(uint256 => mapping(uint256 => FanVerification[])) public bondGameVerifications; // bondId => gameId => verifications
    mapping(uint256 => Distribution[]) public bondDistributions;
    mapping(uint256 => mapping(address => uint256)) public fanStakes; // bondId => fan => stake amount
    mapping(uint256 => uint256) public totalFanStakes; // bondId => total stakes by all fans

    mapping(address => bool) public authorizedOracles;
    mapping(address => bool) public authorizedInvestigators;

    uint256 public fanCompensationPool;  // Pool for compensating fans who watched tanking teams
    uint256 public yieldPool;  // Pool that funds bond appreciation

    address public owner;
    address public pendingOwner;
    bool public paused;

    // Yield pool requirements
    uint256 public constant MINIMUM_YIELD_POOL_BALANCE = 1 ether;

    // Scoring thresholds
    uint256 public constant TANKING_THRESHOLD = 4000;      // < 40 = obvious tanking
    uint256 public constant QUESTIONABLE_THRESHOLD = 6000; // 40-60 = questionable
    uint256 public constant COMPETITIVE_THRESHOLD = 8000;  // 60-80 = competitive
    uint256 public constant ELITE_THRESHOLD = 8000;        // 80+ = elite effort

    // Fan verification requirements
    uint256 public constant MIN_FANS_PER_TEAM_PER_GAME = 100;
    uint256 public constant CONSENSUS_THRESHOLD = 6000; // 60% agreement required

    // Penalties and bonuses
    uint256 public constant TANKING_PENALTY_MULTIPLIER = 2000;     // 20% of stake
    uint256 public constant LOAD_MANAGEMENT_PENALTY = 5000;        // 50% depreciation
    uint256 public constant NO_VERIFICATION_PENALTY = 5000;        // 50% penalty
    uint256 public constant ELITE_EFFORT_BONUS = 15000;            // 150% appreciation

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed teamAddress, string teamName, string season);
    event EffortMetricsSubmitted(uint256 indexed bondId, address submitter, uint256 hustleScore);
    event TankingDetectionSubmitted(uint256 indexed bondId, address submitter, uint256 suspicionLevel);
    event FanVerificationAdded(uint256 indexed bondId, uint256 gameId, address indexed fan, bool attestsCompetitive);
    event BondSettled(uint256 indexed bondId, IntegrityLevel rating, uint256 teamShare, uint256 fansShare);
    event LoadManagementPenalty(uint256 indexed bondId, uint256 gamesRested, uint256 penaltyAmount);
    event TankingDetected(uint256 indexed bondId, uint256 compensationToFans);
    event YieldPoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event YieldPoolWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event FanCompensationClaimed(uint256 indexed bondId, address indexed fan, uint256 amount);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event InvestigatorAdded(address indexed investigator);
    event OwnershipTransferInitiated(address indexed oldOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event Paused();
    event Unpaused();

    // ============ Modifiers ============

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        _;
    }

    modifier onlyAuthorizedInvestigator() {
        require(authorizedInvestigators[msg.sender], "Not authorized investigator");
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
        authorizedInvestigators[msg.sender] = true;
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
     * @notice Create a new Competitive Integrity Bond
     * @param teamName Name of the team
     * @param league League name (NBA, NFL, etc.)
     * @param season Season identifier
     * @param seasonEndDate Unix timestamp when season ends
     */
    function createBond(
        string memory teamName,
        string memory league,
        string memory season,
        uint256 seasonEndDate
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value > 0, "Stake must be > 0");
        require(seasonEndDate > block.timestamp, "Season end must be in future");
        require(msg.value >= 1 ether, "Minimum stake 1 ETH for team bonds");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            teamAddress: msg.sender,
            teamName: teamName,
            league: league,
            season: season,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            seasonEndDate: seasonEndDate,
            active: true,
            settled: false
        });

        emit BondCreated(bondId, msg.sender, teamName, season);
        return bondId;
    }

    /**
     * @notice Submit effort metrics for a team
     * @param bondId The bond ID
     * @param hustleScore Hustle stats (0-10000)
     * @param fourthQuarterScore Fourth quarter performance (0-10000)
     * @param backToBackScore Back-to-back game effort (0-10000)
     * @param bigGameScore Big game participation (0-10000)
     * @param dataSource Source of the data
     */
    function submitEffortMetrics(
        uint256 bondId,
        uint256 hustleScore,
        uint256 fourthQuarterScore,
        uint256 backToBackScore,
        uint256 bigGameScore,
        string memory dataSource
    ) external onlyAuthorizedOracle {
        require(bonds[bondId].active, "Bond not active");
        require(hustleScore <= 10000, "Hustle score out of range");
        require(fourthQuarterScore <= 10000, "4Q score out of range");
        require(backToBackScore <= 10000, "B2B score out of range");
        require(bigGameScore <= 10000, "Big game score out of range");

        bondEffortMetrics[bondId].push(EffortMetrics({
            timestamp: block.timestamp,
            submitter: msg.sender,
            hustleScore: hustleScore,
            fourthQuarterScore: fourthQuarterScore,
            backToBackScore: backToBackScore,
            bigGameScore: bigGameScore,
            dataSource: dataSource
        }));

        emit EffortMetricsSubmitted(bondId, msg.sender, hustleScore);
    }

    /**
     * @notice Submit tanking detection analysis
     * @param bondId The bond ID
     * @param winProbabilityDelta Expected vs actual wins (0-10000)
     * @param suspiciousInjuryScore Suspicious injury patterns (0-10000)
     * @param fourthQuarterQuitScore Giving up when behind (0-10000)
     * @param seasonTrajectoryScore Season effort trajectory (0-10000)
     * @param algorithmVersion Algorithm version used
     */
    function submitTankingDetection(
        uint256 bondId,
        uint256 winProbabilityDelta,
        uint256 suspiciousInjuryScore,
        uint256 fourthQuarterQuitScore,
        uint256 seasonTrajectoryScore,
        string memory algorithmVersion
    ) external onlyAuthorizedOracle {
        require(bonds[bondId].active, "Bond not active");
        require(winProbabilityDelta <= 10000, "Win delta out of range");
        require(suspiciousInjuryScore <= 10000, "Injury score out of range");
        require(fourthQuarterQuitScore <= 10000, "Quit score out of range");
        require(seasonTrajectoryScore <= 10000, "Trajectory score out of range");

        bondTankingDetection[bondId].push(TankingDetection({
            timestamp: block.timestamp,
            submitter: msg.sender,
            winProbabilityDelta: winProbabilityDelta,
            suspiciousInjuryScore: suspiciousInjuryScore,
            fourthQuarterQuitScore: fourthQuarterQuitScore,
            seasonTrajectoryScore: seasonTrajectoryScore,
            algorithmVersion: algorithmVersion
        }));

        emit TankingDetectionSubmitted(bondId, msg.sender, suspiciousInjuryScore);
    }

    /**
     * @notice Fans verify game competitiveness
     * @param bondId The bond ID
     * @param gameId Unique game identifier
     * @param teamAffiliation "home" or "away"
     * @param attestsCompetitive Was the game competitive?
     * @param nftTicketStub Proof of attendance
     * @param geographicProof Location verification
     */
    function submitFanVerification(
        uint256 bondId,
        uint256 gameId,
        string memory teamAffiliation,
        bool attestsCompetitive,
        string memory nftTicketStub,
        string memory geographicProof
    ) external {
        require(bonds[bondId].active, "Bond not active");
        require(
            keccak256(bytes(teamAffiliation)) == keccak256(bytes("home")) ||
            keccak256(bytes(teamAffiliation)) == keccak256(bytes("away")),
            "Invalid team affiliation"
        );

        bondGameVerifications[bondId][gameId].push(FanVerification({
            fanWallet: msg.sender,
            timestamp: block.timestamp,
            teamAffiliation: teamAffiliation,
            attestsCompetitive: attestsCompetitive,
            gameId: gameId,
            nftTicketStub: nftTicketStub,
            geographicProof: geographicProof
        }));

        emit FanVerificationAdded(bondId, gameId, msg.sender, attestsCompetitive);
    }

    /**
     * @notice Allow fans to stake on team integrity
     * @param bondId The bond ID
     */
    function fanStakeOnTeam(uint256 bondId) external payable nonReentrant {
        require(bonds[bondId].active, "Bond not active");
        require(msg.value >= 0.001 ether, "Minimum fan stake 0.001 ETH");
        require(block.timestamp < bonds[bondId].seasonEndDate, "Season ended");

        fanStakes[bondId][msg.sender] += msg.value;
        totalFanStakes[bondId] += msg.value;
    }

    /**
     * @notice Claim fan compensation from settled bonds
     * @param bondId The bond ID
     */
    function claimFanCompensation(uint256 bondId) external nonReentrant {
        require(bonds[bondId].settled, "Bond not settled");
        uint256 fanStake = fanStakes[bondId][msg.sender];
        require(fanStake > 0, "No stake to claim");

        // Calculate fan's proportional share of the compensation pool for this bond
        uint256 totalStakes = _getTotalFanStakes(bondId);
        require(totalStakes > 0, "No total fan stakes");

        // Get the fansShare from the distribution
        Distribution[] storage distributions = bondDistributions[bondId];
        require(distributions.length > 0, "No distributions");
        uint256 fansShare = distributions[distributions.length - 1].fansShare;

        uint256 fanShare = (fanStake * fansShare) / totalStakes;

        // Clear the stake to prevent double claiming
        fanStakes[bondId][msg.sender] = 0;

        // Transfer compensation
        if (fanShare > 0) {
            require(fanCompensationPool >= fanShare, "Insufficient compensation pool");
            fanCompensationPool -= fanShare;
            (bool success, ) = payable(msg.sender).call{value: fanShare}("");
            require(success, "Transfer failed");
            emit FanCompensationClaimed(bondId, msg.sender, fanShare);
        }
    }

    /**
     * @notice Calculate final integrity score and distribute bond
     * @param bondId The bond ID
     */
    function settleBond(uint256 bondId) external nonReentrant {
        Bond storage bond = bonds[bondId];
        require(bond.active, "Bond not active");
        require(!bond.settled, "Already settled");
        require(block.timestamp >= bond.seasonEndDate, "Season not ended");

        // Calculate scores
        uint256 effortScore = _calculateAverageEffortScore(bondId);
        uint256 tankingScore = _calculateAntiTankingScore(bondId);
        uint256 fanConsensusScore = _calculateFanConsensusScore(bondId);

        // Combined score
        uint256 overallScore = (effortScore + tankingScore + fanConsensusScore) / 3;

        // Determine integrity level
        IntegrityLevel level;
        if (overallScore >= ELITE_THRESHOLD) {
            level = IntegrityLevel.Elite;
        } else if (overallScore >= COMPETITIVE_THRESHOLD) {
            level = IntegrityLevel.Competitive;
        } else if (overallScore >= QUESTIONABLE_THRESHOLD) {
            level = IntegrityLevel.Questionable;
        } else {
            level = IntegrityLevel.Tanking;
        }

        // Calculate distribution
        (uint256 teamShare, uint256 playersShare, uint256 fansShare) = _calculateDistribution(
            bond.stakeAmount,
            level,
            overallScore
        );

        // Record distribution
        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: int256(bond.stakeAmount),
            teamShare: teamShare,
            playersShare: playersShare,
            fansShare: fansShare,
            seasonRating: level,
            effortScore: effortScore,
            tankingScore: tankingScore,
            fanConsensusScore: fanConsensusScore,
            reason: level == IntegrityLevel.Tanking ? "Tanking detected - compensation to fans" :
                    level == IntegrityLevel.Elite ? "Elite effort - maximum appreciation" :
                    "Competitive season - shared appreciation"
        }));

        bond.settled = true;
        bond.active = false;

        // Calculate total payout needed
        uint256 totalPayout = teamShare + playersShare + fansShare;
        uint256 appreciationNeeded = totalPayout > bond.stakeAmount ? totalPayout - bond.stakeAmount : 0;

        // Check if yield pool can cover appreciation
        if (appreciationNeeded > 0) {
            require(yieldPool >= appreciationNeeded, "Insufficient yield pool for appreciation");
            yieldPool -= appreciationNeeded;
        }

        // Transfer funds (using call{value:} instead of transfer for safety)
        if (teamShare > 0) {
            (bool success, ) = payable(bond.teamAddress).call{value: teamShare}("");
            require(success, "Transfer to team failed");
        }
        if (fansShare > 0) {
            fanCompensationPool += fansShare;
        }
        // Note: playersShare would be distributed separately to team players

        emit BondSettled(bondId, level, teamShare, fansShare);
    }

    // ============ Internal Functions ============

    function _getTotalFanStakes(uint256 bondId) internal view returns (uint256) {
        return totalFanStakes[bondId];
    }

    function _calculateAverageEffortScore(uint256 bondId) internal view returns (uint256) {
        EffortMetrics[] storage metrics = bondEffortMetrics[bondId];
        uint256 metricsLength = metrics.length;
        if (metricsLength == 0) return 5000; // Neutral if no data

        uint256 totalScore = 0;
        for (uint256 i = 0; i < metricsLength;) {
            uint256 gameScore = (
                metrics[i].hustleScore +
                metrics[i].fourthQuarterScore +
                metrics[i].backToBackScore +
                metrics[i].bigGameScore
            ) / 4;
            totalScore += gameScore;
            unchecked { ++i; }
        }
        return totalScore / metricsLength;
    }

    function _calculateAntiTankingScore(uint256 bondId) internal view returns (uint256) {
        TankingDetection[] storage detections = bondTankingDetection[bondId];
        uint256 detectionsLength = detections.length;
        if (detectionsLength == 0) return 5000; // Neutral if no data

        uint256 totalScore = 0;
        for (uint256 i = 0; i < detectionsLength;) {
            // Higher scores = more tanking detected, so invert
            uint256 tankingLevel = (
                detections[i].winProbabilityDelta +
                detections[i].suspiciousInjuryScore +
                detections[i].fourthQuarterQuitScore +
                (10000 - detections[i].seasonTrajectoryScore)
            ) / 4;
            totalScore += (10000 - tankingLevel); // Invert: high tanking = low score
            unchecked { ++i; }
        }
        return totalScore / detectionsLength;
    }

    function _calculateFanConsensusScore(uint256 bondId) internal view returns (uint256) {
        // This is simplified - in production would iterate through all games
        // For now, return neutral score
        return 5000;
    }

    function _calculateDistribution(
        uint256 stakeAmount,
        IntegrityLevel level,
        uint256 overallScore
    ) internal pure returns (uint256 teamShare, uint256 playersShare, uint256 fansShare) {
        if (level == IntegrityLevel.Tanking) {
            // Tanking: 0% to team, 100% to fans as compensation
            teamShare = 0;
            playersShare = 0;
            fansShare = stakeAmount;
        } else if (level == IntegrityLevel.Questionable) {
            // Questionable: Minor appreciation, mostly to fans
            uint256 total = (stakeAmount * 11000) / 10000; // 10% appreciation
            teamShare = (total * 2000) / 10000; // 20%
            playersShare = (total * 1000) / 10000; // 10%
            fansShare = total - teamShare - playersShare; // 70%
        } else if (level == IntegrityLevel.Competitive) {
            // Competitive: Good appreciation, shared
            uint256 total = (stakeAmount * 15000) / 10000; // 50% appreciation
            teamShare = (total * 4000) / 10000; // 40%
            playersShare = (total * 3000) / 10000; // 30%
            fansShare = total - teamShare - playersShare; // 30%
        } else {
            // Elite: Maximum appreciation
            uint256 total = (stakeAmount * 20000) / 10000; // 100% appreciation
            teamShare = (total * 5000) / 10000; // 50%
            playersShare = (total * 3000) / 10000; // 30%
            fansShare = total - teamShare - playersShare; // 20%
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

    function addAuthorizedInvestigator(address investigator) external {
        require(msg.sender == owner, "Only owner");
        require(investigator != address(0), "Invalid investigator address");
        authorizedInvestigators[investigator] = true;
        emit InvestigatorAdded(investigator);
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

    function getEffortMetrics(uint256 bondId) external view returns (EffortMetrics[] memory) {
        return bondEffortMetrics[bondId];
    }

    function getTankingDetections(uint256 bondId) external view returns (TankingDetection[] memory) {
        return bondTankingDetection[bondId];
    }

    function getGameVerifications(uint256 bondId, uint256 gameId) external view returns (FanVerification[] memory) {
        return bondGameVerifications[bondId][gameId];
    }

    function getDistributions(uint256 bondId) external view returns (Distribution[] memory) {
        return bondDistributions[bondId];
    }
}
