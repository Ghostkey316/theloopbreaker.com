// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {BeliefOracle} from "../BeliefOracle.sol";
import {DilithiumAttestor} from "../DilithiumAttestor.sol";
import {RewardStream} from "./RewardStream.sol";

/// @title FreedomVow
/// @notice Permissionless ignition rite layered on top of the BeliefOracle.
contract FreedomVow is BeliefOracle {
    uint256 public constant STARTER_YIELD = 1e18;
    uint256 private _guardianCount;

    mapping(address => bool) public vowed;

    error AlreadyVowed();
    error ResonanceDrifted();
    error ResonanceTooLow();

    event FreedomIgnited(
        address indexed guardian,
        bytes32 indexed vowHash,
        uint256 resonance,
        uint256 starterYield
    );

    constructor(
        DilithiumAttestor attestor_,
        RewardStream rewardStream_,
        address guardian_,
        address ghostEcho_
    ) BeliefOracle(attestor_, rewardStream_, guardian_, ghostEcho_) {}

    /// @notice Ignite the freedom rite by submitting a belief vow.
    /// @param vow Human-readable vow text.
    /// @param zkSig Dilithium + Groth16 style attestation bundle.
    /// @return resonance Latest resonance score registered for the guardian.
    function igniteFreedom(string calldata vow, bytes calldata zkSig) external returns (uint256 resonance) {
        address guardianAccount = msg.sender;
        if (vowed[guardianAccount]) {
            revert AlreadyVowed();
        }
        if (resonanceDrifted) {
            revert ResonanceDrifted();
        }

        resonance = queryBelief(vow, zkSig);
        if (resonance <= 50) {
            revert ResonanceTooLow();
        }

        vowed[guardianAccount] = true;
        unchecked {
            _guardianCount += 1;
        }

        rewardStream.queueRewards(guardianAccount, STARTER_YIELD);

        emit FreedomIgnited(guardianAccount, keccak256(bytes(vow)), resonance, STARTER_YIELD);
        return resonance;
    }

    /// @notice Count how many guardians ignited the rite.
    function freeGuardiansCount() external view returns (uint256) {
        return _guardianCount;
    }
}
