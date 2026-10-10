import type { AgreementVersionView } from "../../lib/registryClient";
import { formatBps } from "../../lib/format";
import { SplitBar } from "../SplitBar";
import { Addr } from "./Addr";

export function AgreementHistory({ versions, account }: { versions: AgreementVersionView[]; account: string }) {
  if (!versions.length) {
    return (
      <p className="muted empty-note">
        No agreement is active yet. The initial proposal below needs every listed contributor's approval.
      </p>
    );
  }
  const latest = versions.length;
  return (
    <ol className="versions" aria-label="Agreement versions">
      {[...versions].reverse().map((v) => (
        <li key={v.version} className={`version ${v.version === latest ? "is-active" : ""}`}>
          <div className="version-head">
            <strong>Version {v.version}</strong>
            {v.version === latest ? <span className="pill pill-available">Active</span> : <span className="pill pill-planned">Historical</span>}
            <span className="muted version-meta">
              Proposal #{String(v.proposalId)} · block {v.activatedBlock} · {new Date(v.activatedAt * 1000).toLocaleString()}
            </span>
          </div>
          <SplitBar
            contributors={v.splits.map((s) => ({ name: s.contributor, handle: s.contributor, role: "", shareBps: s.shareBps }))}
          />
          <ul className="share-list">
            {v.splits.map((s) => (
              <li key={s.contributor}>
                <Addr value={s.contributor} account={account} />
                <span className="share">{formatBps(s.shareBps)}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
