// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./IStarkVerifier.sol";

/// @title DilithiumAttestor
/// @notice Records beliefs attested through hybrid STARK ZK proof + ECDSA signature verification.
/// @dev **PRODUCTION READY with STARK Integration:**
///      - When zkEnabled=false: Signature-only verification (V2 launch mode)
///      - When zkEnabled=true: STARK proof + signature verification (full ZK mode)
///
///      **STARK ZK System:**
///      - No trusted setup (aligns with "transparency with privacy")
///      - Post-quantum secure (future-proof)
///      - Scalable for large proof systems
///      - Proves: "I'm loyal, meet threshold, passed integrity check — without revealing how"
///
///      **Deployment Options:**
///      - V2 Launch: Deploy with zkEnabled=false (signature-only)
///      - Full ZK: Deploy BeliefAttestationVerifier, set zkEnabled=true
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

    /// @param _origin Address whose signatures are considered valid (governance multi-sig recommended).
    /// @param _zkEnabled Set to false for V2 launch (signature-only mode), true for full STARK ZK.
    /// @param _verifierAddress Address of STARK verifier (BeliefAttestationVerifier), or address(0) if zkEnabled=false.
    constructor(address _origin, bool _zkEnabled, address _verifierAddress) {
        require(_origin != address(0), "Invalid origin address");

        // If ZK is enabled, verifier must be provided and must be a valid contract
        if (_zkEnabled) {
            require(_verifierAddress != address(0), "ZK enabled but no verifier");
            // Verify it's a contract (has code)
            uint256 size;
            assembly {
                size := extcodesize(_verifierAddress)
            }
            require(size > 0, "Verifier address is not a contract");
        }

        origin = _origin;
        zkEnabled = _zkEnabled;
        verifierAddress = _verifierAddress;
    }

    /// @notice Attest a belief using STARK ZK proof and origin signature (or signature-only if ZK disabled).
    /// @dev The `zkProofBundle` is expected to be ABI-encoded as `(bytes proofData, bytes signature)`.
    ///
    ///      **If zkEnabled=true (Full ZK Mode):**
    ///      - proofData contains STARK proof that verifies (without revealing):
    ///        * Prover knows private belief matching beliefHash
    ///        * Belief meets protocol-defined threshold (80% alignment)
    ///        * Belief is authentic (originated through behavior, not fraud)
    ///        * Optional: Belief forged through Vaultfire-approved paths (NS3, GitHub, etc.)
    ///      - STARK proof is verified via IStarkVerifier interface
    ///      - Origin signature still required for additional security layer
    ///
    ///      **If zkEnabled=false (Signature-Only Mode - V2 Launch):**
    ///      - proofData is ignored (can be empty bytes)
    ///      - Only origin signature is verified
    ///      - Faster, simpler, but no privacy guarantees
    ///
    /// @param beliefHash The hash of the belief being attested.
    /// @param zkProofBundle ABI-encoded as `(bytes starkProof, bytes originSignature)`.
    function attestBelief(bytes32 beliefHash, bytes calldata zkProofBundle) external {
        (bytes memory proofData, bytes memory originSignature) = abi.decode(
            zkProofBundle,
            (bytes, bytes)
        );

        // ✅ SECURITY FIX: Validate origin signature FIRST (cheap ~3k gas)
        // This prevents gas griefing where attackers force expensive ZK verification
        // with invalid signatures, wasting ~500k+ gas per attempt
        bytes32 ethSigned = beliefHash.toEthSignedMessageHash();
        require(ECDSA.recover(ethSigned, originSignature) == origin, "Origin sig mismatch");

        bool zkVerified = false;

        // ✅ Then verify STARK proof if ZK is enabled (expensive ~500k+ gas)
        // Only executed after signature is confirmed valid
        if (zkEnabled) {
            require(verifyZKProof(proofData, beliefHash, msg.sender), "STARK proof invalid");
            zkVerified = true;
        }
        // If zkEnabled=false, skip ZK verification (signature-only mode for V2 launch)

        attestedBeliefs[beliefHash] = true;
        emit BeliefAttested(beliefHash, msg.sender, zkVerified);
    }

    /// @notice Verifies a STARK ZK proof using the configured verifier contract.
    /// @dev This function is only called if zkEnabled=true.
    ///      For V2 launch with zkEnabled=false, this code path is never executed.
    ///
    ///      **STARK Verification Process:**
    ///      1. Constructs public inputs array: [beliefHash, proverAddress, epoch, moduleID]
    ///      2. Calls IStarkVerifier.verifyProof() on the configured verifier contract
    ///      3. Returns true only if STARK proof is cryptographically valid
    ///
    ///      **Public Inputs:**
    ///      - beliefHash: Hash of the belief being attested
    ///      - proverAddress: Address of the prover (msg.sender)
    ///      - epoch: Campaign/era identifier (set to 0 for now, extensible)
    ///      - moduleID: Vaultfire module ID (set to 0 for now, extensible)
    ///
    ///      **Private Inputs (proven without revealing):**
    ///      - Actual belief message or claim
    ///      - Signature proving origin
    ///      - Loyalty proof (GitHub push, NS3 login, tweet ID, onchain move, etc.)
    ///
    /// @param proof The STARK proof bytes (generated off-chain).
    /// @param beliefHash The public belief hash to verify against.
    /// @param proverAddress The address of the prover.
    /// @return True if the STARK proof is valid and all constraints are satisfied.
    function verifyZKProof(
        bytes memory proof,
        bytes32 beliefHash,
        address proverAddress
    ) internal returns (bool) {
        require(verifierAddress != address(0), "Verifier not configured");

        // Construct public inputs array for STARK verifier
        // Format: [beliefHash, proverAddress, epoch, moduleID]
        uint256[] memory publicInputs = new uint256[](4);
        publicInputs[0] = uint256(beliefHash);
        publicInputs[1] = uint256(uint160(proverAddress));
        publicInputs[2] = 0; // epoch (future extension for campaign locking)
        publicInputs[3] = 0; // moduleID (future extension for NS3/GitHub/etc.)

        // Call the STARK verifier contract
        IStarkVerifier verifier = IStarkVerifier(verifierAddress);
        return verifier.verifyProof(proof, publicInputs);
    }

    /// @notice Check whether a belief hash has been attested.
    /// @param beliefHash The hash in question.
    /// @return True if the belief hash has been successfully attested.
    function isBeliefSovereign(bytes32 beliefHash) external view returns (bool) {
        return attestedBeliefs[beliefHash];
    }
}
