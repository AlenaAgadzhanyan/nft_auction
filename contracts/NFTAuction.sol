// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTAuction is ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;

    struct Auction {
        uint256 tokenId;
        address seller;
        uint256 minPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool active;
        bool claimed;
    }

    mapping(uint256 => Auction) public auctions;
    
    uint256 public listingFee = 0.0001 ether;

    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed seller, uint256 minPrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount);
    event AuctionClaimed(uint256 indexed auctionId, address winner, uint256 amount);
    event AuctionCancelled(uint256 indexed auctionId);
    event ListingFeeChanged(uint256 newFee);

    constructor()
        ERC721("NFT Auction", "NFTA")
        Ownable(msg.sender)
    {
        _tokenIdCounter = 1;
    }

    function mintAndCreateAuction(
        string memory tokenURI,
        uint256 minPrice,
        uint256 duration
    ) external payable returns (uint256) {
        require(minPrice > 0, "Min price must be > 0");
        require(duration >= 1 hours, "Duration too short");
        require(duration <= 30 days, "Duration too long");
        require(msg.value == listingFee, "Must pay listing fee");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
        emit NFTMinted(tokenId, msg.sender, tokenURI);

        _transfer(msg.sender, address(this), tokenId);

        uint256 endTime = block.timestamp + duration;
        
        auctions[tokenId] = Auction({
            tokenId: tokenId,
            seller: msg.sender,
            minPrice: minPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: endTime,
            active: true,
            claimed: false
        });
        
        emit AuctionCreated(tokenId, tokenId, msg.sender, minPrice, endTime);
        
        return tokenId;
    }

    function placeBid(
        uint256 auctionId,
        uint256 bidAmount
    ) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        
        uint256 minBid = auction.highestBid > 0 ? auction.highestBid : auction.minPrice;
        require(bidAmount > minBid, "Bid not high enough");

        address bidder = msg.sender;
        require(bidder != auction.seller, "Seller cannot bid");

        auction.highestBid = bidAmount;
        auction.highestBidder = bidder;
        
        emit BidPlaced(auctionId, bidder, bidAmount);
    }
    
    function endAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.active = false;

        if (auction.highestBidder != address(0)) {
            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            _transfer(address(this), auction.seller, auction.tokenId);
            emit AuctionCancelled(auctionId);
        }
    }

    function claimAuction(uint256 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(!auction.active, "Auction is still active");
        require(!auction.claimed, "Auction already claimed");
        require(msg.sender == auction.highestBidder, "Not the winner");
        require(msg.value == auction.highestBid, "Incorrect payment amount");
        
        auction.claimed = true;
        
        _transfer(address(this), auction.highestBidder, auction.tokenId);
        
        (bool success, ) = payable(auction.seller).call{value: auction.highestBid}("");
        require(success, "Seller payment failed");
        
        emit AuctionClaimed(auctionId, auction.highestBidder, auction.highestBid);
    }
    
    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        
        require(auction.active, "Auction not active");
        require(auction.seller == msg.sender, "Not the seller");
        require(auction.highestBidder == address(0), "Bids already placed");
        
        auction.active = false;
        
        _transfer(address(this), auction.seller, auction.tokenId);
        
        emit AuctionCancelled(auctionId);
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function setListingFee(uint256 newFee) external onlyOwner {
        listingFee = newFee;
        emit ListingFeeChanged(newFee);
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "";
    }
}
