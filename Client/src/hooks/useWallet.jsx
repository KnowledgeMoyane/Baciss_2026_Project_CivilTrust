import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_CONFIG } from '../config/contract';

// ── Context ──
const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);         // Connected wallet address
  const [role, setRole] = useState(null);                // 'municipal' | 'contractor' | 'ward' | null
  const [provider, setProvider] = useState(null);        // ethers BrowserProvider
  const [contract, setContract] = useState(null);        // ethers Contract (read-only)
  const [signer, setSigner] = useState(null);            // ethers Signer (write)
  const [signedContract, setSignedContract] = useState(null); // Contract connected to signer
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Shortened address for display: 0x1234...abcd
  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : '';

  // ── Ensure correct chain ──
  const ensureSepolia = useCallback(async () => {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== CHAIN_CONFIG.chainId) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CHAIN_CONFIG.chainId }],
        });
      }
    } catch (err) {
      // Chain not added — try adding it
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CHAIN_CONFIG.chainId,
            chainName: CHAIN_CONFIG.chainName,
            rpcUrls: [CHAIN_CONFIG.rpcUrl],
            blockExplorerUrls: [CHAIN_CONFIG.blockExplorer],
            nativeCurrency: CHAIN_CONFIG.currency,
          }],
        });
      } else {
        throw err;
      }
    }
  }, []);

  // ── Detect on-chain role ──
  const detectRole = useCallback(async (address, readContract) => {
    try {
      // Check municipal first (most common for the deployer)
      const municipal = await readContract.isMunicipal(address);
      if (municipal) return 'municipal';

      // Check if contractor for any tender
      const contractorIds = await readContract.getContractorTenderIds(address);
      if (contractorIds.length > 0) return 'contractor';

      // Check if globally registered ward rep
      const wardRep = await readContract.isGlobalWardRep(address);
      if (wardRep) return 'ward';

      return null;
    } catch (err) {
      console.error('Role detection failed:', err);
      return null;
    }
  }, []);

  // ── Connect Wallet ──
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      await ensureSepolia();

      const browserProvider = new BrowserProvider(window.ethereum);
      const walletSigner = await browserProvider.getSigner();
      const address = await walletSigner.getAddress();

      const readContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, browserProvider);
      const writeContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, walletSigner);

      const detectedRole = await detectRole(address, readContract);

      setProvider(browserProvider);
      setSigner(walletSigner);
      setContract(readContract);
      setSignedContract(writeContract);
      setAccount(address);
      setRole(detectedRole);

      return { address, role: detectedRole };
    } catch (err) {
      console.error('Wallet connection failed:', err);
      setError(err.message || 'Failed to connect wallet');
      return null;
    } finally {
      setLoading(false);
    }
  }, [ensureSepolia, detectRole]);

  // ── Disconnect Wallet ──
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setRole(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setSignedContract(null);
    setError(null);
  }, []);

  // ── Listen for MetaMask account/chain changes ──
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // Re-connect with new account to re-detect role
        connectWallet();
      }
    };

    const handleChainChanged = () => {
      // Reload to re-initialize with new chain
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [account, connectWallet, disconnectWallet]);

  const value = {
    account,
    shortAddress,
    role,
    provider,
    contract,         // Read-only contract instance
    signedContract,   // Write contract instance (connected to signer)
    loading,
    error,
    connectWallet,
    disconnectWallet,
    isConnected: !!account,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export default function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
