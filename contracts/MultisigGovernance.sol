// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title MultisigGovernance
 * @notice OpenZeppelin-style multisig governance for critical owner functions.
 * @dev Security audit recommendation: replaces single-owner control with
 *      M-of-N multisig approval for critical protocol operations.
 *
 * @custom:security-enhancement From Professional Security Audit 2026
 * @custom:purpose Reduce centralization risk by requiring multiple signatures
 *
 * Design:
 * - Configurable M-of-N threshold (e.g., 2-of-3, 3-of-5).
 * - Any signer can propose a transaction.
 * - Each signer can confirm or revoke their confirmation.
 * - Transaction executes only when the confirmation threshold is met.
 * - Transactions expire after a configurable window (default 7 days).
 * - Signers can be added/removed via the multisig itself.
 */
contract MultisigGovernance {

    // ============ Errors ============

    error NotSigner();
    error ZeroAddress();
    error InvalidThreshold();
    error DuplicateSigner();
    error SignerNotFound();
    error TransactionNotFound();
    error TransactionAlreadyExecuted();
    error TransactionExpired();
    error AlreadyConfirmed();
    error NotConfirmed();
    error ThresholdNotMet();
    error ExecutionFailed();
    error CannotRemoveLastSigner();
    error ThresholdExceedsSigners();

    // ============ Events ============

    event TransactionProposed(
        uint256 indexed txId,
        address indexed proposer,
        address indexed target,
        bytes data,
        uint256 value,
        uint256 expiresAt
    );

    event TransactionConfirmed(
        uint256 indexed txId,
        address indexed signer
    );

    event ConfirmationRevoked(
        uint256 indexed txId,
        address indexed signer
    );

    event TransactionExecuted(
        uint256 indexed txId,
        address indexed executor
    );

    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

    // ============ Structs ============

    struct Transaction {
        address target;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        uint256 proposedAt;
        uint256 expiresAt;
    }

    // ============ Constants ============

    /// @notice Default transaction expiry window (7 days).
    uint256 public constant TRANSACTION_EXPIRY = 7 days;

    // ============ State Variables ============

    /// @notice List of signers.
    address[] public signers;

    /// @notice Mapping for O(1) signer lookup.
    mapping(address => bool) public isSigner;

    /// @notice Number of confirmations required to execute a transaction.
    uint256 public threshold;

    /// @notice All proposed transactions.
    mapping(uint256 => Transaction) public transactions;

    /// @notice Confirmation status: txId => signer => confirmed.
    mapping(uint256 => mapping(address => bool)) public confirmations;

    /// @notice Total number of proposed transactions.
    uint256 public transactionCount;

    // ============ Modifiers ============

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only via multisig");
        _;
    }

    modifier txExists(uint256 txId) {
        if (txId >= transactionCount) revert TransactionNotFound();
        _;
    }

    modifier notExecuted(uint256 txId) {
        if (transactions[txId].executed) revert TransactionAlreadyExecuted();
        _;
    }

    modifier notExpired(uint256 txId) {
        if (block.timestamp > transactions[txId].expiresAt) revert TransactionExpired();
        _;
    }

    // ============ Constructor ============

    /// @notice Deploy the multisig governance contract.
    /// @param _signers Initial list of signers.
    /// @param _threshold Number of confirmations required (M in M-of-N).
    constructor(address[] memory _signers, uint256 _threshold) {
        if (_signers.length == 0) revert InvalidThreshold();
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();

        for (uint256 i = 0; i < _signers.length;) {
            address signer = _signers[i];
            if (signer == address(0)) revert ZeroAddress();
            if (isSigner[signer]) revert DuplicateSigner();

            isSigner[signer] = true;
            signers.push(signer);

            emit SignerAdded(signer);
            unchecked { ++i; }
        }

        threshold = _threshold;
    }

    // ============ Transaction Lifecycle ============

    /// @notice Propose a new transaction.
    /// @param target The target contract address.
    /// @param value ETH value to send.
    /// @param data The calldata to execute.
    /// @return txId The ID of the proposed transaction.
    function proposeTransaction(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256 txId) {
        if (target == address(0)) revert ZeroAddress();

        txId = transactionCount++;

        transactions[txId] = Transaction({
            target: target,
            value: value,
            data: data,
            executed: false,
            confirmations: 0,
            proposedAt: block.timestamp,
            expiresAt: block.timestamp + TRANSACTION_EXPIRY
        });

        emit TransactionProposed(
            txId, msg.sender, target, data, value,
            block.timestamp + TRANSACTION_EXPIRY
        );

        // Auto-confirm for the proposer
        _confirm(txId);
    }

    /// @notice Confirm a pending transaction.
    /// @param txId The transaction ID to confirm.
    function confirmTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        notExpired(txId)
    {
        _confirm(txId);
    }

    /// @notice Revoke a previous confirmation.
    /// @param txId The transaction ID to revoke confirmation for.
    function revokeConfirmation(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        if (!confirmations[txId][msg.sender]) revert NotConfirmed();

        confirmations[txId][msg.sender] = false;
        transactions[txId].confirmations--;

        emit ConfirmationRevoked(txId, msg.sender);
    }

    /// @notice Execute a transaction that has met the confirmation threshold.
    /// @param txId The transaction ID to execute.
    function executeTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        notExpired(txId)
    {
        Transaction storage txn = transactions[txId];
        if (txn.confirmations < threshold) revert ThresholdNotMet();

        txn.executed = true;

        (bool success, ) = txn.target.call{value: txn.value}(txn.data);
        if (!success) revert ExecutionFailed();

        emit TransactionExecuted(txId, msg.sender);
    }

    // ============ Signer Management (via multisig only) ============

    /// @notice Add a new signer.  Can only be called by the multisig itself.
    /// @param signer The address to add as a signer.
    function addSigner(address signer) external onlySelf {
        if (signer == address(0)) revert ZeroAddress();
        if (isSigner[signer]) revert DuplicateSigner();

        isSigner[signer] = true;
        signers.push(signer);

        emit SignerAdded(signer);
    }

    /// @notice Remove a signer.  Can only be called by the multisig itself.
    /// @param signer The address to remove.
    function removeSigner(address signer) external onlySelf {
        if (!isSigner[signer]) revert SignerNotFound();
        if (signers.length <= 1) revert CannotRemoveLastSigner();
        if (signers.length - 1 < threshold) revert ThresholdExceedsSigners();

        isSigner[signer] = false;

        // Swap-and-pop from signers array
        uint256 length = signers.length;
        for (uint256 i = 0; i < length;) {
            if (signers[i] == signer) {
                signers[i] = signers[length - 1];
                signers.pop();
                break;
            }
            unchecked { ++i; }
        }

        emit SignerRemoved(signer);
    }

    /// @notice Change the confirmation threshold.  Can only be called by the
    ///         multisig itself.
    /// @param newThreshold The new threshold value.
    function changeThreshold(uint256 newThreshold) external onlySelf {
        if (newThreshold == 0 || newThreshold > signers.length) revert InvalidThreshold();

        uint256 oldThreshold = threshold;
        threshold = newThreshold;

        emit ThresholdChanged(oldThreshold, newThreshold);
    }

    // ============ View Functions ============

    /// @notice Get the list of all signers.
    /// @return Array of signer addresses.
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /// @notice Get the number of signers.
    /// @return Number of signers.
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /// @notice Get transaction details.
    /// @param txId The transaction ID.
    /// @return target The target address.
    /// @return value The ETH value.
    /// @return data The calldata.
    /// @return executed Whether the transaction has been executed.
    /// @return numConfirmations The current number of confirmations.
    /// @return expiresAt The expiry timestamp.
    function getTransaction(uint256 txId) external view returns (
        address target,
        uint256 value,
        bytes memory data,
        bool executed,
        uint256 numConfirmations,
        uint256 expiresAt
    ) {
        Transaction storage txn = transactions[txId];
        return (
            txn.target,
            txn.value,
            txn.data,
            txn.executed,
            txn.confirmations,
            txn.expiresAt
        );
    }

    /// @notice Check if a transaction is ready to execute.
    /// @param txId The transaction ID.
    /// @return ready True if the transaction can be executed.
    function isTransactionReady(uint256 txId) external view returns (bool) {
        if (txId >= transactionCount) return false;
        Transaction storage txn = transactions[txId];
        return !txn.executed &&
               txn.confirmations >= threshold &&
               block.timestamp <= txn.expiresAt;
    }

    // ============ Internal Functions ============

    function _confirm(uint256 txId) internal {
        if (confirmations[txId][msg.sender]) revert AlreadyConfirmed();

        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmations++;

        emit TransactionConfirmed(txId, msg.sender);
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
