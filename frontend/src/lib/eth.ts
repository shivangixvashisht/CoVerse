import { formatEther, parseEther } from "ethers";

export const formatEth = (wei: bigint) =>
  `${Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`;

/** Parse a user-entered ETH amount. Returns null if invalid or not positive. */
export function parseEthInput(value: string): bigint | null {
  const s = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(s)) return null;
  try {
    const wei = parseEther(s);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}
