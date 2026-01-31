// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {DilithiumAttestor} from "./DilithiumAttestor.sol";
import {RewardStream} from "./deprecated/RewardStream.sol";

/// @title BeliefOracle
/// @notice Gateway for resonance scoring backed by Dilithium attestations.
/// @dev Resonance values are deterministic and bounded [0, 100].
contract BeliefOracle {
    uint256 public constant MAX_RESONANCE = 100;
    uint256 public constant BONUS_THRESHOLD = 80;
    uint256 public constant BONUS_MULTIPLIER = 120;

    DilithiumAttestor public immutable attestor;
    RewardStream public immutable rewardStream;
    address public guardian;
    address public immutable ghostEcho;

    bool public resonanceDrifted;

    mapping(bytes32 => uint256) private _cachedResonance;
    mapping(address => uint256) public lastResonance;
    mapping(bytes32 => bool) public bonusApplied;

    event ResonanceQueried(
        address indexed seeker,
        bytes32 indexed vowHash,
        uint256 resonance,
        bool multiplierApplied
    );
    event ResonanceDriftSet(bool active, address indexed guardian);
    event GuardianUpdated(address indexed previousGuardian, address indexed newGuardian);

    error GuardianRequired();
    error LengthMismatch();

    modifier onlyGuardian() {
        if (msg.sender != guardian) {
            revert GuardianRequired();
        }
        _;
    }

    constructor(
        DilithiumAttestor attestor_,
        RewardStream rewardStream_,
        address guardian_,
        address ghostEcho_
    ) {
        if (address(attestor_) == address(0) || address(rewardStream_) == address(0)) {
            revert GuardianRequired();
        }
        if (guardian_ == address(0)) {
            revert GuardianRequired();
        }
        attestor = attestor_;
        rewardStream = rewardStream_;
        guardian = guardian_;
        ghostEcho = ghostEcho_;
    }

    /// @notice Toggle resonance drift protections.
    function setResonanceDrift(bool active) external onlyGuardian {
        resonanceDrifted = active;
        emit ResonanceDriftSet(active, msg.sender);
    }

    /// @notice Rotate the guardian responsible for drift controls.
    function updateGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) {
            revert GuardianRequired();
        }
        address previous = guardian;
        guardian = newGuardian;
        emit GuardianUpdated(previous, newGuardian);
    }

    /// @notice Query belief resonance and optionally vest RewardStream multipliers.
    function queryBelief(string memory vow, bytes calldata zkSig) public virtual returns (uint256) {
        bytes32 vowHash = keccak256(bytes(vow));
        attestor.attestBelief(vowHash, zkSig);

        uint256 resonance = _resolveResonance(vowHash, msg.sender);
        _cachedResonance[vowHash] = resonance;
        lastResonance[msg.sender] = resonance;

        bool applied;
        if (!resonanceDrifted && resonance > BONUS_THRESHOLD && !bonusApplied[vowHash]) {
            bonusApplied[vowHash] = true;
            try rewardStream.updateMultiplier(msg.sender, BONUS_MULTIPLIER) {
                applied = true;
            } catch {
                applied = false;
            }
        }

        emit ResonanceQueried(msg.sender, vowHash, resonance, applied);
        return resonance;
    }

    /// @notice Batch version for DAO orchestrations.
    function batchQuery(string[] calldata vows, bytes[] calldata zkSigs)
        external
        returns (uint256[] memory)
    {
        if (vows.length != zkSigs.length) {
            revert LengthMismatch();
        }
        uint256[] memory resonances = new uint256[](vows.length);
        for (uint256 i = 0; i < vows.length; ++i) {
            resonances[i] = queryBelief(vows[i], zkSigs[i]);
        }
        return resonances;
    }

    /// @notice Preview deterministic resonance without triggering attestations.
    function previewResonance(string calldata vow, address seeker) external view returns (uint256) {
        bytes32 vowHash = keccak256(bytes(vow));
        return _resolveResonance(vowHash, seeker);
    }

    /// @notice Return cached resonance for a vow hash, 0 if never queried.
    function cachedResonance(bytes32 vowHash) external view returns (uint256) {
        return _cachedResonance[vowHash];
    }

    function _resolveResonance(bytes32 vowHash, address seeker) internal view returns (uint256) {
        bytes32 digest = keccak256(abi.encodePacked(vowHash, seeker, ghostEcho));
        return uint256(digest) % (MAX_RESONANCE + 1);
    }
}
