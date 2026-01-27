// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GhostkeyAttribution
 * @notice Stores permanent contributor metadata and routes royalty shares
 *         for Ghostkey-316. Future forks must preserve this metadata.
 */
contract GhostkeyAttribution {
    string public constant CONTRIBUTOR = "Ghostkey-316";
    string public constant ENS = "ghostkey316.eth";
    string public constant PRIMARY_WALLET = "bpow20.cb.id";
    string public constant GITHUB = "github.com/Ghostkey316";

    address payable public immutable royaltyRecipient;

    event RoyaltyPaid(address indexed payer, uint256 amount, string token);

    constructor(address payable recipient) {
        require(recipient != address(0), "recipient zero");
        royaltyRecipient = recipient;
    }

    receive() external payable {
        royaltyRecipient.transfer(msg.value);
        emit RoyaltyPaid(msg.sender, msg.value, "ETH");
    }

    function payRoyalty() external payable {
        require(msg.value > 0, "no value");
        royaltyRecipient.transfer(msg.value);
        emit RoyaltyPaid(msg.sender, msg.value, "ETH");
    }
}
