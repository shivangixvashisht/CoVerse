const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatUsd(value: number): string {
  return usd.format(value);
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

/** Basis points (10_000 = 100%) to a percentage label, e.g. 1250 -> "12.5%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** 0x1234…abcd style shortening for display. */
export function shortenAddress(address: string, chars = 4): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function totalBps(shares: { shareBps: number }[]): number {
  return shares.reduce((sum, s) => sum + s.shareBps, 0);
}
