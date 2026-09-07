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

  return { configured, address, disputeEscrow, barazaRegistry, reputationSBT, withSigner };
}
