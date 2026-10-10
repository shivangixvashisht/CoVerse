import { useCallback, useEffect, useState } from "react";

/** Minimal EIP-1193 provider surface injected by MetaMask. */
export interface Eip1193Provider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type WalletStatus = "unavailable" | "disconnected" | "connecting" | "connected";

export interface WalletState {
  status: WalletStatus;
  account: string | null;
  chainId: bigint | null;
  error: string | null;
}

const DISCONNECTED: WalletState = { status: "disconnected", account: null, chainId: null, error: null };
const UNAVAILABLE: WalletState = { status: "unavailable", account: null, chainId: null, error: null };

function getProvider(): Eip1193Provider | undefined {
  return typeof window === "undefined" ? undefined : window.ethereum;
}

function describeError(err: unknown): string {
  const e = err as { code?: number | string; message?: string };
  if (e?.code === 4001 || e?.code === "ACTION_REJECTED") return "Connection request was rejected in your wallet.";
  if (e?.code === -32002) return "A connection request is already open — check MetaMask.";
  return e?.message ?? "Could not connect to wallet.";
}

/**
 * Reads the connected account and network through ethers.js.
 * `requestAccess` opens the MetaMask approval prompt; otherwise only an
 * existing authorisation is used (no popup).
 */
async function readWallet(injected: Eip1193Provider, requestAccess: boolean): Promise<WalletState> {
  // ethers is loaded lazily so it stays out of the initial bundle.
  const { BrowserProvider } = await import("ethers");
  const provider = new BrowserProvider(injected);
  const accounts = (await provider.send(requestAccess ? "eth_requestAccounts" : "eth_accounts", [])) as string[];
  if (!accounts.length) return DISCONNECTED;
  const network = await provider.getNetwork();
  return { status: "connected", account: accounts[0]!, chainId: network.chainId, error: null };
}

/**
 * Read-only wallet connection via MetaMask (EIP-1193) and ethers.js.
 * This hook only requests account access and reads the network. It never
 * signs messages or sends transactions.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>(() => (getProvider() ? DISCONNECTED : UNAVAILABLE));

  const connect = useCallback(async () => {
    const injected = getProvider();
    if (!injected) {
      setState(UNAVAILABLE);
      return;
    }
    setState((s) => ({ ...s, status: "connecting", error: null }));
    try {
      setState(await readWallet(injected, true));
    } catch (err) {
      setState({ ...DISCONNECTED, error: describeError(err) });
    }
  }, []);

  /** Clears local app state. MetaMask keeps its own site permission until revoked there. */
  const disconnect = useCallback(() => {
    setState(getProvider() ? DISCONNECTED : UNAVAILABLE);
  }, []);

  useEffect(() => {
    const injected = getProvider();
    if (!injected) return;
    let active = true;
    const refresh = () => {
      readWallet(injected, false)
        .then((next) => active && setState(next))
        .catch(() => undefined);
    };
    refresh();
    injected.on?.("accountsChanged", refresh);
    injected.on?.("chainChanged", refresh);
    return () => {
      active = false;
      injected.removeListener?.("accountsChanged", refresh);
      injected.removeListener?.("chainChanged", refresh);
    };
  }, []);

  return { ...state, connect, disconnect };
}
