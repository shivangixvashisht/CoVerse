import { useState, type FormEvent } from "react";
import { useTransaction } from "../../hooks/useTransaction";
import { validateSplitRows, type SplitRow } from "../../lib/splits";
import { CONTENT_TYPES } from "../../types";
import { useLive } from "./liveContext";
import { FormErrors, SplitEditor } from "./SplitEditor";
import { TxStatus } from "./TxStatus";

export function CreateProjectForm({ onCreated }: { onCreated: () => void }) {
  const { api, account, refresh } = useLive();
  const [title, setTitle] = useState("");
  const [type, setType] = useState(0);
  const [rows, setRows] = useState<SplitRow[]>([{ address: account, percent: "100" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const tx = useTransaction(api.interface);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: splitErrors, splits } = validateSplitRows(rows);
    const all = [...(title.trim() ? [] : ["Give the project a title."]), ...splitErrors];
    setErrors(all);
    if (all.length) return;
    await tx.run("Create project", () => api.createProject(title.trim(), type, splits), () => {
      refresh();
      onCreated();
    });
  };

  return (
    <form className="card panel live-form" onSubmit={submit} aria-labelledby="create-title">
      <div className="panel-head">
        <div>
          <h3 id="create-title">Create a project</h3>
          <p className="panel-sub">
            This proposes version 1 of the agreement. It only becomes active after every listed contributor approves it
            from their own wallet.
          </p>
        </div>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label className="field">
          <span>Content type</span>
          <select className="input" value={type} onChange={(e) => setType(Number(e.target.value))}>
            {CONTENT_TYPES.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SplitEditor rows={rows} onChange={setRows} idPrefix="create" />
      <FormErrors errors={errors} />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={tx.busy}>
          Create project &amp; propose v1
        </button>
      </div>
      <TxStatus state={tx.state} />
    </form>
  );
}
