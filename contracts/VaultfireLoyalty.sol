// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VaultfireLoyalty
 * @notice Mints loyalty tokens for users with verified XP messages.
 * Uses EIP-712 signatures for verification.
 */
contract VaultfireLoyalty is ERC20, EIP712 {
    struct XPMessage {
        address account;
        uint256 xp;
    }

    bytes32 private constant XP_MESSAGE_TYPEHASH =
        keccak256("XPMessage(address account,uint256 xp)");

    address public admin;
    uint256 public xpThreshold;
    mapping(address => bool) public claimed;

    event Claimed(address indexed account, uint256 xp);
    event Reset(address indexed account);
    event XpThresholdUpdated(uint256 newThreshold);

    constructor(uint256 _xpThreshold) ERC20("Vaultfire Loyalty", "VFLOYAL") EIP712("VaultfireLoyalty", "1") {
        admin = msg.sender;
        xpThreshold = _xpThreshold;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "admin only");
        _;
    }

    /**
     * @notice Claim a loyalty token if XP message is valid and above threshold.
     * @param msgData XPMessage struct with account and xp values.
     * @param signature EIP-712 signature from the signer.
     */
    function claim(XPMessage calldata msgData, bytes calldata signature) external {
        require(msgData.account == msg.sender, "wrong signer");
        require(!claimed[msg.sender], "already claimed");
        require(msgData.xp >= xpThreshold, "xp below threshold");

        bytes32 structHash = keccak256(abi.encode(
            XP_MESSAGE_TYPEHASH,
            msgData.account,
            msgData.xp
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == msgData.account, "invalid signature");

        claimed[msg.sender] = true;
        _mint(msg.sender, 1 ether); // 1 token with 18 decimals
        emit Claimed(msg.sender, msgData.xp);
    }

    /**
     * @notice Admin-only function to reset claim status for an account.
     */
    function reset(address account) external onlyAdmin {
        claimed[account] = false;
        emit Reset(account);
    }

    /**
     * @notice Admin-only function to update the XP threshold.
     */
    function setXpThreshold(uint256 newThreshold) external onlyAdmin {
        xpThreshold = newThreshold;
        emit XpThresholdUpdated(newThreshold);
    }
}

