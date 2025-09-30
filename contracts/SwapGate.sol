// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SwapGate
 * @notice Swap Vaultfire tokens for ETH, USDC, or SOL. Trusted onchain IDs can
 * bypass KYC requirements.
 */
contract SwapGate is Ownable {
    IERC20 public immutable vaultfire;
    IERC20 public immutable usdc;
    address public feeRecipient;
    uint256 public feeBps = 10; // 0.10% fee
    bool public kycRequired = true;
    mapping(address => bool) public trustedID;

    event FeeRecipientSet(address indexed recipient);
    event FeeUpdated(uint256 feeBps);
    event TrustedIDSet(address indexed user, bool trusted);
    event KycRequiredSet(bool required);
    event Swap(address indexed user, string asset, uint256 amountIn, uint256 amountOut);
    event SwapToSol(address indexed user, bytes32 solanaAddress, uint256 amountIn);

    constructor(IERC20 _vaultfire, IERC20 _usdc, address _feeRecipient) Ownable(msg.sender) {
        require(address(_vaultfire) != address(0), "vaultfire zero");
        require(address(_usdc) != address(0), "usdc zero");
        vaultfire = _vaultfire;
        usdc = _usdc;
        feeRecipient = _feeRecipient;
    }

    modifier checkKYC() {
        if (kycRequired && !trustedID[msg.sender]) {
            revert("kyc required");
        }
        _;
    }

    receive() external payable {}

    function setFeeRecipient(address recipient) external onlyOwner {
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "fee too high");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setTrustedID(address user, bool trusted) external onlyOwner {
        trustedID[user] = trusted;
        emit TrustedIDSet(user, trusted);
    }

    function setKycRequired(bool required) external onlyOwner {
        kycRequired = required;
        emit KycRequiredSet(required);
    }

    function depositVaultfire(uint256 amount) external onlyOwner {
        vaultfire.transferFrom(msg.sender, address(this), amount);
    }

    function depositUSDC(uint256 amount) external onlyOwner {
        usdc.transferFrom(msg.sender, address(this), amount);
    }

    function swapToETH(uint256 amount) external checkKYC {
        uint256 fee = (amount * feeBps) / 10000;
        vaultfire.transferFrom(msg.sender, feeRecipient, fee);
        vaultfire.transferFrom(msg.sender, address(this), amount - fee);
        uint256 ethAmount = amount - fee;
        require(address(this).balance >= ethAmount, "insufficient ETH");
        payable(msg.sender).transfer(ethAmount);
        emit Swap(msg.sender, "ETH", amount, ethAmount);
    }

    function swapToUSDC(uint256 amount) external checkKYC {
        uint256 fee = (amount * feeBps) / 10000;
        vaultfire.transferFrom(msg.sender, feeRecipient, fee);
        vaultfire.transferFrom(msg.sender, address(this), amount - fee);
        uint256 out = amount - fee;
        require(usdc.balanceOf(address(this)) >= out, "insufficient USDC");
        usdc.transfer(msg.sender, out);
        emit Swap(msg.sender, "USDC", amount, out);
    }

    function swapToSOL(uint256 amount, bytes32 solanaAddress) external checkKYC {
        uint256 fee = (amount * feeBps) / 10000;
        vaultfire.transferFrom(msg.sender, feeRecipient, fee);
        vaultfire.transferFrom(msg.sender, address(this), amount - fee);
        emit SwapToSol(msg.sender, solanaAddress, amount);
    }
}
