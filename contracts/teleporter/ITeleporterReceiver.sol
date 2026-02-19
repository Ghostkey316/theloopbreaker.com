// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title ITeleporterReceiver
 * @dev Interface that cross-chain applications must implement to receive
 * messages from the Avalanche Teleporter protocol.
 * Compatible with the official ava-labs/icm-contracts ITeleporterReceiver.
 */
interface ITeleporterReceiver {
    /**
     * @dev Called by TeleporterMessenger on the receiving chain.
     * @param sourceBlockchainID The blockchain ID of the source chain.
     * @param originSenderAddress The address of the sender on the source chain.
     * @param message The ABI-encoded message payload.
     */
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}
