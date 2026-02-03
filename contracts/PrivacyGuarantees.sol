// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title Vaultfire Privacy Guarantees
 * @notice Enforces "Privacy over Surveillance" and "Freedom over Control" principles.
 *
 * @dev
 * This contract is a *privacy floor* for modules that inherit/compose it.
 * It intentionally avoids writing user-provided freeform strings on-chain.
 * All consent purposes are represented as hashes; UIs/off-chain services can map
 * human-readable strings to hashes client-side.
 *
 * @custom:security-model Zero-trust: Verify everything, trust nothing
 * @custom:ethics Privacy is a human right, not a premium feature
 */
contract PrivacyGuarantees {
    /**
     * @notice Privacy policy version (immutable, set at deployment)
     * @dev If privacy policy changes, deploy new contract with new version
     */
    string public constant PRIVACY_POLICY_VERSION = "Vaultfire-v1.1-NoKYC-WalletOnly-HashedPurposes";

    /**
     * @notice Data retention period (30 days after user deletion request)
     * @dev Note: on-chain state cannot be erased; "deletion" here means:
     *      - stop future writes that associate new data with the user
     *      - off-chain systems delete/redact within policy
     */
    uint256 public constant DATA_RETENTION_PERIOD = 30 days;

    /// @dev address => deletion request timestamp (0 if none)
    mapping(address => uint256) public deletionRequests;

    /// @dev address => purpose hash => consent status
    mapping(address => mapping(bytes32 => bool)) public userConsent;

    event DataDeletionRequested(address indexed user, uint256 effectiveAt);
    event DataPermanentlyDeleted(address indexed user, uint256 timestamp);

    event ConsentGranted(address indexed user, bytes32 indexed purposeHash);
    event ConsentRevoked(address indexed user, bytes32 indexed purposeHash);

    modifier requiresConsent(address user, bytes32 purposeHash) {
        require(userConsent[user][purposeHash], "User consent required");
        _;
    }

    modifier checkDeletionRequest(address user) {
        require(deletionRequests[user] == 0, "User has requested data deletion");
        _;
    }

    /**
     * @notice Utility: hash a human-readable purpose string into a purposeHash.
     * @dev Pure helper for UIs/tests. Prefer computing client-side.
     */
    function hashPurpose(string memory purpose) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(purpose));
    }

    /**
     * @notice Grant consent for a specific purpose
     * @param purposeHash keccak256 hash of the human-readable purpose string
     */
    function grantConsent(bytes32 purposeHash) external {
        require(purposeHash != bytes32(0), "Purpose hash required");
        userConsent[msg.sender][purposeHash] = true;
        emit ConsentGranted(msg.sender, purposeHash);
    }

    /**
     * @notice Revoke consent for a specific purpose
     * @param purposeHash keccak256 hash of the human-readable purpose string
     */
    function revokeConsent(bytes32 purposeHash) external {
        require(purposeHash != bytes32(0), "Purpose hash required");
        userConsent[msg.sender][purposeHash] = false;
        emit ConsentRevoked(msg.sender, purposeHash);
    }

    /**
     * @notice Request complete data deletion (Right to be Forgotten)
     * @dev Data becomes enforceable after DATA_RETENTION_PERIOD.
     */
    function requestDataDeletion() external {
        require(deletionRequests[msg.sender] == 0, "Deletion already requested");

        uint256 effectiveAt = block.timestamp + DATA_RETENTION_PERIOD;
        deletionRequests[msg.sender] = effectiveAt;

        emit DataDeletionRequested(msg.sender, effectiveAt);
    }

    function cancelDeletionRequest() external {
        require(deletionRequests[msg.sender] != 0, "No deletion request pending");
        deletionRequests[msg.sender] = 0;
    }

    function hasConsent(address user, bytes32 purposeHash) public view returns (bool) {
        return userConsent[user][purposeHash];
    }

    function isDeletionEnforceable(address user) public view returns (bool enforceable, uint256 effectiveAt) {
        effectiveAt = deletionRequests[user];
        enforceable = effectiveAt > 0 && block.timestamp >= effectiveAt;
    }

    function getPrivacyPolicy() public pure returns (string memory) {
        return
            "Vaultfire Privacy Guarantees: (1) No KYC - wallet addresses only, (2) Data minimization - we collect only what's necessary, "
            "(3) Consent required - explicit opt-in per purpose hash, (4) Right to be forgotten - stop future writes + off-chain deletion/redaction, "
            "(5) Privacy over surveillance - we verify without extracting. Your data, your control, always.";
    }
}
