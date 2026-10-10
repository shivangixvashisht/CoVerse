import { Plus, X } from "lucide-react";
import { bpsToPercent, validateSplitRows, type SplitRow } from "../../lib/splits";

interface Props {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
  idPrefix: string;
}

export function SplitEditor({ rows, onChange, idPrefix }: Props) {
  const { totalBps } = validateSplitRows(rows);
  const update = (i: number, patch: Partial<SplitRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <fieldset className="split-editor">
      <legend>Contributors &amp; shares</legend>
      {rows.map((row, i) => (
        <div className="split-row" key={i}>
          <label className="sr-only" htmlFor={`${idPrefix}-addr-${i}`}>
            Contributor {i + 1} wallet address
          </label>
          <input
            id={`${idPrefix}-addr-${i}`}
            className="input mono"
            placeholder="0x… wallet address"
            value={row.address}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => update(i, { address: e.target.value })}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-pct-${i}`}>
            Contributor {i + 1} share percent
          </label>
          <div className="pct-input">
            <input
              id={`${idPrefix}-pct-${i}`}
              className="input"
              inputMode="decimal"
              placeholder="0"
              value={row.percent}
              onChange={(e) => update(i, { percent: e.target.value })}
            />
            <span aria-hidden="true">%</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove contributor ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            disabled={rows.length === 1}
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <div className="split-editor-foot">
        <button type="button" className="link-btn" onClick={() => onChange([...rows, { address: "", percent: "" }])}>
          <Plus size={14} aria-hidden="true" /> Add contributor
        </button>
        <span className={totalBps === 10_000 ? "check-ok" : "muted"}>Total: {bpsToPercent(totalBps)}%</span>
      </div>
    </fieldset>
  );
}

export function FormErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="form-errors" role="alert">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
