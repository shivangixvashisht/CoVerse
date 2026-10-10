import { AlertTriangle, ChevronDown, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import type { useWallet } from "../hooks/useWallet";
import { chainName, isTestChain } from "../lib/chains";
import { shortenAddress } from "../lib/format";

type Props = ReturnType<typeof useWallet>;

export function WalletButton({ status, account, chainId, error, connect, disconnect }: Props) {
  const [open, setOpen] = useState(false);

  if (status === "unavailable") {
    return (
      <a className="btn btn-secondary" href="https://metamask.io/download/" target="_blank" rel="noreferrer noopener">
        <Wallet size={16} aria-hidden="true" /> Install MetaMask
      </a>
    );
  }

  if (status !== "connected" || !account) {
    return (
      <div className="wallet">
        <button className="btn btn-primary" onClick={connect} disabled={status === "connecting"}>
          <Wallet size={16} aria-hidden="true" />
          {status === "connecting" ? "Check MetaMask…" : "Connect wallet"}
        </button>
        {error && (
          <p className="wallet-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const testnet = isTestChain(chainId);
  return (
    <div className="wallet">
      <button
        className="btn btn-secondary wallet-connected"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`net-dot ${testnet ? "net-dot-test" : "net-dot-main"}`} aria-hidden="true" />
        <span className="mono">{shortenAddress(account)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          <div className="wallet-menu-row">
            <span className="muted">Network</span>
            <span>{chainName(chainId)}</span>
          </div>
          {!testnet && (
            <p className="wallet-warn">
              <AlertTriangle size={14} aria-hidden="true" /> CoVerse is in early development. Use a test network —
              no transactions are sent from this app yet.
            </p>
          )}
          <button
            className="wallet-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            <LogOut size={14} aria-hidden="true" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
