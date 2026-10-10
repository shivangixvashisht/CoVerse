import { useState, type FormEvent } from "react";
import { useTransaction } from "../../hooks/useTransaction";
import type { SplitEntry } from "../../lib/registryClient";
import { bpsToPercent, validateSplitRows, type SplitRow } from "../../lib/splits";
import { useLive } from "./liveContext";
import { FormErrors, SplitEditor } from "./SplitEditor";
import { TxStatus } from "./TxStatus";

interface Props {
  projectId: bigint;
  activeVersion: number;
  initial: SplitEntry[];
}

export function ProposeChangeForm({ projectId, activeVersion, initial }: Props) {
  const { api, refresh } = useLive();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SplitRow[]>(() =>
    initial.map((s) => ({ address: s.contributor, percent: bpsToPercent(s.shareBps) })),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const tx = useTransaction(api.interface);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: splitErrors, splits } = validateSplitRows(rows);
    setErrors(splitErrors);
    if (splitErrors.length) return;
    await tx.run("Propose change", () => api.proposeAgreement(projectId, splits), () => {
      refresh();
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <div className="propose-cta">
        <button className="btn btn-secondary" onClick={() => setOpen(true)}>
          {activeVersion === 0 ? "Propose a new initial agreement" : "Propose a change"}
        </button>
        <TxStatus state={tx.state} />
      </div>
    );
  }

  return (
    <form className="card panel live-form" onSubmit={submit} aria-label="Propose agreement change">
      <div className="panel-head">
        <div>
          <h3>{activeVersion === 0 ? "Propose initial agreement" : `Propose version ${activeVersion + 1}`}</h3>
          <p className="panel-sub">
            Edit the full contributor list: add, remove or change shares. Everyone in the current agreement and anyone
            you add must approve before it can activate. Proposing does not count as your approval.
          </p>
        </div>
      </div>
      <SplitEditor rows={rows} onChange={setRows} idPrefix={`propose-${projectId}`} />
      <FormErrors errors={errors} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={tx.busy}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit" disabled={tx.busy}>
          Submit proposal
        </button>
      </div>
      <TxStatus state={tx.state} />
    </form>
  );
}
