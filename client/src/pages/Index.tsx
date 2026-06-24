
import { useState, useEffect, useCallback, useRef } from 'react';
import { contractService, AppAuction } from '@/lib/contractService';
import { realtimeService, RealtimeData } from '@/services/realtimeService';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, Sparkles, AlertTriangle, Loader2, Compass } from 'lucide-react';

const Index = () => {
  const [auctions, setAuctions] = useState<AppAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'audio' | 'video'>('all');
  
  const auctionsRef = useRef<HTMLDivElement>(null);

  const isContractConfigured = contractService.isConfigured();

  const fetchAuctions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedAuctions = await contractService.getAllAuctions();
      setAuctions(fetchedAuctions);
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching auctions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effect for initial data fetching
  useEffect(() => {
    if (isContractConfigured) {
      fetchAuctions();
    } else {
      setIsLoading(false);
    }
  }, [fetchAuctions, isContractConfigured]);

  // Effect for real-time updates
  useEffect(() => {
    if (!isContractConfigured) return;

    realtimeService.connect('ws://localhost:3001');

    const handleRealtimeUpdate = (update: RealtimeData) => {
      console.log('Real-time update received in component:', update);

      if (update.action === 'INITIAL_LOAD') {
        setAuctions(update.data);
        return;
      }

      // When a new bid is placed
      if (update.table === 'bids' && update.action === 'INSERT') {
        const newBid = {
          bidderAddress: update.data.bidder_address,
          amount: parseFloat(update.data.amount),
        };
        setAuctions(prev => prev.map(auc =>
          auc.auctionId.toString() === update.data.auction_id
            ? {
                ...auc,
                bids: [...(auc.bids || []), newBid].sort((a, b) => b.amount - a.amount),
                highestBid: Math.max(auc.highestBid, newBid.amount)
              }
            : auc
        ));
      }

      // When an auction's status changes (e.g., ended, claimed)
      if (update.table === 'auctions' && update.action === 'UPDATE') {
        setAuctions(prev => prev.map(auc =>
          auc.auctionId.toString() === update.data.auction_id
            ? { ...auc, active: update.data.active, claimed: update.data.claimed }
            : auc
        ));
      }

      // When a brand new auction is created
      if (update.table === 'auctions' && update.action === 'INSERT') {
        console.log("New auction detected. Re-fetching data for consistency...");
        fetchAuctions();
      }
    };

    realtimeService.subscribe(handleRealtimeUpdate);

    return () => {
      realtimeService.unsubscribe(handleRealtimeUpdate);
    };
  }, [fetchAuctions, isContractConfigured]);

  const filteredAuctions = auctions.filter((auction) => {
    const matchesSearch = auction.nft.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || auction.nft.mediaType === filter;
    return matchesSearch && matchesFilter;
  });

  const activeAuctions = filteredAuctions.filter(a => a.active);
  
  const handleExploreClick = () => {
    auctionsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderContent = () => {
    if (!isContractConfigured) {
      return (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Contract Not Configured</h3>
          <p className="text-muted-foreground">Please set VITE_CONTRACT_ADDRESS in your .env file.</p>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin mb-4" />
          <p className="text-muted-foreground">Loading auctions from the blockchain...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center py-16 bg-card border border-destructive rounded-xl">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Error Loading Auctions</h3>
          <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
        </div>
      );
    }
    if (activeAuctions.length > 0) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeAuctions.map((auction, index) => (
            <AuctionCard key={auction.auctionId} auction={auction} index={index} />
          ))}
        </div>
      );
    }
    return (
      <div className="text-center py-16 bg-card border border-border rounded-xl">
        <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Active Auctions Found</h3>
        <p className="text-muted-foreground">Check back later or try adjusting your filters.</p>
      </div>
    );
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative text-center py-20 md:py-32 lg:py-40 bg-card/50 overflow-hidden border-b">
         <div 
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] opacity-75"
         ></div>
        <div className="container mx-auto px-4 relative">
          <Sparkles className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-4">
            Discover, Bid, and Own Exclusive NFTs
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg md:text-xl mb-8">
            The decentralized marketplace for unique digital assets. 
            Real-time bidding, transparent history, and complete ownership.
          </p>
          <Button size="lg" className="text-lg" onClick={handleExploreClick}>
            Explore Auctions
          </Button>
        </div>
      </section>

      {/* Auctions Gallery Section */}
      <section ref={auctionsRef} className="container mx-auto px-4 py-16">
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Live Auctions</CardTitle>
             <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4">
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                    placeholder="Search NFTs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full sm:w-80 bg-background focus:border-primary"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    {(['all', 'image', 'audio', 'video'] as const).map((type) => (
                    <Button
                        key={type}
                        variant={filter === type ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter(type)}
                        className="capitalize"
                    >
                        {type}
                    </Button>
                    ))}
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Index;
