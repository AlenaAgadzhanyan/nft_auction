import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppAuction } from '@/lib/contractService';
import { shortenAddress } from '@/lib/web3';
import { Music, Video, Image as ImageIcon } from 'lucide-react';

interface AuctionCardProps {
  auction: AppAuction;
  index?: number;
}

const AuctionCard = ({ auction, index = 0 }: AuctionCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

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

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  const MediaIcon = {
    image: ImageIcon,
    audio: Music,
    video: Video,
  }[auction.nft.mediaType];

  return (
    <Link 
      to={`/auction/${auction.auctionId}`}
      className="group block animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative rounded-xl overflow-hidden gradient-border bg-card transition-all duration-300 hover:scale-[1.02] hover:neon-box">
        <div className="relative aspect-square overflow-hidden">
          {auction.nft.mediaType === 'image' ? (
            <>
              {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
              <img
                src={auction.nft.imageUrl}
                alt={auction.nft.name}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
              />
            </>
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <MediaIcon className="w-20 h-20 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </div>

        <div className="absolute top-0 left-0 p-4 w-full">
            <h3 className="font-display font-semibold text-lg truncate text-white">
              {auction.nft.name}
            </h3>
             <p className="text-sm text-white/70 truncate">
              by {shortenAddress(auction.nft.creatorAddress)}
            </p>
        </div>

        <div className="absolute bottom-0 left-0 p-4 w-full">
          <div className="flex items-end justify-between">
             <div className="glass rounded-lg p-2">
              <p className="text-xs text-white/70 mb-1">
                {parseFloat(auction.highestBid) > 0 ? 'Current Bid' : 'Min Price'}
              </p>
              <p className="font-bold text-primary neon-text">
                {parseFloat(auction.highestBid) > 0 ? auction.highestBid : auction.minPrice} ETH
              </p>
            </div>

            <div className="glass rounded-lg p-2 text-center">
               <p className="text-xs text-white/70 mb-1">Time Left</p>
               <p className="font-bold text-white">{timeLeft}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;