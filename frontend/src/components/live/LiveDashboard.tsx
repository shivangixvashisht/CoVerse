import { CheckCircle2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChainProject } from "../../lib/registryClient";
import { describeTxError } from "../../lib/txErrors";
import { CONTENT_TYPES } from "../../types";
import { CreateProjectForm } from "./CreateProjectForm";
import { useLive } from "./liveContext";
import { ProjectDetailView } from "./ProjectDetailView";

export function LiveDashboard() {
  const { api, refreshKey } = useLive();
  const [projects, setProjects] = useState<ChainProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<bigint | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listProjects()
      .then((p) => {
        if (!active) return;
        setProjects(p);
        setError(null);
      })
      .catch((err) => active && setError(describeTxError(err, api.interface).message));
    return () => {
      active = false;
    };
  }, [api, refreshKey]);

  const current = selected ?? projects?.[projects.length - 1]?.id ?? null;
  const showCreate = creating || (projects !== null && projects.length === 0);

  return (
    <div className="live-layout">
      <aside className="card panel live-sidebar" aria-label="On-chain projects">
        <div className="panel-head">
          <h3>Projects on chain</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCreating(true);
              setNotice(null);
            }}
          >
            <Plus size={14} aria-hidden="true" /> New
          </button>
        </div>
        {error && (
          <p className="tx tx-fail" role="alert">
            {error}
          </p>
        )}
        {projects === null && !error && <p className="muted">Loading…</p>}
        {projects?.length === 0 && <p className="muted">No projects yet — create the first one.</p>}
        <ul className="live-projects">
          {projects
            ?.slice()
            .reverse()
            .map((p) => (
              <li key={String(p.id)}>
                <button
                  className="live-project-btn"
                  aria-current={!showCreate && p.id === current ? "true" : undefined}
                  onClick={() => {
                    setSelected(p.id);
                    setCreating(false);
                    setNotice(null);
                  }}
                >
                  <span className="live-project-title">{p.title}</span>
                  <span className="muted small">
                    #{String(p.id)} · {CONTENT_TYPES[p.contentType]} ·{" "}
                    {p.activeVersion ? `v${p.activeVersion} active` : "awaiting approval"}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </aside>

      <div className="live-main">
        {notice && !showCreate && (
          <p className="tx tx-ok" role="status">
            <CheckCircle2 size={15} aria-hidden="true" /> {notice}
          </p>
        )}
        {showCreate ? (
          <CreateProjectForm
            onCreated={() => {
              setCreating(false);
              setSelected(null);
              setNotice(
                "Create project: confirmed. Version 1 is proposed — each listed contributor must now approve it from their own wallet.",
              );
            }}
          />
        ) : current !== null ? (
          <ProjectDetailView projectId={current} />
        ) : null}
      </div>
    </div>
  );
}
