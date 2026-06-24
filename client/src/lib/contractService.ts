import { ethers, BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import NFTAuctionABI from './contracts/NFTAuction.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

export interface ContractAuction {
  tokenId: bigint;
  seller: string;
  minPrice: bigint;
  highestBid: bigint;
  highestBidder: string;
  endTime: bigint;
  active: boolean;
  claimed: boolean;
}

export interface AppNft {
  tokenId: number;
  name: string;
  description: string;
  imageUrl: string;
  tokenUri: string;
  mediaType: 'image' | 'audio' | 'video';
  creatorAddress: string;
  ownerAddress: string;
}

export interface AppAuction {
  auctionId: number;
  nft: AppNft;
  minPrice: string;
  highestBid: string;
  highestBidder: string;
  endTime: Date;
  active: boolean;
  claimed: boolean;
  seller: string;
}

class ContractService {
  private provider: BrowserProvider | null = null;
  private contract: Contract | null = null;
  private signer: ethers.Signer | null = null;

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    this.provider = new BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    
    this.contract = new Contract(
      CONTRACT_ADDRESS,
      NFTAuctionABI.abi,
      this.signer
    );

    return await this.signer.getAddress();
  }

  private getReadOnlyContract(): Contract {
    if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        return new Contract(CONTRACT_ADDRESS, NFTAuctionABI.abi, provider);
    }
    // If no provider, perhaps use a public RPC for read-only
    throw new Error('No Ethereum provider found. Please install MetaMask.');
  }

  private async getWriteContract(): Promise<Contract> {
    if (!this.contract || !this.signer) {
      await this.connect();
    }
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return this.contract;
  }

  async mintAndCreateAuction(tokenURI: string, minPriceEth: string, durationSeconds: number, listingFee: bigint): Promise<{ tokenId: number; txHash: string }> {
    const contract = await this.getWriteContract();
    const minPriceWei = parseEther(minPriceEth);
    const tx = await contract.mintAndCreateAuction(tokenURI, minPriceWei, durationSeconds, { value: listingFee });
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (log: any) => log.fragment?.name === 'NFTMinted'
    );
    const tokenId = event ? Number(event.args[0]) : 0;
    return { tokenId, txHash: receipt.hash };
  }

  async placeBid(auctionId: number, bidAmountEth: string): Promise<string> {
    const contract = await this.getWriteContract();
    const bidAmountWei = parseEther(bidAmountEth);
    const tx = await contract.placeBid(auctionId, bidAmountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async endAuction(auctionId: number): Promise<string> {
    const contract = await this.getWriteContract();
    const tx = await contract.endAuction(auctionId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async claimAuction(auctionId: number, bidAmountEth: string): Promise<string> {
    const contract = await this.getWriteContract();
    const bidAmountWei = parseEther(bidAmountEth);
    const tx = await contract.claimAuction(auctionId, { value: bidAmountWei });
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async cancelAuction(auctionId: number): Promise<string> {
    const contract = await this.getWriteContract();
    const tx = await contract.cancelAuction(auctionId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getListingFee(): Promise<bigint> {
    const contract = this.getReadOnlyContract();
    return await contract.listingFee();
  }
  
  private async getAuction(auctionId: number): Promise<ContractAuction | null> {
    try {
      const contract = this.getReadOnlyContract();
      const auction = await contract.getAuction(auctionId);
      if (auction.seller === '0x0000000000000000000000000000000000000000') return null;
      return auction;
    } catch {
      return null;
    }
  }
  
  private async getTokenURI(tokenId: number): Promise<string> {
    const contract = this.getReadOnlyContract();
    return await contract.tokenURI(tokenId);
  }
  
  private async hydrateAuction(auctionId: number, auctionData: ContractAuction): Promise<AppAuction> {
    const contract = this.getReadOnlyContract();
    const tokenId = Number(auctionData.tokenId);

    try {
      const tokenUri = await this.getTokenURI(tokenId);
      const ipfsHash = tokenUri.replace('ipfs://', '');
      const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      
      const metadataRes = await fetch(metadataUrl);
      if (!metadataRes.ok) {
          throw new Error(`Failed to fetch metadata from ${metadataUrl}`);
      }
      
      const metadata = await metadataRes.json();
      
      let imageUrl = metadata.image;
      if (imageUrl && imageUrl.startsWith('ipfs://')) {
        const imageHash = imageUrl.replace('ipfs://', '');
        imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
      }

      let owner: string;
      try {
        owner = await contract.ownerOf(tokenId);
      } catch (e) {
        // If owner can't be found, it might be held by the contract
        owner = CONTRACT_ADDRESS;
      }

      const creator = metadata.attributes?.find((a: any) => a.trait_type === 'Creator')?.value || auctionData.seller;
      const mediaType = metadata.attributes?.find((a: any) => a.trait_type === 'Media Type')?.value || 'image';

      return {
        auctionId: auctionId,
        nft: {
          tokenId: tokenId,
          name: metadata.name,
          description: metadata.description,
          imageUrl: imageUrl,
          tokenUri: tokenUri,
          mediaType: mediaType,
          creatorAddress: creator,
          ownerAddress: owner,
        },
        minPrice: formatEther(auctionData.minPrice),
        highestBid: formatEther(auctionData.highestBid),
        highestBidder: auctionData.highestBidder,
        endTime: new Date(Number(auctionData.endTime) * 1000),
        active: auctionData.active,
        claimed: auctionData.claimed,
        seller: auctionData.seller,
      };
    } catch (error) {
      console.error(`Failed to hydrate auction ${auctionId}:`, error);
      throw error; 
    }
  }

  async getAuctionDetails(auctionId: number): Promise<AppAuction | null> {
    if (!this.isConfigured()) return null;
    
    try {
      const auctionData = await this.getAuction(auctionId);
      if (!auctionData) return null;
      return await this.hydrateAuction(auctionId, auctionData);
    } catch (error) {
      console.error(`Failed to fetch details for auction ${auctionId}:`, error);
      return null;
    }
  }

  async getAllAuctions(): Promise<AppAuction[]> {
    if (!this.isConfigured()) return [];

    const auctions: AppAuction[] = [];
    const totalTokens = await this.getCurrentTokenId();

    for (let i = 1; i < totalTokens; i++) {
      const auctionData = await this.getAuction(i);
      if (!auctionData) continue;

      try {
        const appAuction = await this.hydrateAuction(i, auctionData);
        auctions.push(appAuction);
      } catch (error) {
        console.error(`Skipping auction ${i} due to error:`, error);
      }
    }
    return auctions.reverse();
  }

  async getCurrentTokenId(): Promise<number> {
    const contract = this.getReadOnlyContract();
    const tokenId = await contract.getCurrentTokenId();
    return Number(tokenId);
  }

  isConfigured(): boolean {
    return !!CONTRACT_ADDRESS;
  }

  getContractAddress(): string {
    return CONTRACT_ADDRESS;
  }
}

export const contractService = new ContractService();

export const formatEth = (wei: bigint | string): string => {
  if (typeof wei === 'string') {
    // Attempt to convert if it's a string representation of a number
    try {
      wei = BigInt(wei);
    } catch (e) {
      // If conversion fails, it might be already formatted or invalid
      return wei; 
    }
  }
  return formatEther(wei);
};