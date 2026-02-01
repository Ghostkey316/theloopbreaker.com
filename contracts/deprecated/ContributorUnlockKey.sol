// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ContributorUnlockKey
 * @notice NFT access token that unlocks elevated Vaultfire features when minted.
 */
interface IUnlockHook {
    function onMint(address to, uint256 tokenId) external;
}

contract ContributorUnlockKey is ERC721, Ownable {
    uint256 private _tokenId;
    address public unlockHook;

    event UnlockHookSet(address indexed hook);

    constructor() ERC721("Contributor Unlock Key", "CUK") Ownable(msg.sender) {}

    function setUnlockHook(address hook) external onlyOwner {
        unlockHook = hook;
        emit UnlockHookSet(hook);
    }

    function mint(address to) external onlyOwner returns (uint256) {
        _tokenId += 1;
        uint256 newId = _tokenId;
        _mint(to, newId);
        if (unlockHook != address(0)) {
            IUnlockHook(unlockHook).onMint(to, newId);
        }
        return newId;
    }
}
