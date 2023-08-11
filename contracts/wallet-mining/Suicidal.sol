// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title  Suicidal
 * @author soyccan (soyccan@gmail.com)
 * @notice A proxiable contract that suidices when called.
 */
contract Suicidal is UUPSUpgradeable {
    function destruct() external {
        selfdestruct(payable(0));
    }

    function _authorizeUpgrade(address) internal override {}
}
