import { useCallback, useMemo } from "react";
import { Contract } from "ethers";
import { useWallet } from "./useWallet.jsx";
import { CONTRACTS, USDG_TOKEN_ADDRESS } from "../lib/config.js";
import { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI, ERC20ABI } from "../lib/abis.js";

/**
 * Returns ready-to-call contract instances (read-only if no signer is
 * connected yet, read/write once a wallet is connected). Every call site
 * should check `configured` first — in local/demo setups without deployed
 * addresses, screens fall back to sample data instead of erroring.
 */
export function useContracts() {
  const { provider, address } = useWallet();

  const configured = Boolean(
    CONTRACTS.disputeEscrow && CONTRACTS.barazaRegistry && CONTRACTS.reputationSBT
  );

  const getSigner = useCallback(async () => {
    if (!provider) throw new Error("No wallet provider available.");
    return provider.getSigner();
  }, [provider]);

  const disputeEscrow = useMemo(() => {
    if (!configured || !provider) return null;
    return new Contract(CONTRACTS.disputeEscrow, DisputeEscrowABI, provider);
  }, [provider, configured]);

  const barazaRegistry = useMemo(() => {
    if (!configured || !provider) return null;
    return new Contract(CONTRACTS.barazaRegistry, BarazaRegistryABI, provider);
  }, [provider, configured]);

  const reputationSBT = useMemo(() => {
    if (!configured || !provider) return null;
    return new Contract(CONTRACTS.reputationSBT, ReputationSBTABI, provider);
  }, [provider, configured]);

  /// USDG contract instance — always available (it's a public, permanent
  /// token contract independent of whether Baraza's own contracts are
  /// configured), used for balance/allowance reads and the approve() step.
  // const usdgToken = useMemo(() => {
  //   if (!provider) return null;
  //   return new Contract(USDG_TOKEN_ADDRESS, ERC20ABI, provider);
  // }, [provider]);

  const usdgToken = useMemo(() => {
    if (!provider || !USDG_TOKEN_ADDRESS) return null;
    try {
      return new Contract(USDG_TOKEN_ADDRESS, ERC20ABI, provider);
    } catch (e) {
      console.error("Failed to construct USDG contract instance:", e);
      return null;
    }
  }, [provider]);

  const withSigner = useCallback(
    async (contract) => {
      const signer = await getSigner();
      return contract.connect(signer);
    },
    [getSigner]
  );

  /// Arbitrum Sepolia's base fee can shift between the moment a wallet
  /// estimates gas and the moment the transaction actually lands — ethers'
  /// default estimate has been observed landing just barely under the
  /// current base fee, which the sequencer then rejects outright ("max fee
  /// per gas less than block base fee"). Fetching fresh fee data right
  /// before sending and adding a real buffer (50% over the current base
  /// fee, plus a bumped priority fee) fixes this rather than asking the
  /// user to manually override gas in MetaMask on every transaction.
  const getFeeOverrides = useCallback(
    async (multiplier = 1.5) => {
      if (!provider) return {};
      const feeData = await provider.getFeeData();
      if (!feeData.maxFeePerGas) return {}; // legacy/non-EIP-1559 network — let the wallet decide
      const bump = (value) => (value * BigInt(Math.round(multiplier * 100))) / 100n;
      return {
        maxFeePerGas: bump(feeData.maxFeePerGas),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
          ? bump(feeData.maxPriorityFeePerGas)
          : undefined,
      };
    },
    [provider]
  );

  return { configured, address, disputeEscrow, barazaRegistry, reputationSBT, usdgToken,withSigner, getFeeOverrides };
}
