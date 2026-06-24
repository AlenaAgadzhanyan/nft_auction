import { ethers } from "hardhat";

async function main() {
  console.log("Deploying NFTAuction contract to local network...");

  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const NFTAuction = await ethers.getContractFactory("NFTAuction");
  const nftAuction = await NFTAuction.deploy();

  await nftAuction.waitForDeployment();

  const contractAddress = await nftAuction.getAddress();
  console.log("NFTAuction deployed to:", contractAddress);

  // Mint some test NFTs
  console.log("\nMinting test NFTs...");

  const tx1 = await nftAuction.mintNFT(
    deployer.address,
    "ipfs://QmTest1234567890abcdef/metadata.json"
  );
  await tx1.wait();
  console.log("Minted NFT #0 to deployer");

  const tx2 = await nftAuction.mintNFT(
    user1.address,
    "ipfs://QmTest2345678901bcdefg/metadata.json"
  );
  await tx2.wait();
  console.log("Minted NFT #1 to user1");

  console.log("\n=== Local Deployment Complete ===");
  console.log("Contract Address:", contractAddress);
  console.log("\nAdd this to your .env file:");
  console.log(`VITE_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
