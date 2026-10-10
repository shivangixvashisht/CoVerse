import { createContext, useContext } from "react";
import type { RegistryApi } from "../../lib/registryClient";

export interface LiveContextValue {
  api: RegistryApi;
  /** The connected wallet. Every transaction is signed by this account. */
  account: string;
  /** Re-read contract state (after a confirmed transaction or a new block). */
  refresh: () => void;
  /** Bumped by `refresh`; data loaders depend on it. */
  refreshKey: number;
  walletBalance: bigint | null;
}

export const LiveContext = createContext<LiveContextValue | null>(null);

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside the live workspace");
  return ctx;
}
