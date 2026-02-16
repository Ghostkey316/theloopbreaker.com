// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import {ProductionBeliefAttestationVerifier} from "../src/ProductionBeliefAttestationVerifier.sol";
import {IRiscZeroVerifier, Receipt} from "../interfaces/IRiscZeroVerifier.sol";

// =============================================================================
//  Mock RISC Zero Verifier
// =============================================================================
//  A mock that simulates the RiscZeroVerifierRouter for testing purposes.
//  In "accept" mode it does nothing (proof accepted); in "reject" mode it
//  reverts, matching the real verifier's behaviour.
// =============================================================================

contract MockRiscZeroVerifier is IRiscZeroVerifier {
    bool public shouldRevert;
    string public revertReason;

    function setRevert(bool _shouldRevert, string memory _reason) external {
        shouldRevert = _shouldRevert;
        revertReason = _reason;
    }

    function verify(
        bytes calldata,
        bytes32,
        bytes32
    ) external view override {
        if (shouldRevert) {
            revert(revertReason);
        }
        // Otherwise: proof accepted (no-op, matching real verifier)
    }

    function verifyIntegrity(Receipt calldata) external view override {
        if (shouldRevert) {
            revert(revertReason);
        }
    }
}

// =============================================================================
//  Test Suite
// =============================================================================

contract ProductionBeliefAttestationVerifierTest is Test {
    ProductionBeliefAttestationVerifier public verifier;
    MockRiscZeroVerifier public mockVerifier;

    bytes32 constant TEST_IMAGE_ID =
        0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
    bytes32 constant TEST_BELIEF_HASH =
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
    address constant TEST_ATTESTER = address(0xBEEF);
    uint256 constant TEST_EPOCH = 42;
    uint256 constant TEST_MODULE_ID = 1;

    function setUp() public {
        mockVerifier = new MockRiscZeroVerifier();
        verifier = new ProductionBeliefAttestationVerifier(
            address(mockVerifier),
            TEST_IMAGE_ID
        );
    }

    // -------------------------------------------------------------------------
    //  Constructor Tests
    // -------------------------------------------------------------------------

    function test_constructor_setsState() public view {
        assertEq(verifier.getRiscZeroVerifier(), address(mockVerifier));
        assertEq(verifier.getImageId(), TEST_IMAGE_ID);
        assertEq(verifier.owner(), address(this));
        assertEq(verifier.attestationCount(), 0);
    }

    function test_constructor_revertsOnZeroVerifier() public {
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.ZeroAddress.selector
        );
        new ProductionBeliefAttestationVerifier(address(0), TEST_IMAGE_ID);
    }

    function test_constructor_revertsOnZeroImageId() public {
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.ZeroImageId.selector
        );
        new ProductionBeliefAttestationVerifier(
            address(mockVerifier),
            bytes32(0)
        );
    }

    // -------------------------------------------------------------------------
    //  Legacy verifyProof Tests
    // -------------------------------------------------------------------------

    function test_verifyProof_success() public {
        uint256[] memory inputs = new uint256[](4);
        inputs[0] = uint256(TEST_BELIEF_HASH);
        inputs[1] = uint256(uint160(TEST_ATTESTER));
        inputs[2] = TEST_EPOCH;
        inputs[3] = TEST_MODULE_ID;

        bytes memory fakeSeal = hex"deadbeef";

        bool result = verifier.verifyProof(fakeSeal, inputs);
        assertTrue(result);
        assertEq(verifier.attestationCount(), 1);
        assertTrue(verifier.isAttested(TEST_BELIEF_HASH, TEST_ATTESTER));
    }

    function test_verifyProof_failsOnInvalidProof() public {
        mockVerifier.setRevert(true, "Invalid proof");

        uint256[] memory inputs = new uint256[](4);
        inputs[0] = uint256(TEST_BELIEF_HASH);
        inputs[1] = uint256(uint160(TEST_ATTESTER));
        inputs[2] = TEST_EPOCH;
        inputs[3] = TEST_MODULE_ID;

        bytes memory fakeSeal = hex"deadbeef";

        bool result = verifier.verifyProof(fakeSeal, inputs);
        assertFalse(result);
        assertEq(verifier.attestationCount(), 0);
    }

    function test_verifyProof_revertsOnWrongInputCount() public {
        uint256[] memory inputs = new uint256[](3);
        inputs[0] = uint256(TEST_BELIEF_HASH);
        inputs[1] = uint256(uint160(TEST_ATTESTER));
        inputs[2] = TEST_EPOCH;

        vm.expectRevert(
            ProductionBeliefAttestationVerifier
                .InvalidPublicInputsCount
                .selector
        );
        verifier.verifyProof(hex"deadbeef", inputs);
    }

    function test_verifyProof_revertsOnZeroBeliefHash() public {
        uint256[] memory inputs = new uint256[](4);
        inputs[0] = 0;
        inputs[1] = uint256(uint160(TEST_ATTESTER));
        inputs[2] = TEST_EPOCH;
        inputs[3] = TEST_MODULE_ID;

        vm.expectRevert(
            ProductionBeliefAttestationVerifier.InvalidBeliefHash.selector
        );
        verifier.verifyProof(hex"deadbeef", inputs);
    }

    function test_verifyProof_revertsOnZeroAttester() public {
        uint256[] memory inputs = new uint256[](4);
        inputs[0] = uint256(TEST_BELIEF_HASH);
        inputs[1] = 0;
        inputs[2] = TEST_EPOCH;
        inputs[3] = TEST_MODULE_ID;

        vm.expectRevert(
            ProductionBeliefAttestationVerifier
                .InvalidAttesterAddress
                .selector
        );
        verifier.verifyProof(hex"deadbeef", inputs);
    }

    function test_verifyProof_revertsOnEmptySeal() public {
        uint256[] memory inputs = new uint256[](4);
        inputs[0] = uint256(TEST_BELIEF_HASH);
        inputs[1] = uint256(uint160(TEST_ATTESTER));
        inputs[2] = TEST_EPOCH;
        inputs[3] = TEST_MODULE_ID;

        vm.expectRevert(
            ProductionBeliefAttestationVerifier.EmptyProof.selector
        );
        verifier.verifyProof(hex"", inputs);
    }

    // -------------------------------------------------------------------------
    //  Direct verifyAttestation Tests
    // -------------------------------------------------------------------------

    function test_verifyAttestation_success() public {
        bytes memory journal = abi.encode(
            TEST_BELIEF_HASH,
            TEST_ATTESTER,
            uint32(TEST_EPOCH),
            uint32(TEST_MODULE_ID),
            uint32(8500), // beliefScore
            uint64(block.timestamp)
        );

        bytes memory fakeSeal = hex"cafebabe";

        bool result = verifier.verifyAttestation(fakeSeal, journal);
        assertTrue(result);
        assertEq(verifier.attestationCount(), 1);

        ProductionBeliefAttestationVerifier.VerifiedAttestation memory att =
            verifier.getAttestation(TEST_BELIEF_HASH, TEST_ATTESTER, TEST_EPOCH);
        assertTrue(att.exists);
        assertEq(att.beliefScore, 8500);
        assertEq(att.moduleId, TEST_MODULE_ID);
    }

    function test_verifyAttestation_failsOnBadProof() public {
        mockVerifier.setRevert(true, "VerificationFailed");

        bytes memory journal = abi.encode(
            TEST_BELIEF_HASH,
            TEST_ATTESTER,
            uint32(TEST_EPOCH),
            uint32(TEST_MODULE_ID),
            uint32(8500),
            uint64(block.timestamp)
        );

        bool result = verifier.verifyAttestation(hex"bad", journal);
        assertFalse(result);
    }

    // -------------------------------------------------------------------------
    //  Attestation Storage Tests
    // -------------------------------------------------------------------------

    function test_getAttestation_returnsEmpty() public view {
        ProductionBeliefAttestationVerifier.VerifiedAttestation memory att =
            verifier.getAttestation(TEST_BELIEF_HASH, TEST_ATTESTER, 999);
        assertFalse(att.exists);
    }

    // -------------------------------------------------------------------------
    //  Owner Functions Tests
    // -------------------------------------------------------------------------

    function test_setImageId_success() public {
        bytes32 newId = bytes32(uint256(0x42));
        verifier.setImageId(newId);
        assertEq(verifier.getImageId(), newId);
    }

    function test_setImageId_revertsOnZero() public {
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.ZeroImageId.selector
        );
        verifier.setImageId(bytes32(0));
    }

    function test_setImageId_revertsForNonOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.OnlyOwner.selector
        );
        verifier.setImageId(bytes32(uint256(0x42)));
    }

    function test_transferOwnership_success() public {
        address newOwner = address(0xCAFE);
        verifier.transferOwnership(newOwner);
        assertEq(verifier.owner(), newOwner);
    }

    function test_transferOwnership_revertsOnZero() public {
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.ZeroAddress.selector
        );
        verifier.transferOwnership(address(0));
    }

    function test_transferOwnership_revertsForNonOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(
            ProductionBeliefAttestationVerifier.OnlyOwner.selector
        );
        verifier.transferOwnership(address(0xCAFE));
    }

    // -------------------------------------------------------------------------
    //  View Functions Tests
    // -------------------------------------------------------------------------

    function test_constants() public view {
        assertEq(verifier.getPublicInputsCount(), 4);
        assertEq(
            verifier.getProofSystemId(),
            "RISC0-STARK-BeliefAttestation-Production-v2.0"
        );
        assertEq(verifier.getMinBeliefThreshold(), 8000);
    }
}
