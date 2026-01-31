// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title Vaultfire Base Oracle
/// @notice Emits CID and zkHash attestations for live visualizations.
contract BaseOracle {
    /// @dev Guardian allowed to emit events.
    address public immutable guardian;

    /// @dev Resonance threshold used by DAO governed mission evolutions (basis points).
    uint256 public constant RESONANCE_THRESHOLD_BPS = 5_100;

    /// @dev Event raised whenever a new visualization is pinned on-chain.
    event VisualizationPinned(address indexed guardian, string cid, string zkHash, uint256 timestamp);

    /// @dev Mission evolution event triggered by the DAO once quorum and threshold are met.
    event MissionEvoBroadcast(
        address indexed guardian,
        bytes32 indexed evoId,
        string[] virtues,
        uint256[] weights,
        uint256 thresholdBps,
        uint256 timestamp
    );

    constructor(address guardianAddress) {
        require(guardianAddress != address(0), "guardian_required");
        guardian = guardianAddress;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "guardian_only");
        _;
    }

    /// @notice Emit a visualization attestation to downstream Base listeners.
    /// @param cid IPFS CID returned by Pinata.
    /// @param zkHash Hash anchoring the redacted payload (ZK placeholder).
    /// @return attestationId Deterministic keccak for client reconciliation.
    function emitAttestation(string calldata cid, string calldata zkHash)
        external
        onlyGuardian
        returns (bytes32 attestationId)
    {
        attestationId = keccak256(abi.encodePacked(cid, zkHash, block.timestamp));
        emit VisualizationPinned(msg.sender, cid, zkHash, block.timestamp);
    }

    /// @notice Broadcast a mission evolution to downstream listeners after a successful DAO vote.
    /// @param virtues Ordered list of virtues being updated.
    /// @param weights Guardian supplied weight multipliers expressed in basis points.
    /// @return evoId Deterministic hash anchoring the mission evolution payload.
    function publishMissionEvo(string[] calldata virtues, uint256[] calldata weights)
        external
        onlyGuardian
        returns (bytes32 evoId)
    {
        require(virtues.length == weights.length, "mission_length");
        require(virtues.length != 0, "mission_empty");
        evoId = keccak256(abi.encode(virtues, weights, block.timestamp));
        emit MissionEvoBroadcast(msg.sender, evoId, virtues, weights, RESONANCE_THRESHOLD_BPS, block.timestamp);
    }
}
