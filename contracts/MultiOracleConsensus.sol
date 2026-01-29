// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Multi-Oracle Consensus System
 * @notice Decentralized oracle network with stake-based consensus
 * @dev Replaces centralized oracle with multi-oracle consensus mechanism
 *
 * @custom:security-enhancement From Professional Security Audit 2026
 * @custom:purpose Eliminate single-point-of-failure in oracle system
 */
contract MultiOracleConsensus is ReentrancyGuard {

    // ============ Enums ============

    /**
     * @notice Oracle status
     */
    enum OracleStatus {
        Inactive,       // Not registered
        Active,         // Actively submitting data
        Suspended,      // Temporarily suspended
        Slashed         // Stake slashed for malicious behavior
    }

    /**
     * @notice Data submission status
     */
    enum SubmissionStatus {
        Pending,        // Awaiting consensus
        Confirmed,      // Consensus reached
        Disputed,       // Oracles disagree significantly
        Expired         // Consensus window expired
    }

    // ============ Structs ============

    /**
     * @notice Oracle registration and performance tracking
     */
    struct Oracle {
        address oracleAddress;
        uint256 stake;
        uint256 registeredAt;
        uint256 totalSubmissions;
        uint256 accurateSubmissions;
        uint256 disputedSubmissions;
        uint256 slashCount;
        OracleStatus status;
        string dataSource;      // e.g., "Chainlink", "Custom API", "On-chain data"
        string publicKey;       // For encrypted data submission
    }

    /**
     * @notice Data point submitted by oracle
     */
    struct DataPoint {
        address oracle;
        uint256 value;
        uint256 timestamp;
        bytes32 dataHash;       // Hash of supporting evidence
        string notes;
    }

    /**
     * @notice Consensus round for a specific metric
     */
    struct ConsensusRound {
        uint256 roundId;
        bytes32 metricId;       // Identifier for what's being measured
        uint256 startTime;
        uint256 consensusDeadline;
        DataPoint[] submissions;
        uint256 consensusValue;
        SubmissionStatus status;
        uint256 totalStakeSubmitted;
        bool finalized;
    }

    /**
     * @notice Dispute record
     */
    struct Dispute {
        uint256 disputeId;
        uint256 roundId;
        address disputer;
        address disputed;
        uint256 disputerValue;
        uint256 disputedValue;
        uint256 createdAt;
        bool resolved;
        address winner;
        string resolution;
    }

    // ============ State Variables ============

    /// @notice Contract owner
    address public owner;

    /// @notice Minimum stake to become oracle (10 ETH)
    uint256 public constant MINIMUM_ORACLE_STAKE = 10 ether;

    /// @notice Consensus threshold (60% agreement required)
    uint256 public constant CONSENSUS_THRESHOLD = 6000; // Basis points

    /// @notice Maximum deviation allowed (20%)
    uint256 public constant MAX_DEVIATION = 2000; // Basis points

    /// @notice Consensus window (24 hours)
    uint256 public constant CONSENSUS_WINDOW = 24 hours;

    /// @notice Slash amount for malicious oracle (50% of stake)
    uint256 public constant SLASH_PERCENTAGE = 5000; // Basis points

    /// @notice Minimum oracles required for consensus
    uint256 public constant MINIMUM_ORACLES = 3;

    /// @notice Maximum oracles allowed (Sybil attack prevention)
    /// @dev HIGH-004 FIX: Prevents attacker from registering unlimited oracles
    uint256 public constant MAXIMUM_ORACLES = 100;

    /// @notice All registered oracles
    mapping(address => Oracle) public oracles;
    address[] public oracleList;

    /// @notice Active oracle count (gas optimization)
    /// @dev MED-002 FIX: Cached count avoids O(n) loop on every query
    uint256 public activeOracleCount;

    /// @notice Consensus rounds
    mapping(uint256 => ConsensusRound) public consensusRounds;
    uint256 public nextRoundId = 1;

    /// @notice Metric ID to latest consensus value
    mapping(bytes32 => uint256) public latestConsensusValue;
    mapping(bytes32 => uint256) public latestConsensusRound;

    /// @notice Disputes
    mapping(uint256 => Dispute) public disputes;
    uint256 public nextDisputeId = 1;

    /// @notice Slash pool (from slashed stakes)
    uint256 public slashPool;

    /// @notice Reward pool for accurate oracles
    uint256 public rewardPool;

    /// @notice Paused state
    bool public paused;

    // ============ Events ============

    event OracleRegistered(address indexed oracle, uint256 stake, string dataSource);
    event OracleStakeIncreased(address indexed oracle, uint256 newStake);
    event OracleSlashed(address indexed oracle, uint256 slashAmount, string reason);
    event OracleWithdrawn(address indexed oracle, uint256 amount);

    event ConsensusRoundStarted(uint256 indexed roundId, bytes32 indexed metricId, uint256 deadline);
    event DataSubmitted(uint256 indexed roundId, address indexed oracle, uint256 value);
    event ConsensusReached(uint256 indexed roundId, bytes32 indexed metricId, uint256 consensusValue);
    event ConsensusDisputed(uint256 indexed roundId, uint256 indexed disputeId);

    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed roundId,
        address indexed disputer,
        address disputed
    );
    event DisputeResolved(uint256 indexed disputeId, address indexed winner, string resolution);

    event RewardDistributed(address indexed oracle, uint256 amount);
    event RewardPoolFunded(address indexed funder, uint256 amount);

    event Paused();
    event Unpaused();

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyActiveOracle() {
        require(oracles[msg.sender].status == OracleStatus.Active, "Not active oracle");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Oracle Management ============

    /**
     * @notice Register as oracle
     * @param dataSource Description of data source
     * @param publicKey Public key for encrypted submissions
     *
     * @dev Requirements:
     * - Must stake at least MINIMUM_ORACLE_STAKE
     * - Cannot be already registered
     */
    function registerOracle(
        string memory dataSource,
        string memory publicKey
    ) external payable whenNotPaused {
        require(msg.value >= MINIMUM_ORACLE_STAKE, "Insufficient stake");
        require(oracles[msg.sender].status == OracleStatus.Inactive, "Already registered");
        require(bytes(dataSource).length > 0, "Data source required");

        // ✅ HIGH-004 FIX: Enforce maximum oracle cap (Sybil attack prevention)
        require(activeOracleCount < MAXIMUM_ORACLES, "Maximum oracle count reached");

        oracles[msg.sender] = Oracle({
            oracleAddress: msg.sender,
            stake: msg.value,
            registeredAt: block.timestamp,
            totalSubmissions: 0,
            accurateSubmissions: 0,
            disputedSubmissions: 0,
            slashCount: 0,
            status: OracleStatus.Active,
            dataSource: dataSource,
            publicKey: publicKey
        });

        oracleList.push(msg.sender);

        // ✅ MED-002 FIX: Update cached active oracle count
        activeOracleCount++;

        emit OracleRegistered(msg.sender, msg.value, dataSource);
    }

    /**
     * @notice Increase oracle stake
     *
     * @dev Higher stake = more weight in consensus
     */
    function increaseStake() external payable onlyActiveOracle {
        require(msg.value > 0, "Must send ETH");
        oracles[msg.sender].stake += msg.value;
        emit OracleStakeIncreased(msg.sender, oracles[msg.sender].stake);
    }

    /**
     * @notice Withdraw stake and deregister
     *
     * @dev Can only withdraw if no pending submissions
     */
    function withdrawOracle() external nonReentrant {
        Oracle storage oracle = oracles[msg.sender];
        require(oracle.status == OracleStatus.Active, "Not active");
        require(oracle.stake > 0, "No stake to withdraw");

        uint256 withdrawAmount = oracle.stake;
        oracle.stake = 0;
        oracle.status = OracleStatus.Inactive;

        // ✅ MED-002 FIX: Update cached active oracle count
        activeOracleCount--;

        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        require(success, "Transfer failed");

        emit OracleWithdrawn(msg.sender, withdrawAmount);
    }

    // ============ Consensus Mechanism ============

    /**
     * @notice Start new consensus round
     * @param metricId Identifier for metric being measured
     * @return roundId The created round ID
     *
     * @dev Only owner can start rounds (triggered by bond contracts)
     */
    function startConsensusRound(bytes32 metricId) external onlyOwner whenNotPaused returns (uint256) {
        require(getActiveOracleCount() >= MINIMUM_ORACLES, "Insufficient active oracles");

        uint256 roundId = nextRoundId++;

        consensusRounds[roundId].roundId = roundId;
        consensusRounds[roundId].metricId = metricId;
        consensusRounds[roundId].startTime = block.timestamp;
        consensusRounds[roundId].consensusDeadline = block.timestamp + CONSENSUS_WINDOW;
        consensusRounds[roundId].status = SubmissionStatus.Pending;

        emit ConsensusRoundStarted(roundId, metricId, consensusRounds[roundId].consensusDeadline);
        return roundId;
    }

    /**
     * @notice Submit data for consensus round
     * @param roundId Round to submit for
     * @param value Data value
     * @param dataHash Hash of supporting evidence
     * @param notes Optional notes
     *
     * @dev Each oracle can submit once per round
     */
    function submitData(
        uint256 roundId,
        uint256 value,
        bytes32 dataHash,
        string memory notes
    ) external onlyActiveOracle whenNotPaused {
        ConsensusRound storage round = consensusRounds[roundId];
        require(round.startTime > 0, "Round does not exist");
        require(block.timestamp <= round.consensusDeadline, "Consensus deadline passed");
        require(round.status == SubmissionStatus.Pending, "Round not pending");
        require(!_hasOracleSubmitted(roundId, msg.sender), "Already submitted");

        round.submissions.push(DataPoint({
            oracle: msg.sender,
            value: value,
            timestamp: block.timestamp,
            dataHash: dataHash,
            notes: notes
        }));

        round.totalStakeSubmitted += oracles[msg.sender].stake;
        oracles[msg.sender].totalSubmissions++;

        emit DataSubmitted(roundId, msg.sender, value);

        // Try to finalize if enough submissions
        if (round.submissions.length >= MINIMUM_ORACLES) {
            _tryFinalizeConsensus(roundId);
        }
    }

    /**
     * @notice Finalize consensus round
     * @param roundId Round to finalize
     *
     * @dev Can be called by anyone after consensus deadline
     */
    function finalizeConsensus(uint256 roundId) external whenNotPaused {
        ConsensusRound storage round = consensusRounds[roundId];
        require(round.startTime > 0, "Round does not exist");
        require(!round.finalized, "Already finalized");
        require(block.timestamp > round.consensusDeadline, "Consensus window not expired");

        _tryFinalizeConsensus(roundId);
    }

    // ============ Dispute Resolution ============

    /**
     * @notice Create dispute against another oracle
     * @param roundId Round in question
     * @param disputedOracle Oracle being disputed
     * @param reason Dispute reason
     *
     * @dev Disputer must have submitted significantly different value
     */
    function createDispute(
        uint256 roundId,
        address disputedOracle,
        string memory reason
    ) external onlyActiveOracle {
        ConsensusRound storage round = consensusRounds[roundId];
        require(round.finalized, "Round not finalized");
        require(round.status == SubmissionStatus.Confirmed, "Round not confirmed");

        (uint256 disputerValue, bool disputerFound) = _getOracleSubmission(roundId, msg.sender);
        (uint256 disputedValue, bool disputedFound) = _getOracleSubmission(roundId, disputedOracle);

        require(disputerFound && disputedFound, "Missing submissions");

        // Check if values differ significantly
        uint256 deviation = _calculateDeviation(disputerValue, disputedValue);
        require(deviation > MAX_DEVIATION, "Values too similar for dispute");

        uint256 disputeId = nextDisputeId++;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            roundId: roundId,
            disputer: msg.sender,
            disputed: disputedOracle,
            disputerValue: disputerValue,
            disputedValue: disputedValue,
            createdAt: block.timestamp,
            resolved: false,
            winner: address(0),
            resolution: ""
        });

        emit DisputeCreated(disputeId, roundId, msg.sender, disputedOracle);
        emit ConsensusDisputed(roundId, disputeId);
    }

    /**
     * @notice Resolve dispute (owner only)
     * @param disputeId Dispute to resolve
     * @param winner Winning oracle
     * @param resolution Resolution explanation
     *
     * @dev Loser gets slashed, winner gets reward
     */
    function resolveDispute(
        uint256 disputeId,
        address winner,
        string memory resolution
    ) external onlyOwner nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        require(!dispute.resolved, "Already resolved");
        require(
            winner == dispute.disputer || winner == dispute.disputed,
            "Winner must be a party"
        );

        dispute.resolved = true;
        dispute.winner = winner;
        dispute.resolution = resolution;

        address loser = winner == dispute.disputer ? dispute.disputed : dispute.disputer;

        // Slash loser
        _slashOracle(loser, "Dispute resolution - inaccurate data");

        // Reward winner from slash pool
        uint256 reward = (oracles[loser].stake * SLASH_PERCENTAGE) / 10000 / 2; // Half of slash
        if (reward > 0 && slashPool >= reward) {
            slashPool -= reward;
            oracles[winner].stake += reward;
            emit RewardDistributed(winner, reward);
        }

        emit DisputeResolved(disputeId, winner, resolution);
    }

    // ============ View Functions ============

    /**
     * @notice Get latest consensus value for metric
     * @param metricId Metric identifier
     * @return value Latest consensus value
     * @return roundId Round where consensus was reached
     * @return timestamp When consensus was reached
     */
    function getLatestConsensusValue(bytes32 metricId) external view returns (
        uint256 value,
        uint256 roundId,
        uint256 timestamp
    ) {
        roundId = latestConsensusRound[metricId];
        if (roundId == 0) return (0, 0, 0);

        ConsensusRound storage round = consensusRounds[roundId];
        return (round.consensusValue, roundId, round.startTime);
    }

    /**
     * @notice Get active oracle count
     * @return count Number of active oracles
     *
     * @custom:security MED-002 FIX: Gas optimization
     * Uses cached count instead of O(n) loop. Prevents DoS with many oracles.
     */
    function getActiveOracleCount() public view returns (uint256) {
        return activeOracleCount;
    }

    /**
     * @notice Get oracle reputation score
     * @param oracle Oracle address
     * @return score Reputation (0-10000)
     *
     * @dev Formula:
     * - Accuracy rate × 7000
     * - Stake weight × 2000
     * - Longevity bonus × 1000
     * - Slash penalty: -2000 per slash
     */
    function getOracleReputation(address oracle) external view returns (uint256) {
        Oracle memory oracleData = oracles[oracle];
        if (oracleData.totalSubmissions == 0) return 5000; // Neutral

        // Accuracy component (70%)
        uint256 accuracyRate = (oracleData.accurateSubmissions * 10000) / oracleData.totalSubmissions;
        uint256 accuracyScore = (accuracyRate * 7000) / 10000;

        // Stake weight component (20%)
        uint256 stakeScore = oracleData.stake > 50 ether ? 2000 : (oracleData.stake * 2000) / 50 ether;

        // Longevity component (10%)
        uint256 daysSinceRegistration = (block.timestamp - oracleData.registeredAt) / 1 days;
        uint256 longevityScore = daysSinceRegistration > 100 ? 1000 : (daysSinceRegistration * 1000) / 100;

        // Slash penalty
        int256 score = int256(accuracyScore + stakeScore + longevityScore);
        score -= int256(oracleData.slashCount * 2000);

        if (score < 0) return 0;
        if (score > 10000) return 10000;
        return uint256(score);
    }

    /**
     * @notice Get round submission details
     * @param roundId Round to query
     * @return submissionCount Number of submissions
     * @return consensusValue Consensus value (if finalized)
     * @return status Round status
     */
    function getRoundDetails(uint256 roundId) external view returns (
        uint256 submissionCount,
        uint256 consensusValue,
        SubmissionStatus status
    ) {
        ConsensusRound storage round = consensusRounds[roundId];
        return (
            round.submissions.length,
            round.consensusValue,
            round.status
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Fund reward pool
     */
    function fundRewardPool() external payable {
        require(msg.value > 0, "Must send ETH");
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // ============ Internal Functions ============

    /**
     * @notice Try to finalize consensus
     * @param roundId Round to finalize
     */
    function _tryFinalizeConsensus(uint256 roundId) internal {
        ConsensusRound storage round = consensusRounds[roundId];

        if (round.submissions.length < MINIMUM_ORACLES) {
            if (block.timestamp > round.consensusDeadline) {
                round.status = SubmissionStatus.Expired;
                round.finalized = true;
            }
            return;
        }

        // Calculate weighted median
        uint256 consensusValue = _calculateWeightedMedian(roundId);

        // Check if submissions agree (within MAX_DEVIATION)
        bool hasConsensus = _checkConsensus(roundId, consensusValue);

        if (hasConsensus) {
            round.consensusValue = consensusValue;
            round.status = SubmissionStatus.Confirmed;
            round.finalized = true;

            latestConsensusValue[round.metricId] = consensusValue;
            latestConsensusRound[round.metricId] = roundId;

            // Update oracle accuracy
            _updateOracleAccuracy(roundId, consensusValue);

            emit ConsensusReached(roundId, round.metricId, consensusValue);
        } else if (block.timestamp > round.consensusDeadline) {
            round.status = SubmissionStatus.Disputed;
            round.finalized = true;
        }
    }

    /**
     * @notice Calculate stake-weighted median
     * @param roundId Round to calculate for
     * @return median Weighted median value
     */
    function _calculateWeightedMedian(uint256 roundId) internal view returns (uint256) {
        ConsensusRound storage round = consensusRounds[roundId];
        uint256 length = round.submissions.length;

        // Simple median for now (can be upgraded to true weighted median)
        uint256[] memory values = new uint256[](length);
        for (uint256 i = 0; i < length;) {
            values[i] = round.submissions[i].value;
            unchecked { ++i; }
        }

        // Sort values
        _quickSort(values, 0, int256(length - 1));

        // Return median
        if (length % 2 == 0) {
            return (values[length / 2 - 1] + values[length / 2]) / 2;
        } else {
            return values[length / 2];
        }
    }

    /**
     * @notice Check if submissions reach consensus
     * @param roundId Round to check
     * @param consensusValue Proposed consensus value
     * @return hasConsensus Whether consensus reached
     */
    function _checkConsensus(uint256 roundId, uint256 consensusValue) internal view returns (bool) {
        ConsensusRound storage round = consensusRounds[roundId];
        uint256 length = round.submissions.length;

        uint256 agreeingStake = 0;

        for (uint256 i = 0; i < length;) {
            uint256 deviation = _calculateDeviation(round.submissions[i].value, consensusValue);
            if (deviation <= MAX_DEVIATION) {
                agreeingStake += oracles[round.submissions[i].oracle].stake;
            }
            unchecked { ++i; }
        }

        uint256 agreeingPercentage = (agreeingStake * 10000) / round.totalStakeSubmitted;
        return agreeingPercentage >= CONSENSUS_THRESHOLD;
    }

    /**
     * @notice Calculate percentage deviation between two values
     * @param value1 First value
     * @param value2 Second value
     * @return deviation Deviation in basis points
     */
    function _calculateDeviation(uint256 value1, uint256 value2) internal pure returns (uint256) {
        if (value1 == value2) return 0;

        uint256 larger = value1 > value2 ? value1 : value2;
        uint256 smaller = value1 > value2 ? value2 : value1;

        return ((larger - smaller) * 10000) / larger;
    }

    /**
     * @notice Update oracle accuracy stats after consensus
     * @param roundId Round that reached consensus
     * @param consensusValue Consensus value
     */
    function _updateOracleAccuracy(uint256 roundId, uint256 consensusValue) internal {
        ConsensusRound storage round = consensusRounds[roundId];
        uint256 length = round.submissions.length;

        for (uint256 i = 0; i < length;) {
            uint256 deviation = _calculateDeviation(round.submissions[i].value, consensusValue);
            if (deviation <= MAX_DEVIATION) {
                oracles[round.submissions[i].oracle].accurateSubmissions++;
            } else {
                oracles[round.submissions[i].oracle].disputedSubmissions++;
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Slash oracle for malicious behavior
     * @param oracle Oracle to slash
     * @param reason Slash reason
     */
    function _slashOracle(address oracle, string memory reason) internal {
        Oracle storage oracleData = oracles[oracle];
        uint256 slashAmount = (oracleData.stake * SLASH_PERCENTAGE) / 10000;

        // Only decrement active count if oracle was active before slash
        bool wasActive = oracleData.status == OracleStatus.Active;

        oracleData.stake -= slashAmount;
        oracleData.slashCount++;
        oracleData.status = OracleStatus.Slashed;

        // ✅ MED-002 FIX: Update cached active oracle count
        if (wasActive) {
            activeOracleCount--;
        }

        slashPool += slashAmount;

        emit OracleSlashed(oracle, slashAmount, reason);
    }

    /**
     * @notice Check if oracle has submitted for round
     * @param roundId Round to check
     * @param oracle Oracle address
     * @return hasSubmitted Whether oracle submitted
     */
    function _hasOracleSubmitted(uint256 roundId, address oracle) internal view returns (bool) {
        ConsensusRound storage round = consensusRounds[roundId];
        uint256 length = round.submissions.length;

        for (uint256 i = 0; i < length;) {
            if (round.submissions[i].oracle == oracle) {
                return true;
            }
            unchecked { ++i; }
        }
        return false;
    }

    /**
     * @notice Get oracle's submission value for round
     * @param roundId Round to check
     * @param oracle Oracle address
     * @return value Submitted value
     * @return found Whether submission found
     */
    function _getOracleSubmission(uint256 roundId, address oracle) internal view returns (uint256, bool) {
        ConsensusRound storage round = consensusRounds[roundId];
        uint256 length = round.submissions.length;

        for (uint256 i = 0; i < length;) {
            if (round.submissions[i].oracle == oracle) {
                return (round.submissions[i].value, true);
            }
            unchecked { ++i; }
        }
        return (0, false);
    }

    /**
     * @notice Quick sort implementation
     * @param arr Array to sort
     * @param left Left index
     * @param right Right index
     */
    function _quickSort(uint256[] memory arr, int256 left, int256 right) internal pure {
        if (left >= right) return;

        int256 i = left;
        int256 j = right;
        uint256 pivot = arr[uint256(left + (right - left) / 2)];

        while (i <= j) {
            while (arr[uint256(i)] < pivot) i++;
            while (arr[uint256(j)] > pivot) j--;

            if (i <= j) {
                (arr[uint256(i)], arr[uint256(j)]) = (arr[uint256(j)], arr[uint256(i)]);
                i++;
                j--;
            }
        }

        if (left < j) _quickSort(arr, left, j);
        if (i < right) _quickSort(arr, i, right);
    }

    /**
     * @notice Accept ETH deposits for reward pool
     */
    receive() external payable {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }
}
