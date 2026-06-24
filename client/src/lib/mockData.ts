export interface NFT {
  id: string;
  tokenId: number;
  name: string;
  description: string;
  image: string;
  mediaType: 'image' | 'audio' | 'video';
  creator: string;
  owner: string;
}

export interface Auction {
  id: string;
  nft: NFT;
  seller: string;
  minPrice: number;
  highestBid: number;
  highestBidder: string | null;
  active: boolean;
  endTime: Date;
  bids: Bid[];
}

export interface Bid {
  id: string;
  bidder: string;
  amount: number;
  timestamp: Date;
}

export const mockNFTs: NFT[] = [
  {
    id: '1',
    tokenId: 1,
    name: 'Cyber Punk #001',
    description: 'A rare cyberpunk-themed digital artwork featuring neon cityscapes.',
    image: 'https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=500&h=500&fit=crop',
    mediaType: 'image',
    creator: '0x1234...5678',
    owner: '0x1234...5678',
  },
  {
    id: '2',
    tokenId: 2,
    name: 'Digital Dreams',
    description: 'Abstract digital art exploring consciousness and technology.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&h=500&fit=crop',
    mediaType: 'image',
    creator: '0xabcd...efgh',
    owner: '0xabcd...efgh',
  },
  {
    id: '3',
    tokenId: 3,
    name: 'Neon Genesis',
    description: 'Futuristic neon artwork inspired by anime aesthetics.',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&h=500&fit=crop',
    mediaType: 'image',
    creator: '0x9876...5432',
    owner: '0x9876...5432',
  },
  {
    id: '4',
    tokenId: 4,
    name: 'Synthwave Sunset',
    description: 'Retro-futuristic sunset with synthwave aesthetics.',
    image: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=500&h=500&fit=crop',
    mediaType: 'image',
    creator: '0xfedc...ba98',
    owner: '0xfedc...ba98',
  },
  {
    id: '5',
    tokenId: 5,
    name: 'Quantum Beat',
    description: 'Original electronic music composition with quantum-inspired visuals.',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=500&fit=crop',
    mediaType: 'audio',
    creator: '0x1111...2222',
    owner: '0x1111...2222',
  },
  {
    id: '6',
    tokenId: 6,
    name: 'Holographic Reality',
    description: '3D video art exploring holographic dimensions.',
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500&h=500&fit=crop',
    mediaType: 'video',
    creator: '0x3333...4444',
    owner: '0x3333...4444',
  },
];

export const mockAuctions: Auction[] = mockNFTs.map((nft, index) => ({
  id: `auction-${nft.id}`,
  nft,
  seller: nft.owner,
  minPrice: 0.1 + index * 0.05,
  highestBid: index % 2 === 0 ? 0.15 + index * 0.1 : 0,
  highestBidder: index % 2 === 0 ? '0x5555...6666' : null,
  active: true,
  endTime: new Date(Date.now() + (index + 1) * 3600000 * 24),
  bids: index % 2 === 0 ? [
    {
      id: `bid-${index}-1`,
      bidder: '0x5555...6666',
      amount: 0.15 + index * 0.1,
      timestamp: new Date(Date.now() - 3600000),
    },
  ] : [],
}));
