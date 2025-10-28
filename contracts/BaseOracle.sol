// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Vaultfire Base Oracle
/// @notice Emits CID and zkHash attestations for live visualizations.
contract BaseOracle {
    /// @dev Guardian allowed to emit events.
    address public immutable guardian;

    /// @dev Event raised whenever a new visualization is pinned on-chain.
    event VisualizationPinned(address indexed guardian, string cid, string zkHash, uint256 timestamp);

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
}
