// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../ITeleporterMessenger.sol";
import "../ITeleporterReceiver.sol";

/**
 * @title MockTeleporterMessenger
 * @notice Test mock that simulates the Avalanche TeleporterMessenger contract.
 * @dev Records sent messages and allows test code to simulate delivery on a
 *      paired mock instance (representing the destination chain).
 */
contract MockTeleporterMessenger is ITeleporterMessenger {

    struct SentMessage {
        bytes32 destinationBlockchainID;
        address destinationAddress;
        uint256 requiredGasLimit;
        bytes message;
    }

    SentMessage[] public sentMessages;
    uint256 private _nonce;
    bytes32 public blockchainID;

    constructor(bytes32 _blockchainID) {
        blockchainID = _blockchainID;
    }

    // ── ITeleporterMessenger implementation ─────────────────────────────────

    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external override returns (bytes32) {
        _nonce++;
        sentMessages.push(SentMessage({
            destinationBlockchainID: messageInput.destinationBlockchainID,
            destinationAddress: messageInput.destinationAddress,
            requiredGasLimit: messageInput.requiredGasLimit,
            message: messageInput.message
        }));

        bytes32 messageID = keccak256(abi.encodePacked(blockchainID, _nonce));

        TeleporterMessage memory teleMsg = TeleporterMessage({
            messageNonce: _nonce,
            originSenderAddress: msg.sender,
            destinationBlockchainID: messageInput.destinationBlockchainID,
            destinationAddress: messageInput.destinationAddress,
            requiredGasLimit: messageInput.requiredGasLimit,
            allowedRelayerAddresses: messageInput.allowedRelayerAddresses,
            receipts: new TeleporterMessageReceipt[](0),
            message: messageInput.message
        });

        emit SendCrossChainMessage(
            messageID,
            messageInput.destinationBlockchainID,
            teleMsg,
            messageInput.feeInfo
        );

        return messageID;
    }

    function retrySendCrossChainMessage(TeleporterMessage calldata) external pure override {
        revert("MockTeleporter: not implemented");
    }

    function addFeeAmount(bytes32, address, uint256) external pure override {
        revert("MockTeleporter: not implemented");
    }

    function receiveCrossChainMessage(uint32, address) external pure override {
        revert("MockTeleporter: not implemented");
    }

    function retryMessageExecution(bytes32, TeleporterMessage calldata) external pure override {
        revert("MockTeleporter: not implemented");
    }

    function messageReceived(bytes32) external pure override returns (bool) {
        return false;
    }

    function getMessageHash(bytes32) external pure override returns (bytes32) {
        return bytes32(0);
    }

    function getNextMessageID(bytes32) external pure override returns (bytes32) {
        return bytes32(0);
    }

    // ── Test helpers ───────────────────────────────────────────────────────

    function getSentMessageCount() external view returns (uint256) {
        return sentMessages.length;
    }

    function getLastSentMessage() external view returns (SentMessage memory) {
        require(sentMessages.length > 0, "No messages sent");
        return sentMessages[sentMessages.length - 1];
    }

    /**
     * @notice Simulate delivering a message to a receiver contract.
     * @dev This mimics what TeleporterMessenger does on the destination chain.
     * @param receiver  The contract implementing ITeleporterReceiver.
     * @param sourceBlockchainID  The blockchain ID of the source chain.
     * @param originSenderAddress  The sender on the source chain.
     * @param message  The encoded message payload.
     */
    function deliverMessage(
        address receiver,
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external {
        ITeleporterReceiver(receiver).receiveTeleporterMessage(
            sourceBlockchainID,
            originSenderAddress,
            message
        );
    }
}
