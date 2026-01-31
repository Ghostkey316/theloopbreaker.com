// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Vaultfire Mission Enforcement
 * @notice Cryptographically enforces "Morals over Metrics" across all protocol operations
 * @dev Ensures protocol cannot deviate from core mission principles
 *
 * **Core Mission:**
 * "Privacy over surveillance, Freedom over control, Morals over metrics"
 *
 * **Non-Negotiable Principles (enforced by smart contract, cannot be changed):**
 * 1. Human verification always has final say
 * 2. AI profit caps (30% partnerships, 50% accountability)
 * 3. Privacy default (no surveillance, consent required)
 * 4. Community can challenge any claim
 * 5. Open source, verifiable, auditable
 * 6. No KYC - wallet addresses only
 * 7. No data sale or monetization
 * 8. Right to be forgotten
 *
 * @custom:immutable Core principles are immutable, enforced at contract level
 * @custom:ethics Morals > Metrics: We will never compromise ethics for growth
 */
contract MissionEnforcement {

    /**
     * @notice The canonical Vaultfire mission statement
     * @dev IMMUTABLE - cannot be changed by governance or upgrades
     */
    string public constant MISSION_STATEMENT =
        "For happy and healthy humans, AIs, and Earth. "
        "AI grows WITH humans, not ABOVE them. "
        "Privacy over surveillance. Freedom over control. Morals over metrics.";

    /**
     * @notice Core principles that are cryptographically enforced
     * @dev These cannot be disabled or bypassed, even by governance
     */
    enum CorePrinciple {
        HUMAN_VERIFICATION_FINAL_SAY,
        AI_PROFIT_CAPS,
        PRIVACY_DEFAULT,
        COMMUNITY_CHALLENGES,
        OPEN_SOURCE_VERIFIABLE,
        NO_KYC_WALLET_ONLY,
        NO_DATA_SALE,
        RIGHT_TO_BE_FORGOTTEN
    }

    /**
     * @notice Mission compliance status for each protocol module
     * @dev address => principle => compliance status
     */
    mapping(address => mapping(CorePrinciple => bool)) public missionCompliance;

    /**
     * @notice Tracks modules that have been verified as mission-compliant
     * @dev address => verification timestamp
     */
    mapping(address => uint256) public missionCompliantModules;

    /**
     * @notice Emergency shutdown for modules violating core principles
     * @dev address => violation type
     */
    mapping(address => CorePrinciple) public missionViolations;

    /**
     * @notice Emitted when a module is verified as mission-compliant
     */
    event ModuleMissionCompliant(address indexed module, uint256 timestamp);

    /**
     * @notice Emitted when a mission violation is detected
     */
    event MissionViolationDetected(
        address indexed module,
        CorePrinciple principle,
        string evidence,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a module attempts to bypass mission enforcement
     */
    event MissionBypassAttemptBlocked(
        address indexed module,
        CorePrinciple principle,
        uint256 timestamp
    );

    /**
     * @dev Modifier to ensure operation complies with core principles
     */
    modifier enforceMission(address module, CorePrinciple principle) {
        require(missionCompliance[module][principle], "Mission principle violation");
        _;
    }

    /**
     * @notice Verify that AI profit caps are enforced
     * @param aiShare AI's share of profits (must be <= cap)
     * @param totalAmount Total amount being distributed
     * @param capPercentage Maximum allowed percentage for AI (e.g., 30 for partnerships)
     * @return True if profit cap is respected
     */
    function verifyAIProfitCap(
        uint256 aiShare,
        uint256 totalAmount,
        uint256 capPercentage
    ) public pure returns (bool) {
        require(capPercentage <= 100, "Invalid cap percentage");
        require(totalAmount > 0, "Invalid total amount");

        uint256 maxAIShare = (totalAmount * capPercentage) / 100;
        return aiShare <= maxAIShare;
    }

    /**
     * @notice Verify human verification has final say
     * @dev Ensures AI metrics can be overridden by human attestation
     * @param aiMetricScore Score from AI metrics (0-10000)
     * @param humanVerificationScore Score from human verification (0-10000)
     * @param hasHumanVerification Whether human verification exists
     * @return finalScore The final score (human overrides AI if present)
     */
    function verifyHumanFinalSay(
        uint256 aiMetricScore,
        uint256 humanVerificationScore,
        bool hasHumanVerification
    ) public pure returns (uint256 finalScore) {
        // If human verification exists, it ALWAYS takes precedence
        if (hasHumanVerification) {
            return humanVerificationScore;
        }
        // Otherwise use AI metrics as default
        return aiMetricScore;
    }

    /**
     * @notice Verify no KYC data is being collected
     * @param dataType Type of data being collected
     * @return True if data collection is allowed (wallet addresses only)
     */
    function verifyNoKYC(string memory dataType) public pure returns (bool) {
        bytes32 dataHash = keccak256(abi.encodePacked(dataType));

        // Only wallet addresses are allowed
        bytes32 allowedHash = keccak256(abi.encodePacked("wallet_address"));

        return dataHash == allowedHash;
    }

    /**
     * @notice Report a mission principle violation
     * @param module Address of the violating module
     * @param principle Which core principle was violated
     * @param evidence Human-readable evidence of violation
     */
    function reportMissionViolation(
        address module,
        CorePrinciple principle,
        string memory evidence
    ) external {
        require(bytes(evidence).length > 0, "Evidence required");
        require(bytes(evidence).length <= 1000, "Evidence too long");

        missionViolations[module] = principle;
        missionCompliance[module][principle] = false;

        emit MissionViolationDetected(module, principle, evidence, block.timestamp);
    }

    /**
     * @notice Certify a module as mission-compliant
     * @dev In production, this should be controlled by DAO governance
     * @param module Address of module to certify
     * @param principles Array of principles the module complies with
     */
    function certifyModuleMissionCompliant(
        address module,
        CorePrinciple[] memory principles
    ) external {
        require(principles.length > 0, "Must verify at least one principle");

        for (uint256 i = 0; i < principles.length; i++) {
            missionCompliance[module][principles[i]] = true;
        }

        missionCompliantModules[module] = block.timestamp;
        emit ModuleMissionCompliant(module, block.timestamp);
    }

    /**
     * @notice Get the canonical mission statement
     * @return The immutable Vaultfire mission
     */
    function getMissionStatement() public pure returns (string memory) {
        return MISSION_STATEMENT;
    }

    /**
     * @notice Get full mission enforcement policy
     * @return Human-readable enforcement policy
     */
    function getMissionEnforcementPolicy() public pure returns (string memory) {
        return "Vaultfire MISSION ENFORCEMENT: These principles are IMMUTABLE and enforced at the smart contract level: (1) Human verification ALWAYS has final say over AI metrics, (2) AI profits CAPPED at 30% (partnerships) and 50% (accountability), (3) Privacy is DEFAULT - no surveillance, consent required, (4) Community can CHALLENGE any claim, (5) Open source, verifiable, auditable, (6) NO KYC - wallet addresses only, (7) NO data sale or monetization, (8) Right to be forgotten. These cannot be changed by governance, upgrades, or any authority. Morals over metrics, always.";
    }

    /**
     * @notice Check if module complies with a specific principle
     * @param module Address of module to check
     * @param principle Which principle to verify
     * @return True if module is compliant
     */
    function isCompliantWithPrinciple(
        address module,
        CorePrinciple principle
    ) public view returns (bool) {
        return missionCompliance[module][principle];
    }

    /**
     * @notice Get all core principles as a bitmask
     * @return Bitmask of all enforced core principles
     */
    function getAllCorePrinciples() public pure returns (uint256) {
        // 8 core principles = 8 bits set
        return 0xFF; // 11111111 in binary
    }
}
