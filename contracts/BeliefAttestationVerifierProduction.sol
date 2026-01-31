// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IStarkVerifier.sol";
import "./IRiscZeroVerifier.sol";

/// @title BeliefAttestationVerifierProduction
/// @notice PRODUCTION-READY RISC Zero STARK-based verifier for Vaultfire belief attestation
/// @dev This is the PRODUCTION VERSION with real RISC Zero integration
///
///      **SECURITY STATUS: PRODUCTION READY** ✅
///      This verifier integrates with real RISC Zero STARK verifier for
///      cryptographically secure zero-knowledge belief attestation.
///
///      **Differences from Development Version:**
///      - Uses real RISC Zero verifier contract (not placeholder)
///      - Rejects invalid proofs (no development bypass)
///      - Immutable verifier and imageId (set at deployment)
///      - Production-grade error handling
///
/// @custom:security-review MUST audit RISC Zero verifier deployment address
/// @custom:security-review MUST verify imageId matches deployed guest program
contract BeliefAttestationVerifierProduction is IStarkVerifier {
    /// @notice RISC Zero verifier contract (immutable for security)
    IRiscZeroVerifier public immutable riscZeroVerifier;

    /// @notice Image ID of the Vaultfire belief attestation guest program
    /// @dev This is the hash of the compiled RISC Zero guest program
    ///      Generated during guest program compilation: `cargo build --release`
    bytes32 public immutable beliefCircuitImageId;

    /// @notice Proof system version identifier
    string public constant PROOF_SYSTEM_ID = "RISC0-STARK-BeliefAttestation-Production-v1.0";

    /// @notice Number of public inputs expected by this verifier
    /// @dev [0]: beliefHash, [1]: proverAddress, [2]: epoch, [3]: moduleID
    uint256 public constant PUBLIC_INPUTS_COUNT = 4;

    /// @notice Minimum belief threshold (basis points, 10000 = 100%)
    uint256 public constant MIN_BELIEF_THRESHOLD = 8000; // 80% alignment

    /// @notice Maximum epoch value (for campaign locking)
    uint256 public constant MAX_EPOCH = type(uint32).max;

    /// @notice Emitted when a proof is verified successfully
    event ProofVerified(
        bytes32 indexed beliefHash,
        address indexed proverAddress,
        uint256 epoch,
        uint256 moduleID,
        uint256 timestamp
    );

    /// @notice Emitted when proof verification fails
    event ProofVerificationFailed(
        bytes32 indexed beliefHash,
        address indexed proverAddress,
        string reason,
        uint256 timestamp
    );

    /**
     * @notice Deploy production belief attestation verifier
     * @dev Sets immutable RISC Zero verifier and image ID
     *
     * @param _riscZeroVerifier Address of deployed RISC Zero verifier contract
     * @param _beliefCircuitImageId Image ID of compiled belief attestation guest program
     *
     * **Deployment Checklist:**
     * 1. Deploy/locate RISC Zero verifier contract on target chain
     * 2. Compile belief attestation guest program: `cd risc0-prover && cargo build --release`
     * 3. Extract imageId from build output
     * 4. Deploy this contract with verifier address and imageId
     * 5. Verify deployment on Etherscan
     * 6. Test with known-good and known-bad proofs
     *
     * **CRITICAL SECURITY:**
     * - verifier address MUST be verified RISC Zero contract
     * - imageId MUST match the actual deployed guest program
     * - Both are immutable and cannot be changed after deployment
     */
    constructor(address _riscZeroVerifier, bytes32 _beliefCircuitImageId) {
        require(_riscZeroVerifier != address(0), "Invalid verifier address");
        require(_beliefCircuitImageId != bytes32(0), "Invalid image ID");

        riscZeroVerifier = IRiscZeroVerifier(_riscZeroVerifier);
        beliefCircuitImageId = _beliefCircuitImageId;
    }

    /**
     * @notice Verifies a STARK proof for belief attestation
     * @dev PRODUCTION VERSION - Uses real RISC Zero verifier
     *
     *      **Circuit Logic (what the STARK proof verifies):**
     *      1. hash(beliefMessage) == publicInput[0] (beliefHash)
     *      2. recover(signature, beliefHash) == publicInput[1] (proverAddress)
     *      3. computeBeliefScore(beliefMessage, loyaltyProof) >= MIN_BELIEF_THRESHOLD
     *      4. verifyLoyaltyProof(loyaltyProof, publicInput[3]) == true (moduleID check)
     *      5. publicInput[2] <= MAX_EPOCH (epoch validity)
     *
     *      **Security Properties:**
     *      - Zero-knowledge: beliefMessage and loyaltyProof remain private
     *      - Soundness: Cannot forge proof without valid private inputs
     *      - Completeness: Valid beliefs always verify successfully
     *      - Post-quantum: STARK proofs resist quantum attacks
     *
     * @param proofBytes The STARK proof (serialized from RISC Zero prover)
     * @param publicInputs Array of public inputs [beliefHash, proverAddress, epoch, moduleID]
     * @return True if proof is valid and all circuit constraints are satisfied
     */
    function verifyProof(
        bytes calldata proofBytes,
        uint256[] calldata publicInputs
    ) external override returns (bool) {
        // Validate public inputs count
        require(publicInputs.length == PUBLIC_INPUTS_COUNT, "Invalid public inputs count");

        // Extract public inputs
        bytes32 beliefHash = bytes32(publicInputs[0]);
        address proverAddress = address(uint160(publicInputs[1]));
        uint256 epoch = publicInputs[2];
        uint256 moduleID = publicInputs[3];

        // Validate public input ranges
        require(beliefHash != bytes32(0), "Invalid belief hash");
        require(proverAddress != address(0), "Invalid prover address");
        require(epoch <= MAX_EPOCH, "Invalid epoch");

        // Verify STARK proof using RISC Zero
        bool proofValid = _verifyRiscZeroProof(proofBytes, beliefHash, proverAddress, epoch, moduleID);

        if (proofValid) {
            emit ProofVerified(beliefHash, proverAddress, epoch, moduleID, block.timestamp);
        } else {
            emit ProofVerificationFailed(beliefHash, proverAddress, "STARK proof verification failed", block.timestamp);
        }

        return proofValid;
    }

    /**
     * @notice Internal RISC Zero STARK proof verification
     * @dev PRODUCTION IMPLEMENTATION - Calls real RISC Zero verifier
     *
     *      **How RISC Zero Verification Works:**
     *      1. Guest program (ZK circuit) runs in RISC Zero zkVM
     *      2. Guest commits public inputs to journal: (beliefHash, proverAddress, epoch, moduleID)
     *      3. Prover generates STARK proof of correct execution
     *      4. This function verifies the proof on-chain
     *
     *      **Gas Cost:** ~61,000 gas (based on RISC Zero benchmarks)
     *
     * @param proofBytes The STARK proof data from RISC Zero prover
     * @param beliefHash Public input: hash of belief
     * @param proverAddress Public input: prover's address
     * @param epoch Public input: campaign/era identifier
     * @param moduleID Public input: Vaultfire module (NS3, GitHub, etc.)
     * @return True if STARK proof is valid
     */
    function _verifyRiscZeroProof(
        bytes calldata proofBytes,
        bytes32 beliefHash,
        address proverAddress,
        uint256 epoch,
        uint256 moduleID
    ) internal returns (bool) {
        // Validate proof is non-empty
        require(proofBytes.length > 0, "Empty proof");

        // Construct journal digest from public inputs
        // This MUST match what the guest program commits to its journal
        bytes32 journalDigest = keccak256(
            abi.encode(beliefHash, proverAddress, epoch, moduleID)
        );

        // Verify RISC Zero STARK proof
        // This calls the deployed RISC Zero verifier contract
        try riscZeroVerifier.verify(
            proofBytes,
            beliefCircuitImageId,
            journalDigest
        ) returns (bool valid) {
            return valid;
        } catch Error(string memory reason) {
            // RISC Zero verifier reverted with reason
            emit ProofVerificationFailed(beliefHash, proverAddress, reason, block.timestamp);
            return false;
        } catch (bytes memory) {
            // RISC Zero verifier reverted without reason
            emit ProofVerificationFailed(beliefHash, proverAddress, "Verifier reverted", block.timestamp);
            return false;
        }
    }

    /**
     * @notice Returns the number of public inputs expected
     * @return Number of public inputs (always 4 for belief attestation)
     */
    function getPublicInputsCount() external pure override returns (uint256) {
        return PUBLIC_INPUTS_COUNT;
    }

    /**
     * @notice Returns the proof system identifier
     * @return Proof system name and version
     */
    function getProofSystemId() external pure override returns (string memory) {
        return PROOF_SYSTEM_ID;
    }

    /**
     * @notice Gets the minimum belief threshold (for display/debugging)
     * @return Minimum threshold in basis points
     */
    function getMinBeliefThreshold() external pure returns (uint256) {
        return MIN_BELIEF_THRESHOLD;
    }

    /**
     * @notice Get the RISC Zero verifier address
     * @return Address of the RISC Zero verifier contract
     */
    function getRiscZeroVerifier() external view returns (address) {
        return address(riscZeroVerifier);
    }

    /**
     * @notice Get the belief circuit image ID
     * @return Image ID of the compiled guest program
     */
    function getBeliefCircuitImageId() external view returns (bytes32) {
        return beliefCircuitImageId;
    }

    /**
     * @notice Get the RISC Zero verifier version
     * @return Version string from RISC Zero verifier
     */
    function getRiscZeroVersion() external view returns (string memory) {
        return riscZeroVerifier.version();
    }
}
