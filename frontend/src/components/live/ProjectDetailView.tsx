import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectDetail } from "../../lib/registryClient";
import { describeTxError } from "../../lib/txErrors";
import { CONTENT_TYPES } from "../../types";
import { sameAddress } from "../../lib/format";
import { Addr } from "./Addr";
import { AgreementHistory } from "./AgreementHistory";
import { useLive } from "./liveContext";
import { ProposalCard } from "./ProposalCard";
import { ProposeChangeForm } from "./ProposeChangeForm";
import { RevenuePanel } from "./RevenuePanel";

export function ProjectDetailView({ projectId }: { projectId: bigint }) {
  const { api, account, refreshKey, refresh } = useLive();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .loadProject(projectId, account)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setError(null);
      })
      .catch((err) => active && setError(describeTxError(err, api.interface).message));
    return () => {
      active = false;
    };
  }, [api, projectId, account, refreshKey]);

  if (error) {
    return (
      <p className="tx tx-fail" role="alert">
        Couldn't load project: {error}
      </p>
    );
  }
  if (!detail || detail.project.id !== projectId) return <p className="muted">Loading project from the chain…</p>;

  const { project, versions, proposals } = detail;
  const activeSplits = versions[versions.length - 1]?.splits ?? [];
  const canPropose =
    project.activeVersion === 0
      ? sameAddress(project.creator, account)
      : activeSplits.some((s) => sameAddress(s.contributor, account));
  const initialForProposal = activeSplits.length ? activeSplits : (proposals[0]?.splits ?? []);
  const splitsOf = (v: number) => versions.find((x) => x.version === v)?.splits ?? [];
  const pending = proposals.filter((p) => p.status === "Pending");
  const closed = proposals.filter((p) => p.status !== "Pending");

  return (
    <div className="project-detail">
      <div className="card panel">
        <div className="panel-head">
          <div>
            <h3 className="detail-title">{project.title}</h3>
            <p className="panel-sub">
              {CONTENT_TYPES[project.contentType] ?? "Unknown type"} · Project #{String(project.id)} · created by{" "}
              <Addr value={project.creator} account={account} />
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refresh} aria-label="Refresh from chain">
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>
        <h4 className="sub-head">Agreement history</h4>
        <AgreementHistory versions={versions} account={account} />
      </div>

      <section aria-label="Proposals" className="proposals">
        <div className="section-head">
          <h3>Proposals</h3>
        </div>
        {canPropose ? (
          <ProposeChangeForm
            key={`${project.id}-${project.activeVersion}`}
            projectId={project.id}
            activeVersion={project.activeVersion}
            initial={initialForProposal}
          />
        ) : (
          <p className="muted small">
            {project.activeVersion === 0
              ? "Only the project creator can propose the initial agreement."
              : "Only contributors in the active agreement can propose changes."}
          </p>
        )}
        {pending.map((p) => (
          <ProposalCard key={String(p.id)} proposal={p} baseSplits={splitsOf(p.baseVersion)} />
        ))}
        {closed.length > 0 && (
          <details className="closed-proposals" open={pending.length === 0}>
            <summary>Closed proposals ({closed.length})</summary>
            {closed.map((p) => (
              <ProposalCard key={String(p.id)} proposal={p} baseSplits={splitsOf(p.baseVersion)} />
            ))}
          </details>
        )}
      </section>

      <RevenuePanel detail={detail} />
    </div>
  );
}
