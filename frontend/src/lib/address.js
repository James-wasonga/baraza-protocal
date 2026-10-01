/// Shortens a full 0x-address to a display-friendly form. Used wherever a
/// real on-chain address needs to render in limited space — live addresses
/// are 42 characters, which overflows a grid column in monospace font if
/// shown in full (the source of the overlapping-text bug).
export function shortenAddress(addr) {
    if (!addr || typeof addr !== "string" || addr.length < 10) return addr || "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }