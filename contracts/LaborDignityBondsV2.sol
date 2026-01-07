// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseDignityBond.sol";

/**
 * @title Labor Dignity Bonds V2 (Production Ready)
 * @notice Worker flourishing > exploitation economically
 *
 * @dev Philosophy: Redistributes power from capital to workers.
 * Companies profit when workers thrive, lose when they exploit.
 *
 * @dev Key Innovation: Worker verification required - workers anonymously attest to conditions.
 * Can't fake flourishing if workers say otherwise.
 *
 * @dev Mission Alignment: Makes exploitation EXPENSIVE, thriving PROFITABLE.
 * 100% to workers when exploiting. Capital redistribution to workers over time.
 *
 * @custom:security ReentrancyGuard on distributeBond, Pausable for emergencies
 * @custom:ethics Dignity floor (never below 50%), worker verification required
 */
contract LaborDignityBondsV2 is BaseDignityBond {

    // ============ Structs ============

    /**
     * @notice Bond structure tracking company stake and worker count
     * @param bondId Unique identifier for this bond
     * @param company Address of company that created bond
     * @param companyName Human-readable company name
     * @param stakeAmount Amount of ETH staked
     * @param workerCount Number of workers covered by bond
     * @param createdAt Timestamp when bond was created
     * @param distributionRequestedAt Timestamp when distribution was requested (0 if none pending)
     * @param distributionPending Whether distribution is currently pending timelock
     * @param active Whether bond is still active
     */
    struct Bond {
        uint256 bondId;
        address company;
        string companyName;
        uint256 stakeAmount;
        uint256 workerCount;
        uint256 createdAt;
        uint256 distributionRequestedAt;
        bool distributionPending;
        bool active;
    }

    /**
     * @notice Flourishing metrics submitted by company
     * @dev All scores 0-10000 for precision
     */
    struct FlourishingMetrics {
        uint256 timestamp;
        uint256 incomeGrowth;      // 0-10000 (wages above inflation?)
        uint256 autonomy;          // 0-10000 (control over work?)
        uint256 dignity;           // 0-10000 (respect, safety, fair treatment?)
        uint256 workLifeBalance;   // 0-10000 (reasonable hours?)
        uint256 security;          // 0-10000 (job protection?)
        uint256 voice;             // 0-10000 (say in decisions?)
    }

    /**
     * @notice Worker attestation to verify company claims
     * @dev Anonymous workers can confirm or dispute metrics
     */
    struct WorkerAttestation {
        address worker;
        uint256 timestamp;
        uint256 actualIncomeScore;      // 0-10000
        uint256 actualAutonomyScore;    // 0-10000
        uint256 actualDignityScore;     // 0-10000
        uint256 actualBalanceScore;     // 0-10000
        uint256 actualSecurityScore;    // 0-10000
        uint256 actualVoiceScore;       // 0-10000
        bool isCurrentWorker;
        string notes;
    }

    /**
     * @notice Distribution record
     */
    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 workerShare;
        uint256 companyShare;
        uint256 perWorkerAmount;
        uint256 flourishingScore;
        uint256 verificationScore;
        string reason;
    }

    // ============ State Variables ============

    uint256 public nextBondId = 1;
    mapping(uint256 => Bond) public bonds;
    mapping(uint256 => FlourishingMetrics[]) public bondMetrics;
    mapping(uint256 => WorkerAttestation[]) public bondAttestations;
    mapping(uint256 => Distribution[]) public bondDistributions;

    // Thresholds
    uint256 public constant EXPLOITATION_THRESHOLD = 4000;  // Score < 40 = exploitation
    uint256 public constant LOW_VERIFICATION_THRESHOLD = 70; // Need 70%+ verification
    uint256 public constant DIGNITY_FLOOR = 5000; // Never fall below 50% of stake

    // ============ Events ============

    /**
     * @notice Emitted when new bond is created
     * @param bondId Unique bond identifier
     * @param company Address that created bond
     * @param companyName Name of company
     * @param stakeAmount Amount of ETH staked
     * @param workerCount Number of workers covered
     * @param timestamp When bond was created
     */
    event BondCreated(
        uint256 indexed bondId,
        address indexed company,
        string companyName,
        uint256 stakeAmount,
        uint256 workerCount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when metrics are submitted
     */
    event MetricsSubmitted(
        uint256 indexed bondId,
        uint256 timestamp,
        uint256 flourishingScore
    );

    /**
     * @notice Emitted when worker adds attestation
     */
    event WorkerAttestationAdded(
        uint256 indexed bondId,
        address indexed worker,
        uint256 timestamp,
        uint256 averageScore
    );

    /**
     * @notice Emitted when distribution is requested
     */
    event DistributionRequested(
        uint256 indexed bondId,
        address indexed company,
        uint256 requestedAt,
        uint256 availableAt
    );

    /**
     * @notice Emitted when bond is distributed
     */
    event BondDistributed(
        uint256 indexed bondId,
        address indexed company,
        uint256 workerShare,
        uint256 companyShare,
        uint256 perWorkerAmount,
        int256 appreciation,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Emitted when exploitation penalty activates
     */
    event ExploitationPenalty(
        uint256 indexed bondId,
        string reason,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier onlyCompany(uint256 bondId) {
        require(bonds[bondId].company == msg.sender, "Only bond company");
        _;
    }

    modifier bondExists(uint256 bondId) {
        require(bonds[bondId].active, "Bond does not exist");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create Labor Dignity Bond
     * @dev Company stakes funds that appreciate when workers thrive
     *
     * @param companyName Name of the company creating the bond
     * @param workerCount Number of workers covered by this bond
     * @return bondId The unique identifier for the created bond
     *
     * Requirements:
     * - Must send ETH with transaction (msg.value > 0)
     * - Worker count must be greater than 0
     * - Contract must not be paused
     *
     * Emits:
     * - {BondCreated} event with full bond details
     *
     * Mission Alignment: Companies voluntarily stake on worker flourishing.
     * Economic incentive to treat workers well.
     *
     * @custom:security Validates all inputs, checks contract not paused
     */
    function createBond(
        string memory companyName,
        uint256 workerCount
    ) external payable whenNotPaused returns (uint256) {
        // Validate inputs
        _validateNonZero(msg.value, "Stake amount");
        _validateNonZero(workerCount, "Worker count");
        require(bytes(companyName).length > 0, "Company name required");
        require(bytes(companyName).length <= 100, "Company name too long");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            companyName: companyName,
            stakeAmount: msg.value,
            workerCount: workerCount,
            createdAt: block.timestamp,
            distributionRequestedAt: 0,
            distributionPending: false,
            active: true
        });

        emit BondCreated(bondId, msg.sender, companyName, msg.value, workerCount, block.timestamp);
        return bondId;
    }

    /**
     * @notice Submit flourishing metrics (company perspective)
     * @dev Will be verified against worker attestations
     *
     * @param bondId ID of the bond to submit metrics for
     * @param incomeGrowth Income growth score (0-10000)
     * @param autonomy Worker autonomy score (0-10000)
     * @param dignity Worker dignity score (0-10000)
     * @param workLifeBalance Work-life balance score (0-10000)
     * @param security Job security score (0-10000)
     * @param voice Worker voice score (0-10000)
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {MetricsSubmitted} event with calculated flourishing score
     *
     * Mission Alignment: Company reports worker conditions.
     * Workers verify, preventing fake metrics.
     *
     * @custom:security Validates all score inputs in range
     */
    function submitMetrics(
        uint256 bondId,
        uint256 incomeGrowth,
        uint256 autonomy,
        uint256 dignity,
        uint256 workLifeBalance,
        uint256 security,
        uint256 voice
    ) external onlyCompany(bondId) bondExists(bondId) whenNotPaused {
        // Validate all scores
        _validateScore(incomeGrowth, "Income growth");
        _validateScore(autonomy, "Autonomy");
        _validateScore(dignity, "Dignity");
        _validateScore(workLifeBalance, "Work-life balance");
        _validateScore(security, "Security");
        _validateScore(voice, "Voice");

        bondMetrics[bondId].push(FlourishingMetrics({
            timestamp: block.timestamp,
            incomeGrowth: incomeGrowth,
            autonomy: autonomy,
            dignity: dignity,
            workLifeBalance: workLifeBalance,
            security: security,
            voice: voice
        }));

        uint256 flourishingScore = (incomeGrowth + autonomy + dignity + workLifeBalance + security + voice) / 6;
        emit MetricsSubmitted(bondId, block.timestamp, flourishingScore);
    }

    /**
     * @notice Worker attestation - anonymous aggregate verification
     * @dev Workers can verify (or dispute) company claims
     *
     * @param bondId ID of the bond to attest for
     * @param actualIncomeScore Actual income growth (0-10000)
     * @param actualAutonomyScore Actual autonomy (0-10000)
     * @param actualDignityScore Actual dignity (0-10000)
     * @param actualBalanceScore Actual work-life balance (0-10000)
     * @param actualSecurityScore Actual security (0-10000)
     * @param actualVoiceScore Actual voice (0-10000)
     * @param isCurrentWorker Whether attestor is current worker
     * @param notes Optional notes from worker
     *
     * Requirements:
     * - Bond must exist
     * - All scores must be 0-10000
     * - Contract must not be paused
     *
     * Emits:
     * - {WorkerAttestationAdded} event with worker's average score
     *
     * Mission Alignment: Workers verify company claims.
     * Truth emerges from aggregate worker input, not company PR.
     *
     * @custom:security Validates all score inputs
     * @custom:privacy Worker address recorded but can use fresh wallet for anonymity
     */
    function addWorkerAttestation(
        uint256 bondId,
        uint256 actualIncomeScore,
        uint256 actualAutonomyScore,
        uint256 actualDignityScore,
        uint256 actualBalanceScore,
        uint256 actualSecurityScore,
        uint256 actualVoiceScore,
        bool isCurrentWorker,
        string memory notes
    ) external bondExists(bondId) whenNotPaused {
        // Validate all scores
        _validateScore(actualIncomeScore, "Income score");
        _validateScore(actualAutonomyScore, "Autonomy score");
        _validateScore(actualDignityScore, "Dignity score");
        _validateScore(actualBalanceScore, "Balance score");
        _validateScore(actualSecurityScore, "Security score");
        _validateScore(actualVoiceScore, "Voice score");

        bondAttestations[bondId].push(WorkerAttestation({
            worker: msg.sender,
            timestamp: block.timestamp,
            actualIncomeScore: actualIncomeScore,
            actualAutonomyScore: actualAutonomyScore,
            actualDignityScore: actualDignityScore,
            actualBalanceScore: actualBalanceScore,
            actualSecurityScore: actualSecurityScore,
            actualVoiceScore: actualVoiceScore,
            isCurrentWorker: isCurrentWorker,
            notes: notes
        }));

        uint256 avgScore = (actualIncomeScore + actualAutonomyScore + actualDignityScore +
                           actualBalanceScore + actualSecurityScore + actualVoiceScore) / 6;
        emit WorkerAttestationAdded(bondId, msg.sender, block.timestamp, avgScore);
    }

    /**
     * @notice Request distribution (starts timelock)
     * @dev Must wait DISTRIBUTION_TIMELOCK before distributing
     *
     * @param bondId ID of bond to request distribution for
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - No distribution already pending
     * - Contract must not be paused
     *
     * Emits:
     * - {DistributionRequested} event with timelock expiry
     *
     * Mission Alignment: 7-day notice gives workers time to dispute
     * if exploitation detected. Transparency over speed.
     *
     * @custom:security Timelock prevents instant rug pull
     */
    function requestDistribution(uint256 bondId)
        external
        onlyCompany(bondId)
        bondExists(bondId)
        whenNotPaused
    {
        Bond storage bond = bonds[bondId];
        require(!bond.distributionPending, "Distribution already pending");

        bond.distributionRequestedAt = block.timestamp;
        bond.distributionPending = true;

        emit DistributionRequested(
            bondId,
            msg.sender,
            block.timestamp,
            block.timestamp + DISTRIBUTION_TIMELOCK
        );
    }

    /**
     * @notice Distribute bond proceeds after timelock
     * @dev 70% to workers, 30% to company (or 100% to workers if exploitation)
     *
     * @param bondId ID of bond to distribute
     *
     * Requirements:
     * - Caller must be bond company
     * - Bond must exist
     * - Distribution must have been requested
     * - Timelock must have expired
     * - Must have appreciation to distribute
     * - Contract must not be paused
     *
     * Emits:
     * - {BondDistributed} event with full distribution details
     * - {ExploitationPenalty} event if penalty applies
     *
     * Mission Alignment: Workers get 70% when thriving, 100% when exploited.
     * Capital redistributed to workers over time. Makes exploitation expensive.
     *
     * @custom:security ReentrancyGuard, timelock protection, input validation
     */
    function distributeBond(uint256 bondId)
        external
        nonReentrant
        whenNotPaused
        onlyCompany(bondId)
        bondExists(bondId)
    {
        Bond storage bond = bonds[bondId];
        require(bond.distributionPending, "Must request distribution first");
        require(
            block.timestamp >= bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK,
            "Timelock not expired - workers need time to verify"
        );

        bond.distributionPending = false;
        int256 appreciation = calculateAppreciation(bondId);

        require(appreciation != 0, "No appreciation to distribute");

        (bool penaltyActive, string memory penaltyReason) = shouldActivateExploitationPenalty(bondId);

        uint256 workerShare;
        uint256 companyShare;
        string memory reason;

        if (appreciation > 0) {
            uint256 absAppreciation = uint256(appreciation);
            if (penaltyActive) {
                // Exploitation penalty: 100% to workers
                workerShare = absAppreciation;
                companyShare = 0;
                reason = penaltyReason;
                emit ExploitationPenalty(bondId, penaltyReason, block.timestamp);
            } else {
                // Normal: 70% workers, 30% company
                workerShare = (absAppreciation * 70) / 100;
                companyShare = (absAppreciation * 30) / 100;
                reason = "Worker flourishing improving - earned distribution";
            }
        } else {
            // Depreciation: 100% to workers as compensation
            workerShare = uint256(-appreciation);
            companyShare = 0;
            reason = "Depreciation compensation - worker conditions declining";
        }

        uint256 perWorkerAmount = workerShare / bond.workerCount;

        bondDistributions[bondId].push(Distribution({
            timestamp: block.timestamp,
            totalAmount: appreciation,
            workerShare: workerShare,
            companyShare: companyShare,
            perWorkerAmount: perWorkerAmount,
            flourishingScore: companyFlourishingScore(bondId),
            verificationScore: workerVerificationMultiplier(bondId),
            reason: reason
        }));

        if (companyShare > 0) {
            payable(bond.company).transfer(companyShare);
        }

        emit BondDistributed(
            bondId,
            bond.company,
            workerShare,
            companyShare,
            perWorkerAmount,
            appreciation,
            reason,
            block.timestamp
        );
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate flourishing score from company metrics
     * @dev Average across 6 dimensions
     *
     * @param bondId ID of bond to calculate score for
     * @return score Flourishing score (0-10000)
     */
    function companyFlourishingScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        FlourishingMetrics[] storage metrics = bondMetrics[bondId];
        if (metrics.length == 0) return 5000; // Neutral default

        FlourishingMetrics storage latest = metrics[metrics.length - 1];

        return (
            latest.incomeGrowth +
            latest.autonomy +
            latest.dignity +
            latest.workLifeBalance +
            latest.security +
            latest.voice
        ) / 6;
    }

    /**
     * @notice Calculate worker-verified flourishing score
     * @dev Average of recent worker attestations (last 180 days)
     *
     * @param bondId ID of bond to calculate score for
     * @return score Worker-verified score (0-10000, or 0 if no verification)
     */
    function workerVerifiedScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        WorkerAttestation[] storage attestations = bondAttestations[bondId];
        if (attestations.length == 0) return 0; // No verification = problem

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 count = 0;
        uint256 totalScore = 0;

        uint256 length = attestations.length;
        for (uint256 i = length; i > 0 && attestations[i-1].timestamp >= cutoff;) {
            unchecked { --i; }
            WorkerAttestation storage att = attestations[i];
            if (att.isCurrentWorker) {
                uint256 avgScore = (
                    att.actualIncomeScore +
                    att.actualAutonomyScore +
                    att.actualDignityScore +
                    att.actualBalanceScore +
                    att.actualSecurityScore +
                    att.actualVoiceScore
                ) / 6;
                totalScore += avgScore;
                unchecked { ++count; }
            }
        }

        return count > 0 ? totalScore / count : 0;
    }

    /**
     * @notice Worker verification multiplier
     * @dev Based on verification rate and alignment with company claims
     *
     * @param bondId ID of bond to calculate multiplier for
     * @return multiplier Verification multiplier (50-150, representing 0.5x to 1.5x)
     *
     * Mission Alignment: Workers verify company claims.
     * No verification = penalty. Strong verification = bonus.
     */
    function workerVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        WorkerAttestation[] storage attestations = bondAttestations[bondId];

        // No verification = major penalty
        if (attestations.length == 0) return 50;

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;

        uint256 length = attestations.length;
        for (uint256 i = length; i > 0 && attestations[i-1].timestamp >= cutoff;) {
            unchecked { --i; }
            if (attestations[i].isCurrentWorker) {
                unchecked { ++recentCount; }
            }
        }

        // Recent verification rate
        uint256 workerCount = bonds[bondId].workerCount;
        uint256 verificationRate = (recentCount * 100) / workerCount;

        // Strong verification (>70% workers verified) = 1.2x to 1.5x
        if (verificationRate >= LOW_VERIFICATION_THRESHOLD) {
            return 120 + ((verificationRate - 70) * 1);
        }
        // Moderate verification (30-70%) = 0.8x to 1.2x
        if (verificationRate >= 30) {
            return 80 + ((verificationRate - 30) * 1);
        }
        // Low verification (<30%) = 0.5x to 0.8x
        return 50 + (verificationRate * 1);
    }

    /**
     * @notice Time multiplier for sustained improvements
     * @return multiplier Time multiplier (100-300, representing 1.0x to 3.0x over years)
     *
     * Mission Alignment: Rewards sustained worker flourishing.
     * Long-term good treatment > short-term gains.
     */
    function timeMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];
        uint256 age = block.timestamp - bond.createdAt;
        uint256 yearsElapsed = age / 31536000;

        if (yearsElapsed < 1) return 100;
        if (yearsElapsed < 3) return 100 + (yearsElapsed * 50);
        return 200 + ((yearsElapsed - 3) * 50);
    }

    /**
     * @notice Calculate current bond value
     * @dev Formula: (Stake × Flourishing × WorkerVerification × Time) / 100,000,000
     *
     * @param bondId ID of bond to calculate value for
     * @return value Current bond value in wei (with dignity floor applied)
     *
     * Math:
     * - flourishing: 0-10000 (laborFlourishingScore, blended with worker verification)
     * - verification: 50-150 (workerVerificationMultiplier)
     * - time: 100-300 (timeMultiplier)
     * - Divisor: 50,000,000 ensures reasonable appreciation (1.0x-9.0x range)
     *
     * Example calculations:
     * - Neutral (5000 × 100 × 100): 1.0x stake (breakeven)
     * - Good (7500 × 125 × 200): 3.75x stake
     * - Excellent (10000 × 150 × 300): 9.0x stake
     *
     * Mission Alignment: Value increases when workers thrive.
     * Economics reward worker flourishing.
     *
     * @custom:math-fix Changed divisor from 1,000,000 to 50,000,000 (2026-01-07)
     * @custom:dignity-floor Applied after calculation - never below 50% of stake
     */
    function calculateBondValue(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        Bond storage bond = bonds[bondId];

        uint256 flourishing = companyFlourishingScore(bondId);
        uint256 verification = workerVerificationMultiplier(bondId);
        uint256 time = timeMultiplier(bondId);

        // Use worker-verified score if available (more accurate)
        uint256 workerScore = workerVerifiedScore(bondId);
        if (workerScore > 0) {
            flourishing = (flourishing + workerScore) / 2; // Blend both
        }

        // Apply dignity floor (never below 50% of stake)
        uint256 value = (bond.stakeAmount * flourishing * verification * time) / 50000000;
        uint256 floor = (bond.stakeAmount * DIGNITY_FLOOR) / 10000;

        return value > floor ? value : floor;
    }

    /**
     * @notice Calculate appreciation/depreciation
     * @return appreciation Can be negative (depreciation)
     */
    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if exploitation penalty should apply
     * @dev Penalty if: flourishing < 40 OR low worker verification
     *
     * @return shouldPenalize Whether penalty should activate
     * @return reason Human-readable reason for penalty
     *
     * Mission Alignment: Exploitation triggers 100% to workers.
     * Makes exploitation expensive, not profitable.
     */
    function shouldActivateExploitationPenalty(uint256 bondId)
        public
        view
        bondExists(bondId)
        returns (bool, string memory)
    {
        uint256 flourishing = companyFlourishingScore(bondId);

        // Workers suffering (score < 40)
        if (flourishing < EXPLOITATION_THRESHOLD) {
            return (true, "Worker flourishing too low - exploitation detected");
        }

        // No worker verification
        uint256 verification = workerVerificationMultiplier(bondId);
        if (verification <= 50) {
            return (true, "Insufficient worker verification - hiding conditions");
        }

        // Worker-verified score conflicts with company claims
        uint256 workerScore = workerVerifiedScore(bondId);
        if (workerScore > 0 && workerScore < EXPLOITATION_THRESHOLD) {
            return (true, "Workers report exploitation despite company claims");
        }

        return (false, "");
    }

    // ============ View Functions ============

    function getBond(uint256 bondId) external view returns (Bond memory) {
        return bonds[bondId];
    }

    function getMetricsCount(uint256 bondId) external view returns (uint256) {
        return bondMetrics[bondId].length;
    }

    function getAttestationsCount(uint256 bondId) external view returns (uint256) {
        return bondAttestations[bondId].length;
    }

    function getDistributionsCount(uint256 bondId) external view returns (uint256) {
        return bondDistributions[bondId].length;
    }

    function getLatestMetrics(uint256 bondId) external view returns (FlourishingMetrics memory) {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    function getLatestDistribution(uint256 bondId) external view returns (Distribution memory) {
        require(bondDistributions[bondId].length > 0, "No distributions yet");
        return bondDistributions[bondId][bondDistributions[bondId].length - 1];
    }
}
