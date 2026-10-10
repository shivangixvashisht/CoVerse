import { BrowserProvider } from "ethers";
import { AlertTriangle, Link2, Radio, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadDeployment, type Deployment } from "../../config/deployment";
import { isSupportedChain, LOCAL_CHAIN } from "../../config/network";
import type { useWallet } from "../../hooks/useWallet";
import { chainName } from "../../lib/chains";
import { formatEth } from "../../lib/eth";
import { shortenAddress } from "../../lib/format";
import { switchToLocalChain } from "../../lib/network";
import { createRegistryApi, type RegistryApi } from "../../lib/registryClient";
import { describeTxError, WrongNetworkError } from "../../lib/txErrors";
import { LiveDashboard } from "./LiveDashboard";
import { LiveContext } from "./liveContext";

type Wallet = ReturnType<typeof useWallet>;

type Setup =
  | { phase: "loading" }
  | { phase: "error"; title: string; message: string }
  | { phase: "ready"; api: RegistryApi; deployment: Deployment; provider: BrowserProvider };

const fetchNoStore = (url: string) => fetch(url, { cache: "no-store" });

function Gate({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card panel live-gate">
      <div className="live-gate-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Live data from the CollaborationRegistry contract on the local Hardhat chain. */
export default function LiveWorkspace({ wallet }: { wallet: Wallet }) {
  return (
    <section className="section live" id="live" aria-labelledby="live-title">
      <div className="section-head">
        <div>
          <h2 id="live-title">
            Live workspace <span className="live-tag">On-chain · local test network</span>
          </h2>
          <p className="panel-sub">
            Real projects, agreements, approvals, deposits and claims from the CoVerse contract on your local Hardhat
            chain. Every action is a MetaMask transaction from the connected wallet. Test ETH only.
          </p>
        </div>
      </div>
      <WorkspaceGate wallet={wallet} />
    </section>
  );
}

function WorkspaceGate({ wallet }: { wallet: Wallet }) {
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (wallet.status === "unavailable") {
    return (
      <Gate icon={<Wallet size={20} />} title="MetaMask is required">
        <p className="muted">
          Install the MetaMask browser extension, then reload this page. On a phone, open CoVerse in MetaMask's in-app
          browser.
        </p>
      </Gate>
    );
  }
  if (wallet.status !== "connected" || !wallet.account) {
    return (
      <Gate icon={<Wallet size={20} />} title="Connect your wallet">
        <p className="muted">Connect MetaMask to read and act on the contract as that wallet.</p>
        <button className="btn btn-primary" onClick={wallet.connect} disabled={wallet.status === "connecting"}>
          {wallet.status === "connecting" ? "Check MetaMask…" : "Connect wallet"}
        </button>
        {wallet.error && (
          <p className="tx tx-fail" role="alert">
            {wallet.error}
          </p>
        )}
      </Gate>
    );
  }
  if (!isSupportedChain(wallet.chainId)) {
    return (
      <Gate icon={<AlertTriangle size={20} />} title="Wrong network">
        <p className="muted">
          Your wallet is on <strong>{chainName(wallet.chainId)}</strong>. CoVerse only works with{" "}
          <strong>
            {LOCAL_CHAIN.name} (chain {LOCAL_CHAIN.chainId})
          </strong>{" "}
          at {LOCAL_CHAIN.rpcUrl} in this milestone — no real funds.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSwitchError(null);
            switchToLocalChain().catch((err) => setSwitchError(describeTxError(err).message));
          }}
        >
          Switch to {LOCAL_CHAIN.name}
        </button>
        {switchError && (
          <p className="tx tx-fail" role="alert">
            {switchError}
          </p>
        )}
      </Gate>
    );
  }
  return <ConnectedWorkspace key={`${wallet.account}-${String(wallet.chainId)}`} account={wallet.account} chainId={Number(wallet.chainId)} />;
}

function ConnectedWorkspace({ account, chainId }: { account: string; chainId: number }) {
  const [setup, setSetup] = useState<Setup>({ phase: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const injected = window.ethereum;
    if (!injected) return;
    let active = true;
    const provider = new BrowserProvider(injected);

    (async () => {
      const result = await loadDeployment(chainId, import.meta.env, fetchNoStore);
      if (!result.ok) return { phase: "error", title: "Contract not configured", message: result.message } as const;
      const { address } = result.deployment;
      let code: string;
      try {
        code = await provider.getCode(address);
      } catch (err) {
        return { phase: "error", title: "Can't reach the local chain", message: describeTxError(err).message } as const;
      }
      if (code === "0x") {
        return {
          phase: "error",
          title: "Contract not found on this chain",
          message: `There is no contract at ${shortenAddress(address)} on chain ${chainId}. If you restarted \`hardhat node\`, run \`npm run contracts:deploy\` again and reload.`,
        } as const;
      }
      const api = createRegistryApi({
        address,
        chainId,
        reader: provider,
        getSigner: () => provider.getSigner(account),
        assertChain: async () => {
          const current = Number(await injected.request({ method: "eth_chainId" }));
          if (current !== chainId) throw new WrongNetworkError(current, chainId);
        },
      });
      return { phase: "ready", api, deployment: result.deployment, provider } as const;
    })()
      .then((next) => active && setSetup(next))
      .catch((err) => active && setSetup({ phase: "error", title: "Setup failed", message: describeTxError(err).message }));

    return () => {
      active = false;
      provider.destroy();
    };
  }, [account, chainId]);

  // Re-read state whenever a new block is mined (e.g. another wallet approved), and
  // keep the wallet balance current.
  const provider = setup.phase === "ready" ? setup.provider : null;
  useEffect(() => {
    if (!provider) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBlock = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    provider.on("block", onBlock).catch(() => undefined);
    return () => {
      clearTimeout(timer);
      provider.off("block", onBlock).catch(() => undefined);
    };
  }, [provider, refresh]);

  useEffect(() => {
    if (!provider) return;
    let active = true;
    provider
      .getBalance(account)
      .then((b) => active && setWalletBalance(b))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [provider, account, refreshKey]);

  const ctx = useMemo(
    () =>
      setup.phase === "ready" ? { api: setup.api, account, refresh, refreshKey, walletBalance } : null,
    [setup, account, refresh, refreshKey, walletBalance],
  );

  if (setup.phase === "loading") return <p className="muted">Looking for the CoVerse contract on {chainName(chainId)}…</p>;
  if (setup.phase === "error") {
    return (
      <Gate icon={<AlertTriangle size={20} />} title={setup.title}>
        <p className="muted">{setup.message}</p>
      </Gate>
    );
  }

  return (
    <LiveContext.Provider value={ctx!}>
      <div className="live-status" aria-label="Connection details">
        <span>
          <Radio size={14} aria-hidden="true" /> {chainName(chainId)} (chain {chainId})
        </span>
        <span>
          <Link2 size={14} aria-hidden="true" /> Contract <span className="mono">{shortenAddress(setup.deployment.address)}</span>{" "}
          <span className="muted">({setup.deployment.source === "env" ? "from VITE_REGISTRY_ADDRESS" : "from local deployment file"})</span>
        </span>
        <span>
          <Wallet size={14} aria-hidden="true" /> <span className="mono">{shortenAddress(account)}</span>
          {walletBalance !== null && <span className="muted"> · {formatEth(walletBalance)}</span>}
        </span>
      </div>
      <LiveDashboard />
    </LiveContext.Provider>
  );
}
