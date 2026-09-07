import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { ARBITRUM_SEPOLIA } from "../lib/config.js";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const provider = useMemo(() => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return new BrowserProvider(window.ethereum);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("No wallet found. Install MetaMask, Rabby, or another injected wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
      const net = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(net);
    } catch (e) {
      setError(e?.message || "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToArbitrumSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARBITRUM_SEPOLIA.chainIdHex }],
      });
    } catch (switchError) {
      if (switchError?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: ARBITRUM_SEPOLIA.chainIdHex,
              chainName: ARBITRUM_SEPOLIA.chainName,
              nativeCurrency: ARBITRUM_SEPOLIA.nativeCurrency,
              rpcUrls: ARBITRUM_SEPOLIA.rpcUrls,
              blockExplorerUrls: ARBITRUM_SEPOLIA.blockExplorerUrls,
            },
          ],
        });
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccounts = (accounts) => setAddress(accounts[0] || null);
    const handleChain = (id) => setChainId(id);
    window.ethereum.on?.("accountsChanged", handleAccounts);
    window.ethereum.on?.("chainChanged", handleChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const isWrongNetwork = chainId && chainId !== ARBITRUM_SEPOLIA.chainIdHex;

  const value = {
    address,
    chainId,
    connecting,
    error,
    provider,
    isWrongNetwork,
    connect,
    disconnect,
    switchToArbitrumSepolia,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
