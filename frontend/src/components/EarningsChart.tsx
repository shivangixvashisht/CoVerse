import { useState } from "react";
import { DEMO_MONTHLY_EARNINGS } from "../data/demo";
import { formatCompact, formatUsd } from "../lib/format";
import { DemoTag } from "./DemoTag";

const W = 640;
const H = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 44 };

function niceMax(v: number): number {
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / step) * step;
}

export function EarningsChart() {
  const data = DEMO_MONTHLY_EARNINGS;
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = niceMax(Math.max(...data.map((d) => d.usd)));
  const ticks = [0, max / 2, max];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(36, slot * 0.56);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const latest = data[data.length - 1]!;
  const prev = data[data.length - 2]!;
  const change = ((latest.usd - prev.usd) / prev.usd) * 100;

  return (
    <section className="card panel" aria-labelledby="earnings-title">
      <div className="panel-head">
        <div>
          <h2 id="earnings-title">Your monthly earnings</h2>
          <p className="panel-sub">
            {formatUsd(latest.usd)} in {latest.month} · <span className="delta-up">+{change.toFixed(1)}%</span> vs{" "}
            {prev.month}
          </p>
        </div>
        <div className="panel-tools">
          <DemoTag />
          <button className="link-btn" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            {asTable ? "View chart" : "View table"}
          </button>
        </div>
      </div>

      {asTable ? (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="num">
                Earnings (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <td>{d.month}</td>
                <td className="num">{formatUsd(d.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart"
            role="img"
            aria-label={`Bar chart of monthly earnings from ${data[0]!.month} to ${latest.month}, demo data`}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
                <text x={PAD.left - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                  ${formatCompact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const top = y(d.usd);
              const h = PAD.top + plotH - top;
              const r = Math.min(4, h);
              const x0 = cx - barW / 2;
              const x1 = cx + barW / 2;
              const base = PAD.top + plotH;
              return (
                <g key={d.month}>
                  {/* Rounded top corners, square at the baseline */}
                  <path
                    d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`}
                    className={`bar ${hover !== null && hover !== i ? "bar-dim" : ""}`}
                  />
                  <text x={cx} y={H - 8} className="tick" textAnchor="middle">
                    {d.month}
                  </text>
                  {/* Hit target larger than the mark */}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}
            {hover === null && (
              <text x={PAD.left + slot * (data.length - 1) + slot / 2} y={y(latest.usd) - 8} className="direct-label" textAnchor="middle">
                {formatUsd(latest.usd)}
              </text>
            )}
          </svg>
          {hover !== null && (
            <div
              className="chart-tooltip"
              style={{
                left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`,
                top: `${(y(data[hover]!.usd) / H) * 100}%`,
              }}
              role="status"
            >
              <span className="muted">{data[hover]!.month}</span>
              <strong>{formatUsd(data[hover]!.usd)}</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
