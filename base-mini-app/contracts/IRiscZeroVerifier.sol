// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRiscZeroVerifier
 * @notice Interface for RISC Zero STARK proof verification
 * @dev This interface matches the RISC Zero verifier contract deployed on Base
 */
interface IRiscZeroVerifier {
    /**
     * @notice Verify a RISC Zero STARK proof
     * @param seal The proof seal bytes
     * @param imageId The expected image ID of the guest program
     * @param journalDigest The digest of the journal (public outputs)
     * @return True if the proof is valid
     */
    function verify(
        bytes calldata seal,
        bytes32 imageId,
        bytes32 journalDigest
    ) external view returns (bool);
}
