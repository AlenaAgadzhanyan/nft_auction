
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletContext } from '@/contexts/WalletContext';
import { shortenAddress } from '@/lib/web3';
import { contractService, AppAuction } from '@/lib/contractService';
import { toast } from '@/hooks/use-toast';
import { 
  Clock, 
  Gavel, 
  ArrowLeft, 
  User, 
  Music,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle2,
  LucideIcon
} from 'lucide-react';

const AuctionDetail = () => {
  const { id } = useParams();
  const { wallet, connect } = useWalletContext();
  const [auction, setAuction] = useState<AppAuction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [isEndingAuction, setIsEndingAuction] = useState(false);
  const [isClaimingAuction, setIsClaimingAuction] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const fetchAuction = useCallback(async () => {
    if (!id || !contractService.isConfigured()) {
      setError('Contract service not configured or invalid auction ID.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const auctionId = parseInt(id);
      if (isNaN(auctionId)) {
        throw new Error('Invalid auction ID format.');
      }
      const auctionData = await contractService.getAuctionDetails(auctionId);
      setAuction(auctionData);
      if (!auctionData) {
        setError('Auction not found. It might have ended or never existed.');
      }
    } catch (err) {
      console.error("Failed to fetch auction:", err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while loading auction data.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAuction();
  }, [fetchAuction]);

  useEffect(() => {
    if (!auction || !auction.active) {
      setTimeLeft('Ended');
      return;
    }

    const timer = setInterval(() => {
      const diff = auction.endTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Ended');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  const handlePlaceBid = async () => {
    if (!wallet.isConnected) {
      connect();
      toast({ title: 'Connect Wallet', description: 'Please connect your wallet to place a bid.'});
      return;
    }
    if (!auction) return;

    const bidValue = parseFloat(bidAmount);
    if (isNaN(bidValue) || bidValue <= 0) {
      toast({ title: 'Invalid bid', description: 'Please enter a valid bid amount.', variant: 'destructive' });
      return;
    }

    const currentBid = parseFloat(auction.highestBid);
    const minPrice = parseFloat(auction.minPrice);
    const requiredAmount = currentBid > 0 ? currentBid : minPrice;

    if (bidValue <= requiredAmount) {
      toast({ 
        title: 'Bid too low', 
        description: `Your bid must be higher than ${requiredAmount} ETH`,
        variant: 'destructive' 
      });
      return;
    }

    setIsPlacingBid(true);
    try {
      const txHash = await contractService.placeBid(auction.auctionId, bidAmount);
      toast({
        title: 'Bid placed successfully!',
        description: (
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
            Your bid of {bidAmount} ETH has been recorded. View on Etherscan <ExternalLink className="w-3 h-3" />
          </a>
        ),
      });
      setBidAmount('');
      setTimeout(() => fetchAuction(), 2000);
    } catch (error) {
      console.error('Bid error:', error);
      toast({ title: 'Bid failed', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsPlacingBid(false);
    }
  };
  
  const handleEndAuction = async () => {
    if (!auction) return;
    setIsEndingAuction(true);
    try {
      const txHash = await contractService.endAuction(auction.auctionId);
      toast({
        title: 'Auction Ended Successfully',
        description: (
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
            The auction has been formally closed. View on Etherscan <ExternalLink className="w-3 h-3" />
          </a>
        ),
      });
      setTimeout(() => fetchAuction(), 2000);
    } catch (error) {
       console.error('End auction error:', error);
      toast({ title: 'Failed to End Auction', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsEndingAuction(false);
    }
  }

  const handleClaimAuction = async () => {
    if (!auction || !auction.highestBid) return;
    setIsClaimingAuction(true);
    try {
      const txHash = await contractService.claimAuction(auction.auctionId, auction.highestBid);
      toast({
        title: 'NFT Claimed!',
        description: (
          <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
            You are now the new owner of the NFT. View on Etherscan <ExternalLink className="w-3 h-3" />
          </a>
        ),
      });
      setTimeout(() => fetchAuction(), 2000);
    } catch (error) {
      console.error('Claim auction error:', error);
      toast({ title: 'Failed to Claim NFT', description: error instanceof Error ? error.message : 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsClaimingAuction(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
          <h1 className="font-display text-xl">Loading Auction...</h1>
          <p className="text-muted-foreground">Fetching data from the blockchain.</p>
        </div>
      </main>
    );
  }

  if (error || !auction) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center space-y-4">
           <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="font-display text-2xl">Auction Not Found</h1>
          <p className="text-muted-foreground max-w-sm">{error || 'This auction could not be found. It may have ended or never existed.'}</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/">
              <Button variant="neon">Back to Marketplace</Button>
            </Link>
            <Button variant="outline" onClick={fetchAuction}><RefreshCw className="w-4 h-4"/></Button>
          </div>
        </div>
      </main>
    );
  }
  
  const connectedAddress = wallet.isConnected && wallet.address ? wallet.address.trim().toLowerCase() : null;
  const sellerAddress = auction.seller ? auction.seller.trim().toLowerCase() : null;
  const winnerAddress = auction.highestBidder ? auction.highestBidder.trim().toLowerCase() : null;

  const isSeller = !!(connectedAddress && sellerAddress && connectedAddress === sellerAddress);
  const isWinner = !!(connectedAddress && winnerAddress && connectedAddress === winnerAddress);

  const MediaIconMap: { [key: string]: LucideIcon } = { image: ImageIcon, audio: Music, video: Video };
  const MediaIcon = MediaIconMap[auction.nft.mediaType] || ImageIcon;

  const isEnded = !auction.active || auction.endTime.getTime() <= Date.now();
  const canEnd = isSeller && auction.active && auction.endTime.getTime() <= Date.now();
  const canClaim = isWinner && !auction.active && !auction.claimed && parseFloat(auction.highestBid) > 0;

  const renderAuctionStatus = () => {
    if (canEnd) {
      return (
        <Button variant="destructive" size="lg" onClick={handleEndAuction} disabled={isEndingAuction} className="w-full">
          {isEndingAuction ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Gavel className="w-4 h-4 mr-2"/>}
          {isEndingAuction ? 'Ending Auction...' : 'End Auction'}
        </Button>
      );
    }

    if (isEnded) {
      return (
        <div className="text-center pt-4 space-y-4">
          <h3 className="font-bold text-lg">Auction Ended</h3>
          {parseFloat(auction.highestBid) > 0 ? (
            <div className="space-y-4">
                <p className="text-muted-foreground">Won by {shortenAddress(auction.highestBidder)} with a bid of {auction.highestBid} ETH.</p>
                {canClaim && (
                  <Button variant="neon" size="lg" onClick={handleClaimAuction} disabled={isClaimingAuction} className="w-full">
                    {isClaimingAuction ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>}
                    {isClaimingAuction ? 'Claiming NFT...' : `Claim NFT for ${auction.highestBid} ETH`}
                  </Button>
                )}
                {auction.claimed && (
                  <div className="flex items-center justify-center gap-2 text-green-500 font-semibold">
                    <CheckCircle2 className="w-5 h-5"/>
                    <span>NFT has been claimed by the winner.</span>
                  </div>
                )}
            </div>
          ) : (
            <p className="text-muted-foreground">This auction ended without any bids.</p>
          )}
        </div>
      );
    }

    if (isSeller) {
       return (
        <div className="text-center pt-4 bg-muted/50 rounded-lg pb-4">
          <Info className="w-8 h-8 text-primary mx-auto mb-2 mt-4"/>
          <h3 className="font-bold text-lg">This is your auction</h3>
          <p className="text-muted-foreground text-sm">You cannot place a bid on an auction you created.</p>
        </div>
      )
    }

    return (
       <div className="flex gap-3 pt-2">
        <Input 
          type="number" 
          placeholder={`> ${parseFloat(auction.highestBid) > 0 ? auction.highestBid : auction.minPrice} ETH`}
          value={bidAmount} 
          onChange={(e) => setBidAmount(e.target.value)} 
          className="bg-background border-border" 
          step="0.01" 
          disabled={isPlacingBid}
        />
        <Button 
          variant="neon" 
          size="lg" 
          onClick={handlePlaceBid} 
          disabled={isPlacingBid} 
          className="whitespace-nowrap"
        >
          {isPlacingBid ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Gavel className="w-4 h-4 mr-2" />
          )}
          {isPlacingBid ? 'Placing Bid...' : wallet.isConnected ? 'Place Bid' : 'Connect to Bid'}
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4 animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden gradient-border aspect-square bg-muted">
               {(() => {
                const { imageUrl, mediaType, name } = auction.nft;
                if (!imageUrl) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mb-2" />
                      <p className="text-sm">Media not available</p>
                    </div>
                  );
                }

                switch (mediaType) {
                  case 'video':
                    return <video src={imageUrl} controls className="w-full h-full object-contain">Your browser does not support the video tag.</video>;
                  case 'audio':
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4">
                        <Music className="w-24 h-24 text-primary mb-4" />
                        <audio src={imageUrl} controls className="w-full">Your browser does not support the audio element.</audio>
                      </div>
                    );
                  default:
                    return <img src={imageUrl} alt={name} className="w-full h-full object-cover" />;
                }
              })()}
              <div className="absolute top-4 left-4 glass rounded-full px-4 py-2 flex items-center gap-2">
                <MediaIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium capitalize">{auction.nft.mediaType}</span>
              </div>
            </div>
          </div>
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">{auction.nft.name}</h1>
              <p className="text-muted-foreground">{auction.nft.description}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Creator</p>
                  <p className="text-sm font-medium">{shortenAddress(auction.nft.creatorAddress)}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-muted-foreground">Time Left</span>
                </div>
                <span className={`font-display font-bold text-xl ${!auction.active ? 'text-destructive' : ''}`}>{timeLeft}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Min Price</p>
                  <p className="font-display font-bold text-lg">{auction.minPrice} ETH</p>
                </div>
                <div className="glass rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Current Bid</p>
                  <p className="font-display font-bold text-lg text-primary neon-text">{parseFloat(auction.highestBid) > 0 ? `${auction.highestBid} ETH` : 'No bids'}</p>
                </div>
              </div>
              {auction.highestBidder && auction.highestBidder !== '0x0000000000000000000000000000000000000000' && (
                <p className="text-sm text-muted-foreground">Highest bidder: {shortenAddress(auction.highestBidder)}</p>
              )}
              {renderAuctionStatus()}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuctionDetail;
