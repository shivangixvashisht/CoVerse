import { AlertCircle, CheckCircle2, Loader2, PenLine } from "lucide-react";
import type { TxState } from "../../hooks/useTransaction";

export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  const hash = state.hash ? <span className="mono tx-hash">{`${state.hash.slice(0, 10)}…`}</span> : null;

  switch (state.phase) {
    case "signing":
      return (
        <p className="tx tx-signing" role="status">
          <PenLine size={15} aria-hidden="true" /> {state.label}: confirm in MetaMask…
        </p>
      );
    case "pending":
      return (
        <p className="tx tx-pending" role="status">
          <Loader2 size={15} className="spin" aria-hidden="true" /> {state.label}: pending on-chain {hash}
        </p>
      );
    case "confirmed":
      return (
        <p className="tx tx-ok" role="status">
          <CheckCircle2 size={15} aria-hidden="true" /> {state.label}: confirmed {hash}
        </p>
      );
    case "failed":
      return (
        <p className="tx tx-fail" role="alert">
          <AlertCircle size={15} aria-hidden="true" /> {state.label} failed: {state.message}
        </p>
      );
  }
}
