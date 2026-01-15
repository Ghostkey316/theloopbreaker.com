// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IRiscZeroVerifier.sol";

/**
 * @title DilithiumAttestor
 * @notice Belief attestation contract with RISC Zero STARK proof verification
 * @dev Allows users to attest to beliefs with privacy-preserving ZK proofs
 */
contract DilithiumAttestor {
    // RISC Zero verifier contract
    IRiscZeroVerifier public immutable riscZeroVerifier;

    // Expected image ID of the guest program
    bytes32 public immutable beliefGuestImageId;

    // Whether ZK verification is enabled (can be toggled for testing)
    bool public zkEnabled;

    // Contract owner (for admin functions)
    address public owner;

    // Mapping of belief hash to attestation status
    mapping(bytes32 => bool) public sovereignBeliefs;

    // Mapping of user => belief hash => attestation timestamp
    mapping(address => mapping(bytes32 => uint256)) public userAttestations;

    /**
     * @notice Emitted when a belief is attested
     * @param beliefHash Keccak256 hash of the belief text
     * @param prover Address that created the attestation
     * @param zkVerified Whether the ZK proof was verified
     * @param timestamp When the attestation was created
     */
    event BeliefAttested(
        bytes32 indexed beliefHash,
        address indexed prover,
        bool zkVerified,
        uint256 timestamp
    );

    /**
     * @notice Emitted when ZK verification is toggled
     * @param enabled New ZK verification status
     */
    event ZKVerificationToggled(bool enabled);

    constructor(
        address _riscZeroVerifier,
        bytes32 _beliefGuestImageId,
        bool _zkEnabled
    ) {
        require(_riscZeroVerifier != address(0), "Invalid verifier address");
        riscZeroVerifier = IRiscZeroVerifier(_riscZeroVerifier);
        beliefGuestImageId = _beliefGuestImageId;
        zkEnabled = _zkEnabled;
        owner = msg.sender;
    }

    /**
     * @notice Attest to a belief with a ZK proof
     * @param beliefHash Keccak256 hash of the belief text
     * @param zkProofBundle Encoded proof bundle (seal + journal digest)
     */
    function attestBelief(
        bytes32 beliefHash,
        bytes calldata zkProofBundle
    ) external {
        require(beliefHash != bytes32(0), "Invalid belief hash");

        bool zkVerified = false;

        if (zkEnabled) {
            // Decode the proof bundle
            (bytes memory seal, bytes32 journalDigest) = abi.decode(
                zkProofBundle,
                (bytes, bytes32)
            );

            // Verify the RISC Zero STARK proof
            require(
                seal.length >= 32,
                "Invalid proof seal"
            );

            zkVerified = riscZeroVerifier.verify(
                seal,
                beliefGuestImageId,
                journalDigest
            );

            require(zkVerified, "ZK proof verification failed");
        }

        // Mark the belief as sovereign (attested)
        sovereignBeliefs[beliefHash] = true;

        // Record user's attestation timestamp
        userAttestations[msg.sender][beliefHash] = block.timestamp;

        emit BeliefAttested(
            beliefHash,
            msg.sender,
            zkVerified,
            block.timestamp
        );
    }

    /**
     * @notice Check if a belief has been attested (is sovereign)
     * @param beliefHash Keccak256 hash of the belief text
     * @return True if the belief has been attested
     */
    function isBeliefSovereign(bytes32 beliefHash) external view returns (bool) {
        return sovereignBeliefs[beliefHash];
    }

    /**
     * @notice Get the timestamp when a user attested to a belief
     * @param user The user's address
     * @param beliefHash The belief hash
     * @return Timestamp of attestation (0 if not attested)
     */
    function getUserAttestationTime(
        address user,
        bytes32 beliefHash
    ) external view returns (uint256) {
        return userAttestations[user][beliefHash];
    }

    /**
     * @notice Toggle ZK verification on/off (owner only)
     * @param _enabled New ZK verification status
     */
    function setZKEnabled(bool _enabled) external {
        require(msg.sender == owner, "Only owner can toggle ZK verification");
        zkEnabled = _enabled;
        emit ZKVerificationToggled(_enabled);
    }

    /**
     * @notice Transfer ownership (owner only)
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Only owner can transfer ownership");
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}
