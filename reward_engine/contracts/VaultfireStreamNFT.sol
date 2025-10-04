// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title VaultfireStreamNFT
 * @notice ERC-721 reward stream contract that mints a non-transferable NFT per stream.
 *         Each NFT represents a streaming reward schedule with linear unlock mechanics.
 *         Automation roles can trigger new reward streams for contributor wallets on-chain.
 */
contract VaultfireStreamNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant STREAM_MANAGER_ROLE = keccak256("STREAM_MANAGER_ROLE");

    struct Stream {
        address recipient;
        uint64 startTime;
        uint64 endTime;
        uint256 totalAmount; // micro-units of the multiplier or reward points
        uint256 claimedAmount;
        bytes32 userId;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Stream) private _streams;
    mapping(address => uint256) public latestStreamByRecipient;

    event StreamStarted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed userId,
        uint64 startTime,
        uint64 endTime,
        uint256 totalAmount,
        string metadataURI
    );

    event StreamClaimed(
        uint256 indexed tokenId,
        address indexed claimant,
        uint256 unlockedAmount,
        uint256 totalClaimed
    );

    event StreamCancelled(uint256 indexed tokenId, address indexed operator, uint64 cancelledAt);

    constructor(address admin) ERC721("Vaultfire Reward Stream", "VFSTREAM") {
        if (admin == address(0)) {
            admin = msg.sender;
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STREAM_MANAGER_ROLE, admin);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function startStream(
        address recipient,
        uint256 totalAmount,
        uint64 startTime,
        uint64 endTime,
        string calldata metadataURI,
        bytes32 userId
    ) external onlyRole(STREAM_MANAGER_ROLE) returns (uint256 tokenId) {
        require(recipient != address(0), "recipient required");
        require(totalAmount > 0, "amount required");

        uint64 actualStart = startTime == 0 ? uint64(block.timestamp) : startTime;
        require(endTime > actualStart, "invalid duration");

        tokenId = _nextTokenId++;
        Stream storage stream = _streams[tokenId];
        stream.recipient = recipient;
        stream.startTime = actualStart;
        stream.endTime = endTime;
        stream.totalAmount = totalAmount;
        stream.claimedAmount = 0;
        stream.userId = userId;

        _safeMint(recipient, tokenId);
        if (bytes(metadataURI).length > 0) {
            _setTokenURI(tokenId, metadataURI);
        }

        latestStreamByRecipient[recipient] = tokenId;

        emit StreamStarted(tokenId, recipient, userId, actualStart, endTime, totalAmount, metadataURI);
    }

    function claimable(uint256 tokenId) public view returns (uint256) {
        Stream memory stream = _streams[tokenId];
        if (stream.recipient == address(0)) {
            return 0;
        }
        if (block.timestamp <= stream.startTime) {
            return 0;
        }
        uint64 effectiveTime = block.timestamp < stream.endTime ? uint64(block.timestamp) : stream.endTime;
        uint64 elapsed = effectiveTime - stream.startTime;
        uint64 duration = stream.endTime - stream.startTime;
        if (duration == 0) {
            return 0;
        }
        uint256 unlocked = (stream.totalAmount * elapsed) / duration;
        if (unlocked <= stream.claimedAmount) {
            return 0;
        }
        return unlocked - stream.claimedAmount;
    }

    function claim(uint256 tokenId) external returns (uint256 unlockedAmount) {
        Stream storage stream = _streams[tokenId];
        require(stream.recipient != address(0), "stream missing");
        require(_isApprovedOrOwner(msg.sender, tokenId), "not authorized");

        unlockedAmount = claimable(tokenId);
        stream.claimedAmount += unlockedAmount;
        emit StreamClaimed(tokenId, msg.sender, unlockedAmount, stream.claimedAmount);
    }

    function cancelStream(uint256 tokenId, bool burnToken) external onlyRole(STREAM_MANAGER_ROLE) {
        Stream storage stream = _streams[tokenId];
        require(stream.recipient != address(0), "stream missing");
        stream.endTime = uint64(block.timestamp);
        emit StreamCancelled(tokenId, msg.sender, stream.endTime);
        if (burnToken) {
            _burn(tokenId);
        }
    }

    function streamDetails(uint256 tokenId)
        external
        view
        returns (
            address recipient,
            uint64 startTime,
            uint64 endTime,
            uint256 totalAmount,
            uint256 claimedAmount,
            bytes32 userId,
            string memory metadataURI,
            uint256 claimableAmount
        )
    {
        Stream memory stream = _streams[tokenId];
        recipient = stream.recipient;
        startTime = stream.startTime;
        endTime = stream.endTime;
        totalAmount = stream.totalAmount;
        claimedAmount = stream.claimedAmount;
        userId = stream.userId;
        metadataURI = tokenURI(tokenId);
        claimableAmount = claimable(tokenId);
    }

    function activeMultiplier(address account)
        external
        view
        returns (
            uint256 multiplierMicros,
            uint256 tokenId,
            bool active
        )
    {
        tokenId = latestStreamByRecipient[account];
        if (tokenId == 0) {
            return (0, 0, false);
        }
        Stream memory stream = _streams[tokenId];
        if (stream.recipient != account) {
            return (0, tokenId, false);
        }
        multiplierMicros = stream.totalAmount;
        bool streamActive = block.timestamp < stream.endTime && stream.claimedAmount < stream.totalAmount;
        active = streamActive;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("transfers disabled");
        }
        address previousOwner = super._update(to, tokenId, auth);
        if (to == address(0)) {
            delete latestStreamByRecipient[previousOwner];
        } else {
            latestStreamByRecipient[to] = tokenId;
        }
        return previousOwner;
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
        delete _streams[tokenId];
    }
}
