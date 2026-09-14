import { useCallback, useMemo } from "react";
import { Contract } from "ethers";
import { useWallet } from "./useWallet.jsx";
import { CONTRACTS } from "../lib/config.js";
import { DisputeEscrowABI, BarazaRegistryABI, ReputationSBTABI } from "../lib/abis.js";

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

  return { configured, address, disputeEscrow, barazaRegistry, reputationSBT, withSigner, getFeeOverrides };
}
