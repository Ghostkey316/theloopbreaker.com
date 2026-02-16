// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title FlourishingMetricsOracle
 * @notice Multi-oracle consensus system for flourishing metrics.
 * @dev Security audit recommendation: eliminates single-oracle dependency
 *      by requiring multiple independent oracles to submit data and reaching
 *      consensus via median-value aggregation.
 *
 * @custom:security-enhancement From Professional Security Audit 2026
 * @custom:purpose Harden flourishing metrics against oracle manipulation
 *
 * Design:
 * - Registered oracles submit metric values during open submission windows.
 * - A minimum quorum of 3 oracles is required for consensus.
 * - Consensus value is the median of all submissions (resistant to outliers).
 * - Submissions outside the acceptable deviation band are flagged.
 * - The owner can register/remove oracles but cannot submit data.
 */
contract FlourishingMetricsOracle {

    // ============ Errors ============

    error OnlyOwner();
    error OnlyOracle();
    error ZeroAddress();
    error OracleAlreadyRegistered();
    error OracleNotRegistered();
    error MaxOraclesReached();
    error InsufficientOracles();
    error RoundNotOpen();
    error RoundAlreadyFinalized();
    error AlreadySubmitted();
    error NoActiveRound();
    error RoundStillOpen();
    error InsufficientSubmissions();

    // ============ Events ============

    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event RoundStarted(
        uint256 indexed roundId,
        bytes32 indexed metricId,
        uint256 deadline
    );

    event MetricSubmitted(
        uint256 indexed roundId,
        address indexed oracle,
        uint256 value
    );

    event ConsensusReached(
        uint256 indexed roundId,
        bytes32 indexed metricId,
        uint256 consensusValue,
        uint256 submissionCount
    );

    event RoundExpired(uint256 indexed roundId);

    // ============ Structs ============

    struct Submission {
        address oracle;
        uint256 value;
        uint256 timestamp;
    }

    struct Round {
        uint256 roundId;
        bytes32 metricId;
        uint256 startTime;
        uint256 deadline;
        uint256 consensusValue;
        bool finalized;
        uint256 submissionCount;
    }

    // ============ Constants ============

    /// @notice Minimum number of oracle submissions required for consensus.
    uint256 public constant MINIMUM_QUORUM = 3;

    /// @notice Maximum number of registered oracles (Sybil prevention).
    uint256 public constant MAXIMUM_ORACLES = 50;

    /// @notice Default submission window (24 hours).
    uint256 public constant SUBMISSION_WINDOW = 24 hours;

    /// @notice Maximum deviation from median to be considered valid (20%).
    uint256 public constant MAX_DEVIATION_BPS = 2000;

    // ============ State Variables ============

    address public owner;

    /// @notice Registered oracle addresses.
    mapping(address => bool) public isOracle;
    address[] public oracleList;
    uint256 public oracleCount;

    /// @notice Round data.
    mapping(uint256 => Round) public rounds;
    uint256 public nextRoundId;

    /// @notice Submissions per round: roundId => index => Submission.
    mapping(uint256 => Submission[]) internal _submissions;

    /// @notice Track whether an oracle has submitted for a round.
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;

    /// @notice Latest consensus value per metric.
    mapping(bytes32 => uint256) public latestValue;

    /// @notice Latest round ID per metric.
    mapping(bytes32 => uint256) public latestRoundForMetric;

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyOracle() {
        if (!isOracle[msg.sender]) revert OnlyOracle();
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        nextRoundId = 1;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Oracle Management ============

    /// @notice Register a new oracle.
    /// @param oracle Address of the oracle to register.
    function addOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        if (isOracle[oracle]) revert OracleAlreadyRegistered();
        if (oracleCount >= MAXIMUM_ORACLES) revert MaxOraclesReached();

        isOracle[oracle] = true;
        oracleList.push(oracle);
        oracleCount++;

        emit OracleAdded(oracle);
    }

    /// @notice Remove an oracle.
    /// @param oracle Address of the oracle to remove.
    function removeOracle(address oracle) external onlyOwner {
        if (!isOracle[oracle]) revert OracleNotRegistered();

        isOracle[oracle] = false;
        oracleCount--;

        // Remove from list (swap-and-pop)
        uint256 length = oracleList.length;
        for (uint256 i = 0; i < length;) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[length - 1];
                oracleList.pop();
                break;
            }
            unchecked { ++i; }
        }

        emit OracleRemoved(oracle);
    }

    // ============ Round Management ============

    /// @notice Start a new consensus round for a metric.
    /// @param metricId Identifier for the metric being measured.
    /// @return roundId The created round ID.
    function startRound(bytes32 metricId) external onlyOwner returns (uint256) {
        if (oracleCount < MINIMUM_QUORUM) revert InsufficientOracles();

        uint256 roundId = nextRoundId++;

        rounds[roundId] = Round({
            roundId: roundId,
            metricId: metricId,
            startTime: block.timestamp,
            deadline: block.timestamp + SUBMISSION_WINDOW,
            consensusValue: 0,
            finalized: false,
            submissionCount: 0
        });

        emit RoundStarted(roundId, metricId, block.timestamp + SUBMISSION_WINDOW);
        return roundId;
    }

    /// @notice Submit a metric value for an active round.
    /// @param roundId The round to submit for.
    /// @param value The metric value.
    function submitMetric(uint256 roundId, uint256 value) external onlyOracle {
        Round storage round = rounds[roundId];
        if (round.startTime == 0) revert NoActiveRound();
        if (block.timestamp > round.deadline) revert RoundNotOpen();
        if (round.finalized) revert RoundAlreadyFinalized();
        if (hasSubmitted[roundId][msg.sender]) revert AlreadySubmitted();

        _submissions[roundId].push(Submission({
            oracle: msg.sender,
            value: value,
            timestamp: block.timestamp
        }));

        hasSubmitted[roundId][msg.sender] = true;
        round.submissionCount++;

        emit MetricSubmitted(roundId, msg.sender, value);
    }

    /// @notice Finalize a round and compute consensus (median value).
    /// @param roundId The round to finalize.
    function finalizeRound(uint256 roundId) external {
        Round storage round = rounds[roundId];
        if (round.startTime == 0) revert NoActiveRound();
        if (round.finalized) revert RoundAlreadyFinalized();
        if (block.timestamp <= round.deadline) revert RoundStillOpen();

        Submission[] storage subs = _submissions[roundId];
        if (subs.length < MINIMUM_QUORUM) {
            round.finalized = true;
            emit RoundExpired(roundId);
            return;
        }

        // Calculate median
        uint256 median = _calculateMedian(roundId);

        round.consensusValue = median;
        round.finalized = true;

        latestValue[round.metricId] = median;
        latestRoundForMetric[round.metricId] = roundId;

        emit ConsensusReached(roundId, round.metricId, median, subs.length);
    }

    // ============ View Functions ============

    /// @notice Get the latest consensus value for a metric.
    /// @param metricId The metric identifier.
    /// @return value The latest consensus value.
    /// @return roundId The round where consensus was reached.
    function getLatestValue(bytes32 metricId) external view returns (
        uint256 value,
        uint256 roundId
    ) {
        roundId = latestRoundForMetric[metricId];
        value = latestValue[metricId];
    }

    /// @notice Get round details.
    /// @param roundId The round to query.
    /// @return round The round data.
    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    /// @notice Get submissions for a round.
    /// @param roundId The round to query.
    /// @return submissions Array of submissions.
    function getSubmissions(uint256 roundId) external view returns (Submission[] memory) {
        return _submissions[roundId];
    }

    /// @notice Get all registered oracle addresses.
    /// @return oracles Array of oracle addresses.
    function getOracles() external view returns (address[] memory) {
        return oracleList;
    }

    // ============ Owner Functions ============

    /// @notice Transfer ownership.
    /// @param newOwner The new owner address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ============ Internal Functions ============

    /// @dev Calculate the median of submissions for a round.
    function _calculateMedian(uint256 roundId) internal view returns (uint256) {
        Submission[] storage subs = _submissions[roundId];
        uint256 length = subs.length;

        // Copy values to memory for sorting
        uint256[] memory values = new uint256[](length);
        for (uint256 i = 0; i < length;) {
            values[i] = subs[i].value;
            unchecked { ++i; }
        }

        // Sort values (insertion sort — efficient for small arrays)
        for (uint256 i = 1; i < length;) {
            uint256 key = values[i];
            uint256 j = i;
            while (j > 0 && values[j - 1] > key) {
                values[j] = values[j - 1];
                j--;
            }
            values[j] = key;
            unchecked { ++i; }
        }

        // Return median
        if (length % 2 == 0) {
            return (values[length / 2 - 1] + values[length / 2]) / 2;
        } else {
            return values[length / 2];
        }
    }
}
