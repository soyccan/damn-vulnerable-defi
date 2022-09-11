// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @title PuppetV3Pool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract PuppetV3Pool {

    IERC20Minimal               public immutable weth;
    IERC20Minimal               public immutable token;
    IUniswapV3Pool              public immutable uniswapV3Pool;
    IUniswapV3Factory           public immutable uniswapV3Factory;
    
    mapping(address => uint256) public deposits;
        
    event Borrowed(
        address indexed borrower,
        uint256 depositRequired,
        uint256 borrowAmount,
        uint256 timestamp
    );

    constructor (
        IERC20Minimal _weth,
        IERC20Minimal _token,
        IUniswapV3Pool _uniswapV3Pool,
        IUniswapV3Factory _uniswapV3Factory
    ) {
        weth = _weth;
        token = _token;
        uniswapV3Pool = _uniswapV3Pool;
        uniswapV3Factory = _uniswapV3Factory;
    }

    /**
     * @notice Allows borrowing `borrowAmount` of tokens by first depositing three times their value in WETH.
     *         Sender must have approved enough WETH in advance.
     *         Calculations assume that WETH and borrowed token have the same amount of decimals.
     * @param borrowAmount amount of tokens the user intends to borrow
     */
    function borrow(uint256 borrowAmount) external {
        require(token.balanceOf(address(this)) >= borrowAmount, "Not enough token balance");

        // Calculate how much WETH the user must deposit
        uint256 depositOfWETHRequired = calculateDepositOfWETHRequired(borrowAmount);
        
        // Take the WETH
        weth.transferFrom(msg.sender, address(this), depositOfWETHRequired);

        // internal accounting
        deposits[msg.sender] += depositOfWETHRequired;

        require(token.transfer(msg.sender, borrowAmount), "Token transfer failed");

        emit Borrowed(msg.sender, depositOfWETHRequired, borrowAmount, block.timestamp);
    }

    function calculateDepositOfWETHRequired(uint256 amount) public view returns (uint256) {
        return _getOracleQuote(_toUint128(amount)) * 3;
    }

    function _getOracleQuote(uint128 amount) private view returns (uint256) {
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(address(uniswapV3Pool), 30 minutes);
        return OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            amount,             // baseAmount
            address(token),     // baseToken
            address(weth)       // quoteToken
        );
    }

    function _toUint128(uint256 amount) private pure returns (uint128 n) {
        require((n = uint128(amount)) == amount, "Amount too large");
    }
}
