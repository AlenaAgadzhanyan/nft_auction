import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWalletContext } from '@/contexts/WalletContext';
import { toast } from '@/hooks/use-toast';
import { pinataService } from '@/lib/pinataService';
import { contractService, formatEth } from '@/lib/contractService';
import { 
  Upload, 
  Image as ImageIcon, 
  Music, 
  Video, 
  X, 
  Sparkles,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';

type MediaType = 'image' | 'audio' | 'video';

const CreateNFT = () => {
  const navigate = useNavigate();
  const { wallet, connect } = useWalletContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    minPrice: '',
    duration: '24',
  });
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [listingFee, setListingFee] = useState<bigint | null>(null);

  useEffect(() => {
    const fetchFee = async () => {
      if (contractService.isConfigured()) {
        try {
          const fee = await contractService.getListingFee();
          setListingFee(fee);
        } catch (error) {
          console.error("Failed to fetch listing fee:", error);
          toast({ title: 'Error', description: 'Could not fetch listing fee from the contract.', variant: 'destructive' });
        }
      }
    };
    fetchFee();
  }, []);

  const acceptedTypes: Record<MediaType, string> = {
    image: 'image/*',
    audio: 'audio/*',
    video: 'video/*',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      if (mediaType === 'image') {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.isConnected) {
      connect();
      return;
    }

    if (!file || !formData.name || !formData.minPrice || listingFee === null) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    
    if (!import.meta.env.VITE_PINATA_JWT) {
        toast({ title: 'Pinata not configured', description: 'VITE_PINATA_JWT is missing.', variant: 'destructive' });
        return;
    }

    setIsCreating(true);

    try {
      setUploadStatus('Uploading file to IPFS...');
      const fileResult = await pinataService.uploadFile(file, { name: formData.name, mediaType: mediaType });

      setUploadStatus('Uploading metadata to IPFS...');
      const metadataResult = await pinataService.uploadMetadata(
        formData.name, formData.description, fileResult.ipfsUrl,
        [{ trait_type: 'Media Type', value: mediaType }, { trait_type: 'Creator', value: wallet.address || '' }]
      );

      let txHash: string | null = null;

      if (contractService.isConfigured()) {
        setUploadStatus('Minting NFT and creating auction...');
        const durationSeconds = parseInt(formData.duration) * 3600;
        const mintResult = await contractService.mintAndCreateAuction(
          metadataResult.tokenUri,
          formData.minPrice,
          durationSeconds,
          listingFee
        );
        txHash = mintResult.txHash;
      }

      toast({
        title: 'NFT Created Successfully!',
        description: (
          <div className="flex flex-col gap-1">
            <span>Your NFT has been minted and the auction started.</span>
            {txHash && (
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary underline flex items-center gap-1">
                View on Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ),
      });

      navigate('/');
    } catch (error) {
      console.error('Create NFT error:', error);
      toast({ title: 'Failed to create NFT', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsCreating(false);
      setUploadStatus('');
    }
  };

  const mediaOptions = [
    { type: 'image' as MediaType, icon: ImageIcon, label: 'Image' },
    { type: 'audio' as MediaType, icon: Music, label: 'Audio' },
    { type: 'video' as MediaType, icon: Video, label: 'Video' },
  ];

  return (
    <main className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Create Your NFT</h1>
          <p className="text-muted-foreground">Mint your digital artwork and start an auction.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="space-y-3">
            <Label>Media Type</Label>
            <div className="grid grid-cols-3 gap-3">
              {mediaOptions.map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setMediaType(type); handleRemoveFile(); }}
                  className={`p-4 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    mediaType === type ? 'border-primary bg-primary/10 neon-box' : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${mediaType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${mediaType === type ? 'text-primary' : ''}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Upload File</Label>
            <input ref={fileInputRef} type="file" accept={acceptedTypes[mediaType]} onChange={handleFileChange} className="hidden" />
            {!file ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card transition-all duration-300 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Click to upload</p>
                  <p className="text-sm text-muted-foreground">Max file size: 50MB</p>
                </div>
              </button>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-border">
                {preview && mediaType === 'image' ? (
                  <img src={preview} alt="Preview" className="w-full aspect-video object-contain" />
                ) : (
                  <div className="w-full aspect-video bg-card flex items-center justify-center">
                    {mediaType === 'audio' && <Music className="w-16 h-16 text-primary" />}
                    {mediaType === 'video' && <Video className="w-16 h-16 text-primary" />}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 glass p-3 flex items-center justify-between">
                  <span className="text-sm truncate flex-1 mr-2">{file.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Enter NFT name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-card border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Describe your NFT..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-card border-border min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Minimum Price (ETH) *</Label>
                <Input id="minPrice" type="number" step="0.01" placeholder="0.1" value={formData.minPrice} onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })} className="bg-card border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Auction Duration (hours)</Label>
                <Input id="duration" type="number" placeholder="24" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} className="bg-card border-border" />
              </div>
            </div>
          </div>

          {listingFee !== null && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Info className="w-5 h-5 text-primary flex-shrink-0"/>
                <p className="text-sm text-muted-foreground">
                    A one-time listing fee of <span className="font-bold text-primary">{formatEth(listingFee)} ETH</span> will be charged to start the auction.
                </p>
            </div>
          )}

          <Button type="submit" variant="neon" size="xl" className="w-full" disabled={isCreating || listingFee === null}>
            {isCreating ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{uploadStatus || 'Creating NFT...'}</>
            ) : wallet.isConnected ? (
              <><Sparkles className="w-5 h-5 mr-2" />Create NFT & Start Auction</>
            ) : (
              'Connect Wallet to Create'
            )}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default CreateNFT;