// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardStream {
    function updateMultiplier(address user, uint256 multiplier) external;
}

contract RewardMultiplier {
    address public owner;
    IRewardStream public rewardStream;
    uint256 public fallbackMultiplier; // basis points (10_000 = 1.0x)
    uint256 public bonusCapBps; // maximum bonus above base rate

    event MultiplierStreamed(address indexed user, uint256 multiplierBps, bool streamedOnChain);
    event RewardStreamUpdated(address indexed streamAddress);
    event FallbackMultiplierUpdated(uint256 multiplierBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BonusCapUpdated(uint256 capBps);

    error NotOwner();
    error InvalidAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    constructor(address stream, uint256 initialFallbackBps) {
        owner = msg.sender;
        rewardStream = IRewardStream(stream);
        fallbackMultiplier = initialFallbackBps == 0 ? 10_000 : initialFallbackBps;
        bonusCapBps = 5_000; // default: +0.50x max bonus
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRewardStream(address stream) external onlyOwner {
        rewardStream = IRewardStream(stream);
        emit RewardStreamUpdated(stream);
    }

    function setFallbackMultiplier(uint256 newFallbackBps) external onlyOwner {
        require(newFallbackBps > 0, "fallback-too-low");
        fallbackMultiplier = newFallbackBps;
        emit FallbackMultiplierUpdated(newFallbackBps);
    }

    function setBonusCap(uint256 newCapBps) external onlyOwner {
        bonusCapBps = newCapBps;
        emit BonusCapUpdated(newCapBps);
    }

    function calculateMultiplier(
        uint256 baseRateBps,
        uint256 beliefScoreBps,
        uint256 loyaltyScoreBps
    ) public view returns (uint256) {
        uint256 base = baseRateBps < 10_000 ? 10_000 : baseRateBps;
        uint256 beliefBonus = (beliefScoreBps * bonusCapBps) / 100_000; // 5% weight by default
        uint256 loyaltyBonus = loyaltyScoreBps * 5; // loyalty tiers scale softly
        uint256 computed = base + beliefBonus + loyaltyBonus;
        uint256 maxAllowed = base + bonusCapBps;
        if (computed > maxAllowed) {
            computed = maxAllowed;
        }
        return computed;
    }

    function streamMultiplier(
        address user,
        uint256 baseRateBps,
        uint256 beliefScoreBps,
        uint256 loyaltyScoreBps
    ) external onlyOwner returns (uint256) {
        if (user == address(0)) {
            revert InvalidAddress();
        }
        uint256 computed = calculateMultiplier(baseRateBps, beliefScoreBps, loyaltyScoreBps);
        bool streamed = false;
        if (address(rewardStream) != address(0)) {
            try rewardStream.updateMultiplier(user, computed) {
                streamed = true;
            } catch {
                computed = fallbackMultiplier;
            }
        } else {
            computed = fallbackMultiplier;
        }
        emit MultiplierStreamed(user, computed, streamed);
        return computed;
    }
}
