// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @dev Teleporter message receipt for fee redemption.
 */
struct TeleporterMessageReceipt {
    uint256 receivedMessageNonce;
    address relayerRewardAddress;
}

/**
 * @dev Input struct for sending a Teleporter cross-chain message.
 */
struct TeleporterMessageInput {
    bytes32 destinationBlockchainID;
    address destinationAddress;
    TeleporterFeeInfo feeInfo;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    bytes message;
}

/**
 * @dev Represents a message sent or received by ITeleporterMessenger.
 */
struct TeleporterMessage {
    uint256 messageNonce;
    address originSenderAddress;
    bytes32 destinationBlockchainID;
    address destinationAddress;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    TeleporterMessageReceipt[] receipts;
    bytes message;
}

/**
 * @dev Fee information for a Teleporter message.
 */
struct TeleporterFeeInfo {
    address feeTokenAddress;
    uint256 amount;
}

/**
 * @title ITeleporterMessenger
 * @dev Interface for the Avalanche Teleporter cross-chain messenger.
 * Compatible with the official ava-labs/icm-contracts ITeleporterMessenger.
 */
interface ITeleporterMessenger {
    event SendCrossChainMessage(
        bytes32 indexed messageID,
        bytes32 indexed destinationBlockchainID,
        TeleporterMessage message,
        TeleporterFeeInfo feeInfo
    );

    event ReceiveCrossChainMessage(
        bytes32 indexed messageID,
        bytes32 indexed sourceBlockchainID,
        address indexed deliverer,
        address rewardRedeemer,
        TeleporterMessage message
    );

    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external returns (bytes32);

    function retrySendCrossChainMessage(TeleporterMessage calldata message) external;

    function addFeeAmount(
        bytes32 messageID,
        address feeTokenAddress,
        uint256 additionalFeeAmount
    ) external;

    function receiveCrossChainMessage(uint32 messageIndex, address relayerRewardAddress) external;

    function retryMessageExecution(
        bytes32 sourceBlockchainID,
        TeleporterMessage calldata message
    ) external;

    function messageReceived(bytes32 messageID) external view returns (bool);

    function getMessageHash(bytes32 messageID) external view returns (bytes32);

    function getNextMessageID(bytes32 destinationBlockchainID) external view returns (bytes32);
}
