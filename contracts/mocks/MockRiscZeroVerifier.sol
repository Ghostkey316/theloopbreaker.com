// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../IRiscZeroVerifier.sol";

/// @notice Minimal mock IRiscZeroVerifier for local Hardhat tests.
/// @dev Verifies that (imageId, journalDigest) match the expected values.
contract MockRiscZeroVerifier is IRiscZeroVerifier {
    bytes32 public expectedImageId;
    bytes32 public expectedJournalDigest;
    bool public shouldRevert;

    function setExpected(bytes32 _imageId, bytes32 _journalDigest) external {
        expectedImageId = _imageId;
        expectedJournalDigest = _journalDigest;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function verify(
        bytes calldata, /* proof */
        bytes32 imageId,
        bytes32 journalDigest
    ) external view returns (bool) {
        require(!shouldRevert, "Mock: forced revert");
        require(imageId == expectedImageId, "Mock: bad imageId");
        require(journalDigest == expectedJournalDigest, "Mock: bad journalDigest");
        return true;
    }

    function version() external pure returns (string memory) {
        return "mock-risc0-verifier";
    }
}
