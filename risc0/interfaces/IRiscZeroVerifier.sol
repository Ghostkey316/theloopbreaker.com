// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.25;

// =============================================================================
//  IRiscZeroVerifier — Interface for the RISC Zero on-chain verifier
// =============================================================================
//
//  This interface matches the production RiscZeroVerifierRouter deployed by
//  RISC Zero on Base Mainnet (chain ID 8453) at:
//
//      0x0b144e07a0826182b6b59788c34b32bfa86fb711
//
//  IMPORTANT: The `verify` function REVERTS on invalid proofs.  It does NOT
//  return a boolean.  Callers must use try/catch if they want to handle
//  failure gracefully rather than propagating the revert.
//
//  Source: https://github.com/risc0/risc0-ethereum/blob/main/contracts/src/IRiscZeroVerifier.sol
// =============================================================================

/// @notice A receipt attesting to a claim using the RISC Zero proof system.
struct Receipt {
    bytes seal;
    bytes32 claimDigest;
}

/// @notice Verifier interface for RISC Zero receipts of execution.
interface IRiscZeroVerifier {
    /// @notice Verify that the given seal is a valid RISC Zero proof of
    ///         execution with the given image ID and journal digest.
    ///         Reverts on failure.
    /// @dev This method additionally ensures that the input hash is all-zeros
    ///      (i.e. no committed input), the exit code is (Halted, 0), and there
    ///      are no assumptions (i.e. the receipt is unconditional).
    /// @param seal The encoded cryptographic proof (i.e. SNARK).
    /// @param imageId The identifier for the guest program.
    /// @param journalDigest The SHA-256 digest of the journal bytes.
    function verify(
        bytes calldata seal,
        bytes32 imageId,
        bytes32 journalDigest
    ) external view;

    /// @notice Verify that the given receipt is a valid RISC Zero receipt.
    ///         Reverts on failure.
    /// @param receipt The receipt to be verified.
    function verifyIntegrity(Receipt calldata receipt) external view;
}
