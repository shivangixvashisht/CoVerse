import type { Contributor } from "../types";
import { formatBps } from "../lib/format";
import { seriesColor } from "../lib/series";

interface Props {
  contributors: Contributor[];
  size?: "sm" | "lg";
  active?: number | null;
  onHover?: (index: number | null) => void;
}

export function SplitBar({ contributors, size = "sm", active = null, onHover }: Props) {
  return (
    <div
      className={`split-bar split-bar-${size}`}
      role="img"
      aria-label={contributors.map((c) => `${c.name} ${formatBps(c.shareBps)}`).join(", ")}
      onMouseLeave={() => onHover?.(null)}
    >
      {contributors.map((c, i) => (
        <span
          key={c.handle}
          className={`split-seg ${active !== null && active !== i ? "split-seg-dim" : ""}`}
          style={{ flexGrow: c.shareBps, background: seriesColor(i) }}
          title={`${c.name} · ${c.role} · ${formatBps(c.shareBps)}`}
          onMouseEnter={() => onHover?.(i)}
        />
      ))}
    </div>
  );
}
