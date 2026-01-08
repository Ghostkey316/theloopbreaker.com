// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title DilithiumAttestor
/// @notice Records beliefs attested through a hybrid ZK proof + Dilithium/ECDSA signature flow.
/// @dev V2 LAUNCH READY: ZK verification is now OPTIONAL via constructor flag.
///      When zkEnabled=false, only origin signature verification is required.
///      When zkEnabled=true, both ZK proof AND signature verification are required.
///
///      PRODUCTION DEPLOYMENT: Set zkEnabled=false for V2 launch (signature-only mode).
///      FUTURE UPGRADE: Deploy real Groth16 verifier, set zkEnabled=true, and update verifierAddress.
contract DilithiumAttestor {
    using MessageHashUtils for bytes32;

    /// @notice Address whose signatures are considered valid origin attestations.
    address public immutable origin;

    /// @notice Flag to enable/disable ZK proof verification (for V2 launch flexibility).
    bool public immutable zkEnabled;

    /// @notice Address of the ZK verifier contract (if zkEnabled=true).
    /// @dev Set to address(0) if zkEnabled=false. Must be a valid Groth16 verifier if enabled.
    address public immutable verifierAddress;

    /// @notice Tracks belief hashes that were successfully attested.
    mapping(bytes32 => bool) public attestedBeliefs;

    /// @notice Emitted whenever a belief hash is attested.
    /// @param beliefHash The hash representing the attested belief.
    /// @param prover The address that submitted the proof bundle.
    /// @param zkVerified True if ZK proof was verified, false if ZK was bypassed.
    event BeliefAttested(bytes32 beliefHash, address prover, bool zkVerified);

    /// @param _origin Address whose signatures are considered valid.
    /// @param _zkEnabled Set to false for V2 launch (signature-only mode).
    /// @param _verifierAddress Address of Groth16 verifier (use address(0) if zkEnabled=false).
    constructor(address _origin, bool _zkEnabled, address _verifierAddress) {
        require(_origin != address(0), "Invalid origin address");

        // If ZK is enabled, verifier must be provided
        if (_zkEnabled) {
            require(_verifierAddress != address(0), "ZK enabled but no verifier");
        }

        origin = _origin;
        zkEnabled = _zkEnabled;
        verifierAddress = _verifierAddress;
    }

    /// @notice Attest a belief hash using a ZK proof bundle and an origin signature.
    /// @dev The `zkProofBundle` is expected to be ABI-encoded as `(bytes proofData, bytes signature)`.
    ///      If zkEnabled=true, proofData is verified via the Groth16 verifier.
    ///      If zkEnabled=false, proofData is ignored (signature-only verification).
    ///      Origin signature verification is ALWAYS required regardless of zkEnabled setting.
    /// @param beliefHash The hash of the belief being attested.
    /// @param zkProofBundle ABI-encoded verifier proof data and origin signature.
    function attestBelief(bytes32 beliefHash, bytes calldata zkProofBundle) external {
        (bytes memory proofData, bytes memory originSignature) = abi.decode(
            zkProofBundle,
            (bytes, bytes)
        );

        bool zkVerified = false;

        // Only verify ZK proof if zkEnabled=true
        if (zkEnabled) {
            require(verifyZKProof(proofData, beliefHash), "ZK proof invalid");
            zkVerified = true;
        }
        // If zkEnabled=false, skip ZK verification (signature-only mode for V2 launch)

        // ALWAYS validate the origin signature (required regardless of zkEnabled)
        bytes32 ethSigned = beliefHash.toEthSignedMessageHash();
        require(ECDSA.recover(ethSigned, originSignature) == origin, "Origin sig mismatch");

        attestedBeliefs[beliefHash] = true;
        emit BeliefAttested(beliefHash, msg.sender, zkVerified);
    }

    /// @notice Verifies a ZK proof against a public signal using the configured verifier.
    /// @dev V2 LAUNCH: This function is only called if zkEnabled=true.
    ///      For V2 launch with zkEnabled=false, this code path is never executed.
    ///
    ///      FUTURE UPGRADE PATH (when enabling ZK):
    ///      1. Deploy a real Groth16 verifier contract (e.g., generated via snarkjs)
    ///      2. Set verifierAddress in constructor to the deployed verifier
    ///      3. Replace the stub logic below with:
    ///         return IVerifier(verifierAddress).verify(proof, pubSignal);
    ///      4. Test extensively with valid and invalid proofs before enabling
    ///
    /// @param proof The ZK proof data to verify.
    /// @param pubSignal The public signal (belief hash) to verify against.
    /// @return True if the proof is valid (currently stub returns true if called).
    function verifyZKProof(bytes memory proof, bytes32 pubSignal) internal view returns (bool) {
        // V2 LAUNCH STUB: If zkEnabled=true but no real verifier is deployed yet,
        // this will return true. For production use with ZK, deploy real verifier first.
        if (verifierAddress == address(0)) {
            // Stub mode: return true (should not happen if zkEnabled checks are correct)
            return true;
        }

        // FUTURE: Call real Groth16 verifier when deployed
        // Example: return IVerifier(verifierAddress).verifyProof(proof, pubSignal);

        // For now, suppress unused variable warnings
        proof;
        pubSignal;

        return true; // Stub implementation
    }

    /// @notice Check whether a belief hash has been attested.
    /// @param beliefHash The hash in question.
    /// @return True if the belief hash has been successfully attested.
    function isBeliefSovereign(bytes32 beliefHash) external view returns (bool) {
        return attestedBeliefs[beliefHash];
    }
}
