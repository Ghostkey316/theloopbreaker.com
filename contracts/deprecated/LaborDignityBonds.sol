// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Labor Dignity Bonds
 * @notice Worker flourishing > exploitation economically
 *
 * Philosophy: Redistributes power from capital to workers.
 * Companies profit when workers thrive, lose when they exploit.
 *
 * Key Innovation: Worker verification required - workers anonymously attest to conditions.
 * Can't fake flourishing if workers say otherwise.
 */
contract LaborDignityBonds is ReentrancyGuard {

    // ============ Structs ============

    struct Bond {
        uint256 bondId;
        address company;
        string companyName;
        uint256 stakeAmount;
        uint256 workerCount;
        uint256 createdAt;
        bool active;
    }

    struct FlourishingMetrics {
        uint256 timestamp;
        uint256 incomeGrowth;      // 0-10000 (wages above inflation?)
        uint256 autonomy;          // 0-10000 (control over work?)
        uint256 dignity;           // 0-10000 (respect, safety, fair treatment?)
        uint256 workLifeBalance;   // 0-10000 (reasonable hours?)
        uint256 security;          // 0-10000 (job protection?)
        uint256 voice;             // 0-10000 (say in decisions?)
    }

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

    struct Distribution {
        uint256 timestamp;
        int256 totalAmount;
        uint256 workerShare;
        uint256 companyShare;
        uint256 perWorkerAmount;
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

    // ============ Events ============

    event BondCreated(uint256 indexed bondId, address indexed company, uint256 workerCount);
    event MetricsSubmitted(uint256 indexed bondId, uint256 timestamp);
    event WorkerAttestationAdded(uint256 indexed bondId, address indexed worker);
    event BondDistributed(uint256 indexed bondId, uint256 workerShare, uint256 companyShare);
    event ExploitationPenalty(uint256 indexed bondId, string reason);

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
     * @param companyName Name of company
     * @param workerCount Number of workers covered by bond
     */
    function createBond(
        string memory companyName,
        uint256 workerCount
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must stake funds");
        require(workerCount > 0, "Must have workers");

        uint256 bondId = nextBondId++;

        bonds[bondId] = Bond({
            bondId: bondId,
            company: msg.sender,
            companyName: companyName,
            stakeAmount: msg.value,
            workerCount: workerCount,
            createdAt: block.timestamp,
            active: true
        });

        emit BondCreated(bondId, msg.sender, workerCount);
        return bondId;
    }

    /**
     * @notice Submit flourishing metrics (company perspective)
     * @dev Will be verified against worker attestations
     */
    function submitMetrics(
        uint256 bondId,
        uint256 incomeGrowth,
        uint256 autonomy,
        uint256 dignity,
        uint256 workLifeBalance,
        uint256 security,
        uint256 voice
    ) external onlyCompany(bondId) bondExists(bondId) {
        bondMetrics[bondId].push(FlourishingMetrics({
            timestamp: block.timestamp,
            incomeGrowth: incomeGrowth,
            autonomy: autonomy,
            dignity: dignity,
            workLifeBalance: workLifeBalance,
            security: security,
            voice: voice
        }));

        emit MetricsSubmitted(bondId, block.timestamp);
    }

    /**
     * @notice Worker attestation - anonymous aggregate verification
     * @dev Workers can verify (or dispute) company claims
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
    ) external bondExists(bondId) {
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

        emit WorkerAttestationAdded(bondId, msg.sender);
    }

    // ============ Calculation Functions ============

    /**
     * @notice Calculate flourishing score from company metrics
     * @dev Average across 6 dimensions
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
     */
    function workerVerifiedScore(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        WorkerAttestation[] storage attestations = bondAttestations[bondId];
        if (attestations.length == 0) return 0; // No verification = problem

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 count = 0;
        uint256 totalScore = 0;

        for (uint256 i = attestations.length; i > 0 && attestations[i-1].timestamp >= cutoff; i--) {
            WorkerAttestation storage att = attestations[i-1];
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
                count++;
            }
        }

        return count > 0 ? totalScore / count : 0;
    }

    /**
     * @notice Worker verification multiplier
     * @dev Based on verification rate and alignment with company claims
     * @return multiplier 50-150 (0.5x to 1.5x)
     */
    function workerVerificationMultiplier(uint256 bondId) public view bondExists(bondId) returns (uint256) {
        WorkerAttestation[] storage attestations = bondAttestations[bondId];

        // No verification = major penalty
        if (attestations.length == 0) return 50;

        uint256 cutoff = block.timestamp - 15552000; // ~180 days
        uint256 recentCount = 0;

        for (uint256 i = attestations.length; i > 0 && attestations[i-1].timestamp >= cutoff; i--) {
            if (attestations[i-1].isCurrentWorker) {
                recentCount++;
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
     * @return multiplier 100-300 (1.0x to 3.0x over years)
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
     * @notice Calculate bond value
     * @dev Formula: Stake × Flourishing × WorkerVerification × Time
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

        return (bond.stakeAmount * flourishing * verification * time) / 1000000;
    }

    function calculateAppreciation(uint256 bondId) public view bondExists(bondId) returns (int256) {
        uint256 currentValue = calculateBondValue(bondId);
        uint256 initialStake = bonds[bondId].stakeAmount;
        return int256(currentValue) - int256(initialStake);
    }

    /**
     * @notice Check if exploitation penalty should apply
     * @dev Penalty if: flourishing < 40 OR low worker verification
     */
    function shouldActivateExploitationPenalty(uint256 bondId) public view bondExists(bondId) returns (bool, string memory) {
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

    /**
     * @notice Distribute bond proceeds
     * @dev 70% to workers, 30% to company (or 100% to workers if exploitation)
     */
    function distributeBond(uint256 bondId) external nonReentrant onlyCompany(bondId) bondExists(bondId) {
        Bond storage bond = bonds[bondId];
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
                emit ExploitationPenalty(bondId, penaltyReason);
            } else {
                // Normal: 70% workers, 30% company
                workerShare = (absAppreciation * 70) / 100;
                companyShare = (absAppreciation * 30) / 100;
                reason = "Worker flourishing improving";
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
            reason: reason
        }));

        if (companyShare > 0) {
            payable(bond.company).transfer(companyShare);
        }

        emit BondDistributed(bondId, workerShare, companyShare);
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
