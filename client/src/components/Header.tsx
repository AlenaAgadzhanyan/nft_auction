
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useWalletContext } from '@/contexts/WalletContext';
import { shortenAddress } from '@/lib/web3';
import { Wallet, Plus, User, Home, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const Header = () => {
  const { wallet, connect, disconnect, isConnecting } = useWalletContext();
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Marketplace', icon: Home },
    { path: '/create', label: 'Create', icon: Plus },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center neon-box">
              <span className="font-display font-bold text-primary-foreground text-lg">N</span>
            </div>
            <span className="font-display font-bold text-xl gradient-text hidden sm:block">
              NFT Auction
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ path, label, icon: Icon }) => (
              <Link key={path} to={path}>
                <Button
                  variant={location.pathname === path ? 'neon' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {wallet.isConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="neon" className="gap-2">
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">{shortenAddress(wallet.address!)}</span>
                    <span className="text-xs opacity-70">{wallet.balance} ETH</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass border-primary/30 w-48">
                  <DropdownMenuItem className="text-muted-foreground text-xs">
                    {wallet.address}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <Link to="/profile">
                    <DropdownMenuItem className="cursor-pointer gap-2">
                      <User className="w-4 h-4" />
                      Profile
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    className="cursor-pointer gap-2 text-destructive"
                    onClick={disconnect}
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="neon" 
                onClick={connect}
                disabled={isConnecting}
                className="gap-2"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            )}

            {/* Mobile nav */}
            <div className="flex md:hidden items-center gap-1">
              {navLinks.map(({ path, icon: Icon }) => (
                <Link key={path} to={path}>
                  <Button
                    variant={location.pathname === path ? 'neon' : 'ghost'}
                    size="icon"
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
