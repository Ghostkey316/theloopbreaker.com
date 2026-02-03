// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title Vaultfire Anti-Surveillance Shield
 * @notice Enforces "Privacy over Surveillance" through explicit governance-controlled enforcement.
 *
 * @dev
 * This contract is intentionally designed to avoid becoming a surveillance surface itself.
 * In particular:
 *  - No freeform strings are accepted for evidence/reason (PII risk).
 *  - Public reporting is non-binding (prevents griefing/DoS).
 *  - Enforcement is owner/governance controlled (multisig/DAO in production).
 *
 * @custom:security Privacy-preserving by design
 * @custom:ethics Surveillance is incompatible with human dignity
 */
contract AntiSurveillance {
    /// @notice Admin for enforcement actions (defaults to deployer; use multisig/DAO in production)
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @notice Protocol commitment to anti-surveillance
     * @dev Immutable - this protocol will NEVER collect surveillance data.
     */
    string public constant ANTI_SURVEILLANCE_COMMITMENT =
        "Vaultfire Protocol commits to ZERO surveillance: No tracking, no profiling, no data extraction. "
        "We verify trust through cryptography, not by monitoring behavior. "
        "This commitment is immutable and cannot be changed by governance.";

    /**
     * @notice Banned data collection types
     * @dev These data types are PROHIBITED from collection, even with consent.
     */
    enum BannedDataType {
        BEHAVIORAL_TRACKING,
        CROSS_PROTOCOL_LINKING,
        METADATA_HARVESTING,
        BIOMETRIC_DATA,
        LOCATION_DATA,
        DEVICE_FINGERPRINTING,
        SOCIAL_GRAPH_MINING,
        SENTIMENT_ANALYSIS,
        PREDICTIVE_PROFILING
    }

    /**
     * @notice Tracks protocol modules that have been verified as surveillance-free
     * @dev address => verification timestamp (0 if not verified)
     */
    mapping(address => uint256) public surveillanceFreeModules;

    /**
     * @notice Emergency kill switch for any module caught doing surveillance
     * @dev address => banned status
     */
    mapping(address => bool) public bannedForSurveillance;

    event ModuleVerifiedSurveillanceFree(address indexed module, uint256 timestamp);

    /**
     * @notice Emitted when a module is banned for surveillance violations
     * @dev Uses hashes only to avoid writing evidence/reason text (potential PII) on-chain.
     *      Off-chain systems can publish a signed report that hashes to these values.
     */
    event ModuleBannedForSurveillance(
        address indexed module,
        BannedDataType violationType,
        bytes32 indexed reasonHash,
        bytes32 indexed evidenceHash,
        uint256 timestamp
    );

    event SurveillanceAttemptBlocked(address indexed attacker, BannedDataType attemptedType, uint256 timestamp);

    modifier surveillanceFreeOnly(address module) {
        require(surveillanceFreeModules[module] > 0, "Module not verified surveillance-free");
        require(!bannedForSurveillance[module], "Module banned for surveillance");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /**
     * @notice Report a surveillance violation (non-binding)
     * @dev Reporting is intentionally non-binding to prevent griefing/DoS.
     *      Enforcement actions must be executed via governance/admin process.
     */
    function reportSurveillanceViolation(address module, BannedDataType violationType, bytes32 evidenceHash)
        external
    {
        // Evidence hash should be non-zero to prevent spammy null reports.
        require(evidenceHash != bytes32(0), "Evidence hash required");

        // Report uses a zero reasonHash (unknown/unspecified) by default.
        emit ModuleBannedForSurveillance(module, violationType, bytes32(0), evidenceHash, block.timestamp);
    }

    /// @notice Governance/admin action: ban a module for surveillance.
    function banModuleForSurveillance(address module, BannedDataType violationType, bytes32 reasonHash, bytes32 evidenceHash)
        external
        onlyOwner
    {
        require(reasonHash != bytes32(0), "Reason hash required");
        require(evidenceHash != bytes32(0), "Evidence hash required");

        bannedForSurveillance[module] = true;
        emit ModuleBannedForSurveillance(module, violationType, reasonHash, evidenceHash, block.timestamp);
    }

    /// @notice Governance/admin action: unban a module (appeal or false report).
    function unbanModule(address module) external onlyOwner {
        bannedForSurveillance[module] = false;
    }

    /**
     * @notice Verify a module as surveillance-free (governance-administered)
     * @dev Restricting this prevents spoofing and preserves the integrity of any downstream gating.
     */
    function verifyModuleSurveillanceFree(address module) external onlyOwner {
        require(!bannedForSurveillance[module], "Module previously banned");
        require(surveillanceFreeModules[module] == 0, "Module already verified");

        surveillanceFreeModules[module] = block.timestamp;
        emit ModuleVerifiedSurveillanceFree(module, block.timestamp);
    }

    function getAntiSurveillancePolicy() public pure returns (string memory) {
        return
            "Vaultfire ANTI-SURVEILLANCE POLICY: We will NEVER: (1) Track your behavior, (2) Profile your activity, "
            "(3) Sell your data, (4) Share data with third parties without explicit consent, (5) Use 'legitimate interest' "
            "to bypass consent, (6) Deploy tracking pixels/cookies, (7) Fingerprint your device, (8) Collect biometric data, "
            "(9) Mine your social graph, (10) Build predictive models of you. We verify trust through cryptography, not surveillance. "
            "This is a permanent commitment.";
    }

    function isDataTypeBanned(BannedDataType dataType) public pure returns (bool) {
        dataType; // suppress unused variable warning
        return true;
    }

    function getBannedDataTypes() public pure returns (string memory) {
        return
            "PERMANENTLY BANNED: Behavioral tracking, Cross-protocol linking, Metadata harvesting, Biometric data, "
            "Location tracking, Device fingerprinting, Social graph mining, Sentiment analysis, Predictive profiling. "
            "Vaultfire will NEVER collect these, even with consent.";
    }
}
