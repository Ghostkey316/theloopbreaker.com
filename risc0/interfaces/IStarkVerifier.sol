// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// =============================================================================
//  IStarkVerifier — Legacy Vaultfire interface for STARK proof verification
// =============================================================================
//
//  This interface is preserved for backward compatibility with the existing
//  Vaultfire protocol contracts (DilithiumAttestor, etc.) that call
//  `verifyProof()` on the BeliefAttestationVerifier.
//
//  The ProductionBeliefAttestationVerifier implements this interface so it
//  can serve as a drop-in replacement for the development verifier.
// =============================================================================

interface IStarkVerifier {
    /// @notice Verifies a STARK proof against public inputs.
    /// @param proofBytes The STARK proof data (serialized).
    /// @param publicInputs Array of public inputs.
    /// @return True if the proof is valid and matches the public inputs.
    function verifyProof(
        bytes calldata proofBytes,
        uint256[] calldata publicInputs
    ) external returns (bool);

    /// @notice Returns the number of public inputs expected by this verifier.
    /// @return Number of public inputs.
    function getPublicInputsCount() external view returns (uint256);

    /// @notice Returns the proof system identifier (for versioning/upgrades).
    /// @return Proof system name and version string.
    function getProofSystemId() external view returns (string memory);
}
