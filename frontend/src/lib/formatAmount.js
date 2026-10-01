import { formatEther, formatUnits } from "ethers";
import { USDG_TOKEN_ADDRESS } from "./config.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Formats a raw on-chain bond amount for display, choosing the right
 * decimals and symbol based on which token the dispute was actually
 * bonded in. Dividing every amount by 1e18 regardless of token was the
 * bug behind "Bond: 1e-11 ETH" showing up for USDG-denominated disputes —
 * USDG uses 6 decimals, not 18, so that math was silently wrong.
 */
export function formatBondAmount(rawAmount, bondToken) {
  const token = (bondToken || ZERO_ADDRESS).toLowerCase();
  if (token === ZERO_ADDRESS) {
    return { amount: formatEther(rawAmount), symbol: "ETH" };
  }
  if (token === USDG_TOKEN_ADDRESS.toLowerCase()) {
    return { amount: formatUnits(rawAmount, 6), symbol: "USDG" };
  }
  return { amount: formatUnits(rawAmount, 18), symbol: "TOKEN" };
}