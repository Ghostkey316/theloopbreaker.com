// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {RewardStream} from "../contracts/RewardStream.sol";

contract ReentrantReceiver {
    RewardStream private immutable _stream;
    bool private _blocked;

    constructor(RewardStream stream) {
        _stream = stream;
    }

    receive() external payable {
        if (_blocked) {
            return;
        }
        _blocked = true;
        try _stream.claimRewards(payable(address(this))) {
            revert("reentrancy-allowed");
        } catch {
            // Expected: Reentrancy guard or nothing-to-claim reverted.
        }
    }

    function blocked() external view returns (bool) {
        return _blocked;
    }
}

contract RewardStreamTest is Test {
    RewardStream private stream;
    address private constant ADMIN = address(0xA11CE);
    address private constant GOVERNOR = address(0xBEEF);

    function setUp() external {
        vm.prank(ADMIN);
        stream = new RewardStream(ADMIN, GOVERNOR);
        vm.deal(address(stream), 5 ether);
    }

    function testDistributeNoReentry() external {
        ReentrantReceiver receiver = new ReentrantReceiver(stream);

        vm.prank(ADMIN);
        stream.queueRewards(address(receiver), 1 ether);

        vm.prank(ADMIN);
        stream.distributeRewards(address(receiver), 1 ether);

        assertEq(address(receiver).balance, 1 ether, "receiver should obtain payout");
        assertTrue(receiver.blocked(), "receiver should attempt reentry once");
    }
}
