// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title IStarkVerifier
/// @notice Interface for STARK proof verification
/// @dev STARKs provide transparent verification without trusted setup,
///      future-proof post-quantum security, and scalable proof systems.
///      This interface is compatible with StarkWare's verifier contracts.
interface IStarkVerifier {
    /// @notice Verifies a STARK proof against public inputs
    /// @param proofBytes The STARK proof data (serialized)
    /// @param publicInputs Array of public inputs (beliefHash, proverAddress, epoch, moduleID, etc.)
    /// @return True if the proof is valid and matches the public inputs
    function verifyProof(
        bytes calldata proofBytes,
        uint256[] calldata publicInputs
    ) external returns (bool);

    /// @notice Returns the number of public inputs expected by this verifier
    /// @return Number of public inputs
    function getPublicInputsCount() external view returns (uint256);

    /// @notice Returns the proof system identifier (for versioning/upgrades)
    /// @return Proof system name (e.g., "STARK-Fibonacci", "STARK-BeliefAttestation")
    function getProofSystemId() external view returns (string memory);
}
