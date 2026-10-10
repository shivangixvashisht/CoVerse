import { isAddress, ZeroAddress } from "ethers";

/** Mirrors the contract: 10_000 basis points == 100%, at most 50 contributors. */
export const TOTAL_BPS = 10_000;
export const MAX_CONTRIBUTORS = 50;

export interface SplitRow {
  address: string;
  percent: string;
}

/** "33.33" -> 3333. Returns null for anything that is not a number with at most 2 decimals. */
export function percentToBps(percent: string): number | null {
  const s = percent.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Client-side checks that mirror the contract's rules so users get feedback before signing.
 * The contract remains the authority; it re-checks everything.
 */
export function validateSplitRows(rows: SplitRow[]): {
  errors: string[];
  splits: { contributor: string; shareBps: number }[];
  totalBps: number;
} {
  const errors: string[] = [];
  const splits: { contributor: string; shareBps: number }[] = [];
  const seen = new Set<string>();
  let totalBps = 0;

  if (rows.length === 0) errors.push("Add at least one contributor.");
  if (rows.length > MAX_CONTRIBUTORS) errors.push(`At most ${MAX_CONTRIBUTORS} contributors are allowed.`);

  rows.forEach((row, i) => {
    const n = i + 1;
    const address = row.address.trim();
    const bps = percentToBps(row.percent);
    if (!isAddress(address)) errors.push(`Row ${n}: enter a valid wallet address (0x…).`);
    else if (address.toLowerCase() === ZeroAddress) errors.push(`Row ${n}: the zero address cannot be a contributor.`);
    else if (seen.has(address.toLowerCase())) errors.push(`Row ${n}: this address is already listed.`);
    if (bps === null) errors.push(`Row ${n}: enter a share like 25 or 33.33.`);
    else if (bps === 0) errors.push(`Row ${n}: shares must be greater than 0%.`);
    if (isAddress(address)) seen.add(address.toLowerCase());
    if (bps !== null) totalBps += bps;
    if (isAddress(address) && bps) splits.push({ contributor: address, shareBps: bps });
  });

  if (rows.length > 0 && totalBps !== TOTAL_BPS) {
    errors.push(`Shares must total exactly 100% (currently ${bpsToPercent(totalBps)}%).`);
  }
  return { errors, splits, totalBps };
}
