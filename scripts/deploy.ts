import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("Deploying NFTAuction contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const NFTAuction = await ethers.getContractFactory("NFTAuction");
  const nftAuction = await NFTAuction.deploy();

  await nftAuction.waitForDeployment();

  const contractAddress = await nftAuction.getAddress();
  console.log("NFTAuction deployed to:", contractAddress);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await nftAuction.deploymentTransaction()?.wait(5);

  console.log("\n=== Deployment Complete ===");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("\nVerify contract on Etherscan:");
  console.log(`npx hardhat verify --network <network> ${contractAddress}`);

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
