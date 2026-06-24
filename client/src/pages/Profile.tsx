import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWalletContext } from '@/contexts/WalletContext';
import { contractService, AppAuction, AppNft } from '@/lib/contractService';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { shortenAddress } from '@/lib/web3';
import { 
  Wallet, 
  Copy, 
  ExternalLink, 
  Image as ImageIcon,
  Gavel,
  History,
  Plus,
  Check,
  Loader2,
  AlertTriangle,
  Music,
  Video
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Tab = 'owned' | 'auctions' | 'bids';

const Profile = () => {
  const { wallet, connect } = useWalletContext();
  const [activeTab, setActiveTab] = useState<Tab>('owned');
  const [copied, setCopied] = useState(false);
  const [auctions, setAuctions] = useState<AppAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!wallet.address) return;
      setIsLoading(true);
      setError(null);
      try {
        const allAuctions = await contractService.getAllAuctions();
        setAuctions(allAuctions);
      } catch (err) {
        console.error('Failed to fetch profile data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching data.');
      } finally {
        setIsLoading(false);
      }
    };

    if (contractService.isConfigured() && wallet.isConnected) {
      fetchProfileData();
    } else {
      setIsLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      toast({ title: 'Address copied!' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!wallet.isConnected) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center neon-box">
            <Wallet className="w-12 h-12 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">Connect Your Wallet</h1>
            <p className="text-muted-foreground">Connect your wallet to view your profile and assets.</p>
          </div>
          <Button variant="neon" size="lg" onClick={connect}>
            <Wallet className="w-5 h-5 mr-2" />
            Connect MetaMask
          </Button>
        </div>
      </main>
    );
  }

  const isContractConfigured = contractService.isConfigured();

  const ownedNfts = auctions
    .filter(a => a.nft.ownerAddress.toLowerCase() === wallet.address?.toLowerCase())
    .map(a => a.nft);
    
  const myAuctions = auctions.filter(
    a => a.seller.toLowerCase() === wallet.address?.toLowerCase()
  );
  
  const myBids = auctions.filter(
    a => a.highestBidder.toLowerCase() === wallet.address?.toLowerCase()
  );

  const renderContent = () => {
    if (!isContractConfigured) {
      return (
        <div className="text-center py-16 bg-card border border-border rounded-xl col-span-full">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Contract Not Configured</h3>
          <p className="text-muted-foreground">Please set VITE_CONTRACT_ADDRESS in your .env file.</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="text-center py-16 col-span-full">
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin mb-4" />
          <p className="text-muted-foreground">Loading your profile data...</p>
        </div>
      );
    }

    if (error) {
        return (
            <div className="text-center py-16 bg-card border border-destructive rounded-xl col-span-full">
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Error Loading Data</h3>
                <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
            </div>
        );
    }

    switch (activeTab) {
      case 'owned':
        return ownedNfts.length > 0 ? (
          ownedNfts.map((nft: AppNft, index) => (
            <div key={nft.tokenId} className="gradient-border rounded-xl overflow-hidden bg-card animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              {nft.mediaType === 'image' ? (
                <img src={nft.imageUrl} alt={nft.name} className="w-full aspect-square object-contain" />
              ) : (
                <div className="w-full aspect-square bg-muted flex items-center justify-center">
                  {nft.mediaType === 'audio' && <Music className="w-20 h-20 text-muted-foreground" />}
                  {nft.mediaType === 'video' && <Video className="w-20 h-20 text-muted-foreground" />}
                </div>
              )}
              <div className="p-4">
                <h3 className="font-display font-semibold">{nft.name}</h3>
                <p className="text-sm text-muted-foreground">Token #{nft.tokenId}</p>
              </div>
            </div>
          ))
        ) : <p className="text-muted-foreground col-span-full text-center py-12">You don't own any NFTs from this marketplace yet.</p>;

      case 'auctions':
        return myAuctions.length > 0 ? (
          myAuctions.map((auction, index) => (
            <AuctionCard key={auction.auctionId} auction={auction} index={index} />
          ))
        ) : <p className="text-muted-foreground col-span-full text-center py-12">You haven't created any auctions yet.</p>;

      case 'bids':
        return myBids.length > 0 ? (
          myBids.map((auction, index) => (
            <AuctionCard key={auction.auctionId} auction={auction} index={index} />
          ))
        ) : <p className="text-muted-foreground col-span-full text-center py-12">You haven't placed any bids yet.</p>;
        
      default: return null;
    }
  };

  const tabs = [
    { id: 'owned' as Tab, label: 'Owned NFTs', icon: ImageIcon },
    { id: 'auctions' as Tab, label: 'My Auctions', icon: Gavel },
    { id: 'bids' as Tab, label: 'My Bids', icon: History },
  ];

  return (
    <main className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center neon-box animate-pulse-neon">
              <span className="font-display text-3xl font-bold text-primary-foreground">
                {wallet.address?.slice(2, 4).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="font-display text-2xl font-bold mb-2">
                {shortenAddress(wallet.address!)}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                <Button variant="ghost" size="sm" onClick={copyAddress} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <a href={`https://sepolia.etherscan.io/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Etherscan
                  </Button>
                </a>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-6">
                 <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-display font-bold text-lg text-primary neon-text">
                    {wallet.balance || '0'} ETH
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NFTs Owned</p>
                  <p className="font-display font-bold text-lg">{isLoading ? '...' : ownedNfts.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Auctions</p>
                  <p className="font-display font-bold text-lg">{isLoading ? '...' : myAuctions.length}</p>
                </div>
              </div>
            </div>
            <Link to="/create">
              <Button variant="neon" size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Create NFT
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'neon' : 'ghost'}
              onClick={() => setActiveTab(id)}
              className="gap-2 whitespace-nowrap"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {renderContent()}
        </div>
      </div>
    </main>
  );
};

export default Profile;