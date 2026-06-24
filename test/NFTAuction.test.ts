import { expect } from "chai";
import { ethers } from "hardhat";
import { NFTAuction } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NFTAuction", function () {
  let nftAuction: NFTAuction;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;

  const TOKEN_URI = "ipfs://QmTest1234567890abcdef/metadata.json";
  const MIN_PRICE = ethers.parseEther("0.1");
  const DURATION = 24 * 60 * 60; // 1 day

  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
  });

  describe("Minting", function () {
    it("Should mint an NFT", async function () {
      await nftAuction.mintNFT(seller.address, TOKEN_URI);
      
      expect(await nftAuction.ownerOf(0)).to.equal(seller.address);
      expect(await nftAuction.tokenURI(0)).to.equal(TOKEN_URI);
    });

    it("Should emit NFTMinted event", async function () {
      await expect(nftAuction.mintNFT(seller.address, TOKEN_URI))
        .to.emit(nftAuction, "NFTMinted")
        .withArgs(0, seller.address, TOKEN_URI);
    });
  });

  describe("Auction Creation", function () {
    beforeEach(async function () {
      await nftAuction.mintNFT(seller.address, TOKEN_URI);
    });

    it("Should create an auction", async function () {
      await nftAuction.connect(seller).createAuction(0, MIN_PRICE, DURATION);
      
      const auction = await nftAuction.getAuction(0);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.minPrice).to.equal(MIN_PRICE);
      expect(auction.active).to.be.true;
    });

    it("Should transfer NFT to contract", async function () {
      await nftAuction.connect(seller).createAuction(0, MIN_PRICE, DURATION);
      
      expect(await nftAuction.ownerOf(0)).to.equal(await nftAuction.getAddress());
    });

    it("Should fail if not owner", async function () {
      await expect(
        nftAuction.connect(bidder1).createAuction(0, MIN_PRICE, DURATION)
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Bidding", function () {
    beforeEach(async function () {
      await nftAuction.mintNFT(seller.address, TOKEN_URI);
      await nftAuction.connect(seller).createAuction(0, MIN_PRICE, DURATION);
    });

    it("Should place a bid", async function () {
      const bidAmount = ethers.parseEther("0.2");
      
      await nftAuction.connect(bidder1).placeBid(0, { value: bidAmount });
      
      const auction = await nftAuction.getAuction(0);
      expect(auction.highestBid).to.equal(bidAmount);
      expect(auction.highestBidder).to.equal(bidder1.address);
    });

    it("Should allow higher bid and refund previous bidder", async function () {
      const bid1 = ethers.parseEther("0.2");
      const bid2 = ethers.parseEther("0.3");
      
      await nftAuction.connect(bidder1).placeBid(0, { value: bid1 });
      await nftAuction.connect(bidder2).placeBid(0, { value: bid2 });
      
      const pendingReturn = await nftAuction.getPendingReturns(0, bidder1.address);
      expect(pendingReturn).to.equal(bid1);
    });

    it("Should fail if bid is too low", async function () {
      await expect(
        nftAuction.connect(bidder1).placeBid(0, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Bid below min price");
    });
  });

  describe("Ending Auction", function () {
    beforeEach(async function () {
      await nftAuction.mintNFT(seller.address, TOKEN_URI);
      await nftAuction.connect(seller).createAuction(0, MIN_PRICE, DURATION);
    });

    it("Should end auction with winner", async function () {
      const bidAmount = ethers.parseEther("0.2");
      await nftAuction.connect(bidder1).placeBid(0, { value: bidAmount });
      
      await time.increase(DURATION + 1);
      
      await nftAuction.endAuction(0);
      
      expect(await nftAuction.ownerOf(0)).to.equal(bidder1.address);
    });

    it("Should return NFT if no bids", async function () {
      await time.increase(DURATION + 1);
      
      await nftAuction.endAuction(0);
      
      expect(await nftAuction.ownerOf(0)).to.equal(seller.address);
    });

    it("Should fail if auction not ended", async function () {
      await expect(nftAuction.endAuction(0)).to.be.revertedWith("Auction not ended");
    });
  });

  describe("Cancel Auction", function () {
    beforeEach(async function () {
      await nftAuction.mintNFT(seller.address, TOKEN_URI);
      await nftAuction.connect(seller).createAuction(0, MIN_PRICE, DURATION);
    });

    it("Should cancel auction with no bids", async function () {
      await nftAuction.connect(seller).cancelAuction(0);
      
      expect(await nftAuction.ownerOf(0)).to.equal(seller.address);
    });

    it("Should fail if bids placed", async function () {
      await nftAuction.connect(bidder1).placeBid(0, { value: MIN_PRICE });
      
      await expect(
        nftAuction.connect(seller).cancelAuction(0)
      ).to.be.revertedWith("Bids already placed");
    });
  });
});
