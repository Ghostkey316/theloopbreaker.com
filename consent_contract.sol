// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Ghostshroud Consent Registry
/// @notice Programmable consent tokens controlling Vaultfire privacy modules.
contract ConsentRegistry {
    struct ConsentToken {
        address subject;
        string purpose;
        string dataClass;
        uint64 issuedAt;
        uint64 expiresAt;
        uint32 usageLimit;
        uint32 usageCount;
        bool revoked;
        bytes32 ethicsHash;
    }

    event ConsentIssued(uint256 indexed tokenId, address indexed subject, string purpose, string dataClass);
    event ConsentRevoked(uint256 indexed tokenId, address indexed subject);
    event ConsentUsed(uint256 indexed tokenId, address indexed operator, bytes32 payloadHash);

    mapping(uint256 => ConsentToken) private _tokens;
    uint256 private _nextTokenId = 1;
    address public immutable ethicsModule;

    modifier onlySubject(uint256 tokenId) {
        require(_tokens[tokenId].subject == msg.sender, "Not consent subject");
        _;
    }

    constructor(address ethicsModuleAddress) {
        require(ethicsModuleAddress != address(0), "Invalid ethics module");
        ethicsModule = ethicsModuleAddress;
    }

    function issueConsent(
        string calldata purpose,
        string calldata dataClass,
        uint64 expiresAt,
        uint32 usageLimit,
        bytes32 ethicsHash
    ) external returns (uint256 tokenId) {
        require(expiresAt > block.timestamp, "Expiry must be in future");
        require(usageLimit > 0, "Usage limit must be positive");

        tokenId = _nextTokenId++;
        _tokens[tokenId] = ConsentToken({
            subject: msg.sender,
            purpose: purpose,
            dataClass: dataClass,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            usageLimit: usageLimit,
            usageCount: 0,
            revoked: false,
            ethicsHash: ethicsHash
        });

        emit ConsentIssued(tokenId, msg.sender, purpose, dataClass);
    }

    function revokeConsent(uint256 tokenId) external onlySubject(tokenId) {
        ConsentToken storage token = _tokens[tokenId];
        require(!token.revoked, "Already revoked");
        token.revoked = true;
        emit ConsentRevoked(tokenId, msg.sender);
    }

    function recordUsage(uint256 tokenId, bytes32 payloadHash) external {
        ConsentToken storage token = _tokens[tokenId];
        require(_validateUsage(token), "Consent invalid");
        token.usageCount += 1;
        emit ConsentUsed(tokenId, msg.sender, payloadHash);
    }

    function getConsent(uint256 tokenId) external view returns (ConsentToken memory) {
        return _tokens[tokenId];
    }

    function isActionAllowed(
        uint256 tokenId,
        string calldata expectedPurpose,
        string calldata expectedDataClass,
        bytes32 ethicsHash
    ) external view returns (bool) {
        ConsentToken memory token = _tokens[tokenId];
        if (!_validateUsage(token)) {
            return false;
        }
        if (keccak256(bytes(expectedPurpose)) != keccak256(bytes(token.purpose))) {
            return false;
        }
        if (keccak256(bytes(expectedDataClass)) != keccak256(bytes(token.dataClass))) {
            return false;
        }
        if (token.ethicsHash != ethicsHash) {
            return false;
        }
        return true;
    }

    function _validateUsage(ConsentToken memory token) internal view returns (bool) {
        if (token.subject == address(0)) {
            return false;
        }
        if (token.revoked) {
            return false;
        }
        if (block.timestamp > token.expiresAt) {
            return false;
        }
        if (token.usageCount >= token.usageLimit) {
            return false;
        }
        return true;
    }
}
