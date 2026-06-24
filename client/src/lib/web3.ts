import { useState, useEffect, useCallback } from 'react';

const SEPOLIA_CHAIN_ID = '0xaa36a7';
const SEPOLIA_NETWORK_INFO = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Sepolia test network',
  nativeCurrency: {
    name: 'SepoliaETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  chainId: string | null;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    chainId: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const switchNetwork = async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_NETWORK_INFO],
          });
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
          throw new Error('Failed to switch to Sepolia network.');
        }
      } else {
        console.error('Failed to switch network:', switchError);
        throw new Error('Failed to switch to Sepolia network.');
      }
    }
  };

  const getBalance = async (address: string) => {
    if (!window.ethereum) return null;
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      const balanceInEth = parseInt(balance as string, 16) / 1e18;
      return balanceInEth.toFixed(4);
    } catch {
      return null;
    }
  };

  const updateWalletState = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWallet({ isConnected: false, address: null, balance: null, chainId: null });
      return;
    }

    const address = accounts[0];
    const chainId = (await window.ethereum!.request({ method: 'eth_chainId' })) as string;

    if (chainId !== SEPOLIA_CHAIN_ID) {
      setWallet({ isConnected: false, address, balance: null, chainId });
      return;
    }

    const balance = await getBalance(address);
    setWallet({ isConnected: true, address, balance, chainId });
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (accounts.length > 0) {
        const currentChainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;

        if (currentChainId !== SEPOLIA_CHAIN_ID) {
          await switchNetwork();
        }
        await updateWalletState(accounts);
      }
    } catch (error) {
      console.error('Connection failed:', error);
      setWallet({ isConnected: false, address: null, balance: null, chainId: null });
    } finally {
      setIsConnecting(false);
    }
  }, [updateWalletState]);

  const disconnect = useCallback(() => {
    setWallet({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
    });
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const checkConnection = async () => {
      try {
        const accounts = (await window.ethereum!.request({
          method: 'eth_accounts',
        })) as string[];
        await updateWalletState(accounts);
      } catch (error) {
        console.error('Check connection failed:', error);
        disconnect();
      }
    };

    checkConnection();

    const handleAccountsChanged = (accounts: unknown) => {
      updateWalletState(accounts as string[]);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [disconnect, updateWalletState]);

  return { wallet, connect, disconnect, isConnecting };
};

export const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};