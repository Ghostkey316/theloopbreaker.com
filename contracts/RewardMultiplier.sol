// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRewardStream Interface
 * @notice Interface for reward stream contracts that can receive multiplier updates
 */
interface IRewardStream {
    function updateMultiplier(address user, uint256 multiplier) external;
}

/**
 * @title RewardMultiplier
 * @notice Calculates and streams reward multipliers based on belief and loyalty scores
 * @dev Multipliers are in basis points (10,000 = 1.0x)
 *
 * @custom:security Owner-controlled with fallback mechanism
 * @custom:math Multiplier = base + (belief_bonus + loyalty_bonus) capped at max_allowed
 */
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

    /**
     * @notice Initialize RewardMultiplier contract
     * @dev Sets deployer as owner, initializes reward stream and fallback multiplier
     *
     * @param stream Address of the reward stream contract
     * @param initialFallbackBps Initial fallback multiplier in basis points (0 defaults to 10,000 = 1.0x)
     *
     * Requirements:
     * - Sets bonusCapBps to 5,000 (0.5x max bonus) by default
     */
    constructor(address stream, uint256 initialFallbackBps) {
        owner = msg.sender;
        rewardStream = IRewardStream(stream);
        fallbackMultiplier = initialFallbackBps == 0 ? 10_000 : initialFallbackBps;
        bonusCapBps = 5_000; // default: +0.50x max bonus
    }

    /**
     * @notice Transfer ownership to a new address
     * @dev Only current owner can transfer ownership
     *
     * @param newOwner Address of the new owner
     *
     * Requirements:
     * - Caller must be current owner
     * - New owner cannot be zero address
     *
     * Emits:
     * - {OwnershipTransferred} event
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Update the reward stream contract address
     * @dev Only owner can update reward stream
     *
     * @param stream New reward stream contract address
     *
     * Requirements:
     * - Caller must be owner
     *
     * Emits:
     * - {RewardStreamUpdated} event
     */
    function setRewardStream(address stream) external onlyOwner {
        rewardStream = IRewardStream(stream);
        emit RewardStreamUpdated(stream);
    }

    /**
     * @notice Update the fallback multiplier used when streaming fails
     * @dev Only owner can update fallback multiplier
     *
     * @param newFallbackBps New fallback multiplier in basis points
     *
     * Requirements:
     * - Caller must be owner
     * - Fallback must be > 0
     *
     * Emits:
     * - {FallbackMultiplierUpdated} event
     */
    function setFallbackMultiplier(uint256 newFallbackBps) external onlyOwner {
        require(newFallbackBps > 0, "fallback-too-low");
        fallbackMultiplier = newFallbackBps;
        emit FallbackMultiplierUpdated(newFallbackBps);
    }

    /**
     * @notice Update the maximum bonus cap
     * @dev Only owner can update bonus cap
     *
     * @param newCapBps New bonus cap in basis points
     *
     * Requirements:
     * - Caller must be owner
     *
     * Emits:
     * - {BonusCapUpdated} event
     */
    function setBonusCap(uint256 newCapBps) external onlyOwner {
        bonusCapBps = newCapBps;
        emit BonusCapUpdated(newCapBps);
    }

    /**
     * @notice Calculate reward multiplier based on base rate, belief score, and loyalty score
     * @dev Formula: multiplier = min(base + belief_bonus + loyalty_bonus, base + bonusCap)
     *
     * @param baseRateBps Base rate in basis points (minimum 10,000 = 1.0x)
     * @param beliefScoreBps Belief score in basis points (0-10,000)
     * @param loyaltyScoreBps Loyalty score in basis points (0-10,000)
     * @return multiplier Final multiplier in basis points, capped at max allowed
     *
     * Math:
     * - base = max(baseRateBps, 10,000)
     * - belief_bonus = (beliefScoreBps × bonusCapBps) / 100,000
     * - loyalty_bonus = loyaltyScoreBps × 5
     * - multiplier = min(base + belief_bonus + loyalty_bonus, base + bonusCapBps)
     *
     * @custom:math-security All calculations use integer math, no overflow possible with reasonable inputs
     */
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

    /**
     * @notice Calculate and stream multiplier to reward stream contract
     * @dev Attempts to stream to reward stream, falls back to fallbackMultiplier on failure
     *
     * @param user Address of user receiving multiplier update
     * @param baseRateBps Base rate in basis points
     * @param beliefScoreBps Belief score in basis points
     * @param loyaltyScoreBps Loyalty score in basis points
     * @return multiplier Final multiplier that was streamed or fell back to
     *
     * Requirements:
     * - Caller must be owner
     * - User address cannot be zero
     *
     * Emits:
     * - {MultiplierStreamed} event with final multiplier and stream status
     *
     * @custom:security Try-catch protects against reward stream failures
     */
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
