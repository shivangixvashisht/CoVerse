import { Check, Circle, X } from "lucide-react";
import { useTransaction } from "../../hooks/useTransaction";
import type { ProposalView, SplitEntry } from "../../lib/registryClient";
import { formatBps, sameAddress } from "../../lib/format";
import { Addr } from "./Addr";
import { useLive } from "./liveContext";
import { TxStatus } from "./TxStatus";

const STATUS_CLASS: Record<ProposalView["status"], string> = {
  Pending: "pill-in-development",
  Activated: "pill-available",
  Rejected: "pill-rejected",
  Cancelled: "pill-planned",
  Superseded: "pill-planned",
};

function changeLabel(s: SplitEntry, base: SplitEntry[]): string | null {
  const before = base.find((b) => sameAddress(b.contributor, s.contributor));
  if (!base.length) return null;
  if (!before) return "added";
  if (before.shareBps !== s.shareBps) return `was ${formatBps(before.shareBps)}`;
  return null;
}

interface Props {
  proposal: ProposalView;
  /** Splits of the version this proposal is based on (empty for an initial agreement). */
  baseSplits: SplitEntry[];
}

export function ProposalCard({ proposal: p, baseSplits }: Props) {
  const { api, account, refresh } = useLive();
  const tx = useTransaction(api.interface);

  // Everything below comes from contract state (getRequiredApprovers + voteOf + getProposal).
  const mine = p.approvers.find((a) => sameAddress(a.account, account));
  const pending = p.status === "Pending";
  const canVote = pending && !!mine && mine.vote === "None";
  const canActivate = pending && p.approvalCount === p.requiredCount;
  const canCancel = pending && sameAddress(p.proposer, account);
  const removed = baseSplits.filter((b) => !p.splits.some((s) => sameAddress(s.contributor, b.contributor)));
  const waitingOn = p.approvers.filter((a) => a.vote === "None");

  const act = (label: string, send: () => ReturnType<typeof api.approveProposal>) => tx.run(label, send, refresh);

  return (
    <article className="proposal card" aria-label={`Proposal ${String(p.id)}`}>
      <header className="proposal-head">
        <div>
          <h4>
            Proposal #{String(p.id)}{" "}
            <span className="muted proposal-kind">{p.baseVersion === 0 ? "Initial agreement (version 1)" : `Proposes version ${p.baseVersion + 1} (changes v${p.baseVersion})`}</span>
          </h4>
          <p className="muted proposal-meta">
            Proposed by <Addr value={p.proposer} account={account} /> · {new Date(p.createdAt * 1000).toLocaleString()}
          </p>
        </div>
        <span className={`pill ${STATUS_CLASS[p.status]}`} data-testid="proposal-status">
          {p.status}
        </span>
      </header>

      <div className="proposal-grid">
        <section aria-label="Proposed split">
          <h5>Proposed split</h5>
          <ul className="share-list">
            {p.splits.map((s) => {
              const change = changeLabel(s, baseSplits);
              return (
                <li key={s.contributor}>
                  <Addr value={s.contributor} account={account} />
                  <span>
                    <span className="share">{formatBps(s.shareBps)}</span>
                    {change && <span className="change-tag">{change}</span>}
                  </span>
                </li>
              );
            })}
            {removed.map((b) => (
              <li key={b.contributor} className="is-removed">
                <Addr value={b.contributor} account={account} />
                <span className="change-tag change-removed">removed (was {formatBps(b.shareBps)})</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Required approvals">
          <h5>
            Required approvals{" "}
            <span className="muted">
              {p.approvalCount} of {p.requiredCount}
            </span>
          </h5>
          <ul className="approver-list">
            {p.approvers.map((a) => (
              <li key={a.account} data-testid="approver">
                <Addr value={a.account} account={account} />
                {a.vote === "Approved" && (
                  <span className="vote vote-yes">
                    <Check size={13} aria-hidden="true" /> Approved
                  </span>
                )}
                {a.vote === "Rejected" && (
                  <span className="vote vote-no">
                    <X size={13} aria-hidden="true" /> Rejected
                  </span>
                )}
                {a.vote === "None" && (
                  <span className="vote vote-none">
                    <Circle size={11} aria-hidden="true" /> Not voted
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pending && (
        <div className="proposal-actions">
          {canVote && (
            <>
              <button className="btn btn-primary" disabled={tx.busy} onClick={() => act("Approve", () => api.approveProposal(p.id))}>
                Approve with my wallet
              </button>
              <button className="btn btn-danger" disabled={tx.busy} onClick={() => act("Reject", () => api.rejectProposal(p.id))}>
                Reject
              </button>
            </>
          )}
          {canActivate && (
            <button className="btn btn-primary" disabled={tx.busy} onClick={() => act("Activate", () => api.activateProposal(p.id))}>
              Activate version {p.baseVersion + 1}
            </button>
          )}
          {canCancel && (
            <button className="btn btn-ghost" disabled={tx.busy} onClick={() => act("Cancel proposal", () => api.cancelProposal(p.id))}>
              Cancel proposal
            </button>
          )}
          <p className="muted proposal-hint">
            {mine?.vote === "Approved" && "You approved this proposal. "}
            {mine?.vote === "Rejected" && "You rejected this proposal. "}
            {!mine && "Your wallet is not a required approver for this proposal. "}
            {canActivate
              ? "Every required contributor has approved — anyone can activate it."
              : `Waiting for ${waitingOn.length} more approval${waitingOn.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      )}
      {p.status === "Superseded" && (
        <p className="muted proposal-hint">Another proposal activated first, so this one can no longer be approved or activated.</p>
      )}
      <TxStatus state={tx.state} />
    </article>
  );
}
