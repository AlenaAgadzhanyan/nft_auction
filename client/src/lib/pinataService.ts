interface UploadResult {
  success: boolean;
  ipfsHash: string;
  // This should be the ipfs:// URI
  ipfsUrl: string;
  gatewayUrl: string;
}

interface MetadataResult {
  success: boolean;
  ipfsHash: string;
  // This is the ipfs:// URI for the metadata JSON
  tokenUri: string;
  gatewayUrl: string;
}

class PinataService {
  private pinataJWT = import.meta.env.VITE_PINATA_JWT;
  private gateway = "https://gateway.pinata.cloud";

  async uploadFile(file: File, metadata?: Record<string, string>): Promise<UploadResult> {
    if (!this.pinataJWT) {
      throw new Error("VITE_PINATA_JWT is not set in your environment variables.");
    }

    const formData = new FormData();
    formData.append("file", file);

    if (metadata) {
      formData.append("pinataMetadata", JSON.stringify({
        name: file.name,
        keyvalues: metadata,
      }));
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.pinataJWT}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Pinata upload error:", error);
      throw new Error(`Failed to upload file to IPFS: ${res.statusText}`);
    }

    const result = await res.json();
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      ipfsUrl: `ipfs://${result.IpfsHash}`,
      gatewayUrl: `${this.gateway}/ipfs/${result.IpfsHash}`,
    };
  }

  async uploadMetadata(
    name: string,
    description: string,
    mediaIpfsUrl: string, 
    attributes?: Array<{ trait_type: string; value: string }>
  ): Promise<MetadataResult> {
    if (!this.pinataJWT) {
      throw new Error("VITE_PINATA_JWT is not set in your environment variables.");
    }
    
    const mediaType = attributes?.find(a => a.trait_type === "Media Type")?.value;

    const pinataContent: any = {
      name,
      description,
      image: mediaIpfsUrl,
      attributes: attributes || [],
    };
    
    if (mediaType === 'video' || mediaType === 'audio') {
      pinataContent.animation_url = mediaIpfsUrl;
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.pinataJWT}`,
      },
      body: JSON.stringify({
        pinataContent,
        pinataMetadata: {
          name: `${name}-metadata.json`,
        },
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Pinata metadata upload error:", error);
      throw new Error("Failed to upload metadata to IPFS");
    }

    const result = await res.json();
    return {
      success: true,
      ipfsHash: result.IpfsHash,
      tokenUri: `ipfs://${result.IpfsHash}`,
      gatewayUrl: `${this.gateway}/ipfs/${result.IpfsHash}`,
    };
  }

  parseIpfsUrl(ipfsUrl: string): string {
    return ipfsUrl.startsWith("ipfs://") ? ipfsUrl.substring(7) : ipfsUrl;
  }
}

export const pinataService = new PinataService();
