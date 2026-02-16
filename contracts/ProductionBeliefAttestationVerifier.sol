// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRiscZeroVerifier} from "./IRiscZeroVerifier.sol";
import {IStarkVerifier} from "./IStarkVerifier.sol";

// =============================================================================
//
//  ProductionBeliefAttestationVerifier
//  ====================================
//
//  Production-grade RISC Zero verifier for the Vaultfire belief attestation
//  protocol.  This contract replaces the development-mode
//  BeliefAttestationVerifier that reverts on mainnet (chain ID != 31337).
//
//  Architecture
//  ------------
//  1. Off-chain: The RISC Zero guest program (Rust) validates a belief
//     attestation inside the zkVM and commits the verified data to a journal.
//  2. Off-chain: Boundless (or local prover) generates a Groth16 SNARK that
//     wraps the STARK execution trace.
//  3. On-chain: This contract calls the RISC Zero RiscZeroVerifierRouter
//     deployed on Base Mainnet to verify the SNARK seal.
//
//  The contract stores:
//    - The address of the RISC Zero verifier router (immutable).
//    - The expected image ID (hash of the compiled guest program).
//    - A record of every successfully verified attestation.
//
//  Security Enhancements (Audit 2026)
//  -----------------------------------
//  - TIMELOCK: Image ID changes require a 48-hour delay between proposal
//    and execution.  This prevents malicious instant changes and gives
//    stakeholders time to review proposed upgrades.
//
//  Compatibility
//  -------------
//  Implements IStarkVerifier so it can be used as a drop-in replacement
//  wherever the existing Vaultfire contracts reference the verifier.
//
//  Base Mainnet Addresses
//  ----------------------
//  RiscZeroVerifierRouter : 0x0b144e07a0826182b6b59788c34b32bfa86fb711
//
// =============================================================================

contract ProductionBeliefAttestationVerifier is IStarkVerifier {

    // =========================================================================
    //  Errors
    // =========================================================================

    error ZeroAddress();
    error ZeroImageId();
    error InvalidPublicInputsCount();
    error InvalidBeliefHash();
    error InvalidAttesterAddress();
    error InvalidEpoch();
    error EmptyProof();
    error ProofVerificationFailed(string reason);
    error OnlyOwner();
    error TimelockNotExpired();
    error NoPendingImageId();
    error ImageIdAlreadyPending();

    // =========================================================================
    //  Events
    // =========================================================================

    /// @notice Emitted when a belief attestation proof is verified successfully.
    event AttestationVerified(
        bytes32 indexed beliefHash,
        address indexed attester,
        uint256 epoch,
        uint256 moduleId,
        uint256 beliefScore,
        uint256 timestamp
    );

    /// @notice Emitted when proof verification fails (try/catch path).
    event VerificationFailed(
        bytes32 indexed beliefHash,
        address indexed attester,
        string reason
    );

    /// @notice Emitted when the image ID is updated by the owner.
    event ImageIdUpdated(
        bytes32 indexed oldImageId,
        bytes32 indexed newImageId
    );

    /// @notice Emitted when a new image ID is proposed (timelock starts).
    event ImageIdChangeProposed(
        bytes32 indexed currentImageId,
        bytes32 indexed proposedImageId,
        uint256 effectiveAt
    );

    /// @notice Emitted when a pending image ID proposal is cancelled.
    event ImageIdChangeCancelled(
        bytes32 indexed cancelledImageId
    );

    /// @notice Emitted when contract ownership is transferred.
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // =========================================================================
    //  Structs
    // =========================================================================

    /// @notice Record of a verified belief attestation.
    struct VerifiedAttestation {
        bytes32 beliefHash;
        address attester;
        uint256 epoch;
        uint256 moduleId;
        uint256 beliefScore;
        uint256 verifiedAt;
        bool    exists;
    }

    // =========================================================================
    //  Constants
    // =========================================================================

    /// @notice Proof system version identifier.
    string public constant PROOF_SYSTEM_ID =
        "RISC0-STARK-BeliefAttestation-Production-v2.0";

    /// @notice Number of public inputs expected by the legacy interface.
    uint256 public constant PUBLIC_INPUTS_COUNT = 4;

    /// @notice Minimum belief threshold in basis points (80%).
    uint256 public constant MIN_BELIEF_THRESHOLD = 8000;

    /// @notice Maximum epoch value.
    uint256 public constant MAX_EPOCH = type(uint32).max;

    /// @notice Timelock delay for image ID changes (48 hours).
    /// @dev Security audit recommendation: prevents instant malicious changes.
    uint256 public constant IMAGE_ID_TIMELOCK_DELAY = 48 hours;

    // =========================================================================
    //  Immutable State
    // =========================================================================

    /// @notice The RISC Zero verifier router contract (immutable for security).
    /// @dev On Base Mainnet: 0x0b144e07a0826182b6b59788c34b32bfa86fb711
    IRiscZeroVerifier public immutable riscZeroVerifier;

    // =========================================================================
    //  Mutable State
    // =========================================================================

    /// @notice Owner address — can update the image ID.
    address public owner;

    /// @notice Image ID of the compiled guest program.
    /// @dev This is the hash of the RISC Zero ELF binary.  It can be updated
    ///      by the owner when the guest program is upgraded.
    bytes32 public imageId;

    /// @notice Total number of verified attestations.
    uint256 public attestationCount;

    /// @notice Mapping from attestation key to verified record.
    /// @dev Key = keccak256(abi.encodePacked(beliefHash, attester, epoch))
    mapping(bytes32 => VerifiedAttestation) public attestations;

    /// @notice Mapping to check if an attester has a verified attestation
    ///         for a given belief hash.
    mapping(bytes32 => mapping(address => bool)) public hasAttestation;

    // =========================================================================
    //  Timelock State
    // =========================================================================

    /// @notice The proposed new image ID (pending timelock).
    bytes32 public pendingImageId;

    /// @notice Timestamp when the pending image ID becomes effective.
    /// @dev Zero means no pending change.
    uint256 public pendingImageIdEffectiveAt;

    // =========================================================================
    //  Modifiers
    // =========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // =========================================================================
    //  Constructor
    // =========================================================================

    /// @notice Deploy the production belief attestation verifier.
    /// @param _riscZeroVerifier Address of the RiscZeroVerifierRouter on the
    ///        target chain.
    /// @param _imageId Image ID of the compiled belief attestation guest
    ///        program.  Obtain this from `cargo risczero build` output.
    constructor(address _riscZeroVerifier, bytes32 _imageId) {
        if (_riscZeroVerifier == address(0)) revert ZeroAddress();
        if (_imageId == bytes32(0)) revert ZeroImageId();

        riscZeroVerifier = IRiscZeroVerifier(_riscZeroVerifier);
        imageId = _imageId;
        owner = msg.sender;

        emit OwnershipTransferred(address(0), msg.sender);
        emit ImageIdUpdated(bytes32(0), _imageId);
    }

    // =========================================================================
    //  IStarkVerifier Implementation (Legacy Interface)
    // =========================================================================

    /// @inheritdoc IStarkVerifier
    function verifyProof(
        bytes calldata proofBytes,
        uint256[] calldata publicInputs
    ) external override returns (bool) {
        if (publicInputs.length != PUBLIC_INPUTS_COUNT)
            revert InvalidPublicInputsCount();

        bytes32 beliefHash   = bytes32(publicInputs[0]);
        address attester     = address(uint160(publicInputs[1]));
        uint256 epoch        = publicInputs[2];
        uint256 moduleId     = publicInputs[3];

        if (beliefHash == bytes32(0)) revert InvalidBeliefHash();
        if (attester == address(0))   revert InvalidAttesterAddress();
        if (epoch > MAX_EPOCH)        revert InvalidEpoch();

        return _verifyAndRecord(proofBytes, beliefHash, attester, epoch, moduleId);
    }

    // =========================================================================
    //  Direct Verification (Preferred Interface)
    // =========================================================================

    /// @notice Verify a belief attestation proof and record the result.
    function verifyAttestation(
        bytes calldata seal,
        bytes calldata journalData
    ) external returns (bool verified) {
        if (seal.length == 0) revert EmptyProof();

        bytes32 journalDigest = sha256(journalData);

        try riscZeroVerifier.verify(seal, imageId, journalDigest) returns (bool) {
            (
                bytes32 beliefHash,
                address attester,
                uint32  epoch,
                uint32  moduleId,
                uint32  beliefScore,
                uint64  timestamp
            ) = abi.decode(
                journalData,
                (bytes32, address, uint32, uint32, uint32, uint64)
            );

            _recordAttestation(
                beliefHash, attester, epoch, moduleId, beliefScore, timestamp
            );

            return true;
        } catch Error(string memory reason) {
            emit VerificationFailed(bytes32(0), msg.sender, reason);
            return false;
        } catch {
            emit VerificationFailed(bytes32(0), msg.sender, "Verifier reverted");
            return false;
        }
    }

    // =========================================================================
    //  Internal Verification Logic
    // =========================================================================

    function _verifyAndRecord(
        bytes calldata seal,
        bytes32 beliefHash,
        address attester,
        uint256 epoch,
        uint256 moduleId
    ) internal returns (bool) {
        if (seal.length == 0) revert EmptyProof();

        bytes memory journal = abi.encode(
            beliefHash,
            attester,
            uint32(epoch),
            uint32(moduleId)
        );

        bytes32 journalDigest = sha256(journal);

        try riscZeroVerifier.verify(seal, imageId, journalDigest) returns (bool) {
            _recordAttestation(
                beliefHash,
                attester,
                epoch,
                moduleId,
                MIN_BELIEF_THRESHOLD,
                block.timestamp
            );

            return true;
        } catch Error(string memory reason) {
            emit VerificationFailed(beliefHash, attester, reason);
            return false;
        } catch {
            emit VerificationFailed(beliefHash, attester, "Verifier reverted");
            return false;
        }
    }

    function _recordAttestation(
        bytes32 beliefHash,
        address attester,
        uint256 epoch,
        uint256 moduleId,
        uint256 beliefScore,
        uint256 timestamp
    ) internal {
        bytes32 key = keccak256(
            abi.encodePacked(beliefHash, attester, epoch)
        );

        attestations[key] = VerifiedAttestation({
            beliefHash:  beliefHash,
            attester:    attester,
            epoch:       epoch,
            moduleId:    moduleId,
            beliefScore: beliefScore,
            verifiedAt:  timestamp,
            exists:      true
        });

        hasAttestation[beliefHash][attester] = true;
        attestationCount++;

        emit AttestationVerified(
            beliefHash, attester, epoch, moduleId, beliefScore, timestamp
        );
    }

    // =========================================================================
    //  View Functions
    // =========================================================================

    function getAttestation(
        bytes32 beliefHash,
        address attester,
        uint256 epoch
    ) external view returns (VerifiedAttestation memory) {
        bytes32 key = keccak256(
            abi.encodePacked(beliefHash, attester, epoch)
        );
        return attestations[key];
    }

    function isAttested(
        bytes32 beliefHash,
        address attester
    ) external view returns (bool) {
        return hasAttestation[beliefHash][attester];
    }

    /// @inheritdoc IStarkVerifier
    function getPublicInputsCount() external pure override returns (uint256) {
        return PUBLIC_INPUTS_COUNT;
    }

    /// @inheritdoc IStarkVerifier
    function getProofSystemId() external pure override returns (string memory) {
        return PROOF_SYSTEM_ID;
    }

    function getMinBeliefThreshold() external pure returns (uint256) {
        return MIN_BELIEF_THRESHOLD;
    }

    function getRiscZeroVerifier() external view returns (address) {
        return address(riscZeroVerifier);
    }

    function getImageId() external view returns (bytes32) {
        return imageId;
    }

    function getTimelockDelay() external pure returns (uint256) {
        return IMAGE_ID_TIMELOCK_DELAY;
    }

    /// @notice Returns pending image ID change details.
    function getPendingImageIdChange() external view returns (
        bytes32 pendingId,
        uint256 effectiveAt,
        bool isReady
    ) {
        pendingId = pendingImageId;
        effectiveAt = pendingImageIdEffectiveAt;
        isReady = pendingImageId != bytes32(0) &&
                  block.timestamp >= pendingImageIdEffectiveAt;
    }

    // =========================================================================
    //  Owner Functions — Timelocked Image ID Updates
    // =========================================================================

    /// @notice Propose a new image ID.  The change takes effect after the
    ///         timelock delay (48 hours).
    function proposeImageIdChange(bytes32 _newImageId) external onlyOwner {
        if (_newImageId == bytes32(0)) revert ZeroImageId();
        if (pendingImageId != bytes32(0)) revert ImageIdAlreadyPending();

        pendingImageId = _newImageId;
        pendingImageIdEffectiveAt = block.timestamp + IMAGE_ID_TIMELOCK_DELAY;

        emit ImageIdChangeProposed(imageId, _newImageId, pendingImageIdEffectiveAt);
    }

    /// @notice Execute a pending image ID change after the timelock has expired.
    function executeImageIdChange() external onlyOwner {
        if (pendingImageId == bytes32(0)) revert NoPendingImageId();
        if (block.timestamp < pendingImageIdEffectiveAt) revert TimelockNotExpired();

        bytes32 oldImageId = imageId;
        bytes32 newImageId = pendingImageId;

        imageId = newImageId;
        pendingImageId = bytes32(0);
        pendingImageIdEffectiveAt = 0;

        emit ImageIdUpdated(oldImageId, newImageId);
    }

    /// @notice Cancel a pending image ID change.
    function cancelImageIdChange() external onlyOwner {
        if (pendingImageId == bytes32(0)) revert NoPendingImageId();

        bytes32 cancelledId = pendingImageId;
        pendingImageId = bytes32(0);
        pendingImageIdEffectiveAt = 0;

        emit ImageIdChangeCancelled(cancelledId);
    }

    /// @notice Transfer ownership of the contract.
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();

        address oldOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(oldOwner, _newOwner);
    }
}
