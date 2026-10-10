import { useCallback, useState } from "react";
import type { Interface } from "ethers";
import type { TxHandle } from "../lib/registryClient";
import { describeTxError, type TxErrorKind } from "../lib/txErrors";

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "failed";

export interface TxState {
  phase: TxPhase;
  label: string;
  hash?: string;
  message?: string;
  errorKind?: TxErrorKind;
}

const IDLE: TxState = { phase: "idle", label: "" };

/**
 * Tracks one transaction through: waiting for the wallet signature → pending on-chain →
 * confirmed / failed. Success is only reported after the receipt shows status 1.
 */
export function useTransaction(iface: Interface | null) {
  const [state, setState] = useState<TxState>(IDLE);

  const run = useCallback(
    async (label: string, send: () => Promise<TxHandle>, onConfirmed?: () => void | Promise<void>) => {
      setState({ phase: "signing", label });
      try {
        const tx = await send();
        setState({ phase: "pending", label, hash: tx.hash });
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          setState({ phase: "failed", label, hash: tx.hash, errorKind: "reverted", message: "The transaction reverted." });
          return false;
        }
        setState({ phase: "confirmed", label, hash: tx.hash });
        await onConfirmed?.();
        return true;
      } catch (err) {
        const { kind, message } = describeTxError(err, iface);
        setState((s) => ({ phase: "failed", label, hash: s.hash, errorKind: kind, message }));
        return false;
      }
    },
    [iface],
  );

  const reset = useCallback(() => setState(IDLE), []);
  return { state, run, reset, busy: state.phase === "signing" || state.phase === "pending" };
}
