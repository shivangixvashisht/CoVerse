import { sameAddress, shortenAddress } from "../../lib/format";

export function Addr({ value, account }: { value: string; account?: string | null }) {
  return (
    <span className="addr" title={value}>
      <span className="mono">{shortenAddress(value)}</span>
      {sameAddress(value, account) && <span className="you-badge">You</span>}
    </span>
  );
}
