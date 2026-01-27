// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Vaultfire Privacy Guarantees
 * @notice Enforces "Privacy over Surveillance" and "Freedom over Control" principles
 * @dev Core privacy contract that all Vaultfire protocols inherit from
 *
 * **Mission Alignment:**
 * - Privacy over surveillance: Data minimization by default
 * - Freedom over control: Users can delete their data anytime
 * - No KYC: Wallet addresses only, zero identity collection
 * - Morals over metrics: Respect human dignity over data extraction
 *
 * **Privacy Principles:**
 * 1. Data Minimization: Collect only what's absolutely necessary
 * 2. Purpose Limitation: Data used only for stated purpose
 * 3. Right to be Forgotten: Users can delete their data
 * 4. Transparency: All data collection is explicit and visible
 * 5. Consent: All data usage requires explicit consent
 *
 * @custom:security-model Zero-trust: Verify everything, trust nothing
 * @custom:ethics Privacy is a human right, not a premium feature
 */
contract PrivacyGuarantees {

    /**
     * @notice Privacy policy version (immutable, set at deployment)
     * @dev If privacy policy changes, deploy new contract with new version
     */
    string public constant PRIVACY_POLICY_VERSION = "Vaultfire-v1.0-NoKYC-WalletOnly";

    /**
     * @notice Data retention period (30 days after user deletion request)
     * @dev After this period, all user data must be permanently deleted
     */
    uint256 public constant DATA_RETENTION_PERIOD = 30 days;

    /**
     * @notice Tracks user deletion requests
     * @dev address => deletion request timestamp (0 if none)
     */
    mapping(address => uint256) public deletionRequests;

    /**
     * @notice Tracks user consent for specific data purposes
     * @dev address => purpose hash => consent status
     */
    mapping(address => mapping(bytes32 => bool)) public userConsent;

    /**
     * @notice Emitted when user requests data deletion
     */
    event DataDeletionRequested(address indexed user, uint256 effectiveAt);

    /**
     * @notice Emitted when user data is permanently deleted
     */
    event DataPermanentlyDeleted(address indexed user, uint256 timestamp);

    /**
     * @notice Emitted when user grants consent for a purpose
     */
    event ConsentGranted(address indexed user, bytes32 indexed purposeHash, string purpose);

    /**
     * @notice Emitted when user revokes consent for a purpose
     */
    event ConsentRevoked(address indexed user, bytes32 indexed purposeHash, string purpose);

    /**
     * @dev Modifier to ensure user has given consent for a specific purpose
     */
    modifier requiresConsent(address user, bytes32 purposeHash) {
        require(userConsent[user][purposeHash], "User consent required");
        _;
    }

    /**
     * @dev Modifier to check if user has requested deletion
     */
    modifier checkDeletionRequest(address user) {
        require(deletionRequests[user] == 0, "User has requested data deletion");
        _;
    }

    /**
     * @notice Grant consent for a specific data usage purpose
     * @param purpose Human-readable purpose (e.g., "AI Partnership Bond metrics")
     */
    function grantConsent(string memory purpose) external {
        bytes32 purposeHash = keccak256(abi.encodePacked(purpose));
        userConsent[msg.sender][purposeHash] = true;
        emit ConsentGranted(msg.sender, purposeHash, purpose);
    }

    /**
     * @notice Revoke consent for a specific data usage purpose
     * @param purpose Human-readable purpose that was previously consented to
     */
    function revokeConsent(string memory purpose) external {
        bytes32 purposeHash = keccak256(abi.encodePacked(purpose));
        userConsent[msg.sender][purposeHash] = false;
        emit ConsentRevoked(msg.sender, purposeHash, purpose);
    }

    /**
     * @notice Request complete data deletion (Right to be Forgotten)
     * @dev Data will be deleted after DATA_RETENTION_PERIOD
     *      This gives protocols time to wind down active relationships
     */
    function requestDataDeletion() external {
        require(deletionRequests[msg.sender] == 0, "Deletion already requested");

        uint256 effectiveAt = block.timestamp + DATA_RETENTION_PERIOD;
        deletionRequests[msg.sender] = effectiveAt;

        emit DataDeletionRequested(msg.sender, effectiveAt);
    }

    /**
     * @notice Cancel a pending data deletion request
     */
    function cancelDeletionRequest() external {
        require(deletionRequests[msg.sender] != 0, "No deletion request pending");
        deletionRequests[msg.sender] = 0;
    }

    /**
     * @notice Check if user has active consent for a purpose
     * @param user Address to check
     * @param purpose Human-readable purpose
     * @return True if user has granted consent
     */
    function hasConsent(address user, string memory purpose) public view returns (bool) {
        bytes32 purposeHash = keccak256(abi.encodePacked(purpose));
        return userConsent[user][purposeHash];
    }

    /**
     * @notice Check if data deletion is enforceable for a user
     * @param user Address to check
     * @return enforceable True if deletion period has expired
     * @return effectiveAt Timestamp when deletion becomes enforceable (0 if no request)
     */
    function isDeletionEnforceable(address user) public view returns (bool enforceable, uint256 effectiveAt) {
        effectiveAt = deletionRequests[user];
        enforceable = effectiveAt > 0 && block.timestamp >= effectiveAt;
    }

    /**
     * @notice Get privacy policy statement
     * @return Privacy policy in human-readable format
     */
    function getPrivacyPolicy() public pure returns (string memory) {
        return "Vaultfire Privacy Guarantees: (1) No KYC - wallet addresses only, (2) Data minimization - we collect only what's necessary, (3) Consent required - all data usage requires explicit opt-in, (4) Right to be forgotten - delete your data anytime, (5) Privacy over surveillance - we verify without extracting. Your data, your control, always.";
    }
}
