import { useState, type FormEvent } from "react";
import { useTransaction } from "../../hooks/useTransaction";
import type { ProjectDetail } from "../../lib/registryClient";
import { formatEth, parseEthInput } from "../../lib/eth";
import { formatBps } from "../../lib/format";
import { Addr } from "./Addr";
import { useLive } from "./liveContext";
import { FormErrors } from "./SplitEditor";
import { TxStatus } from "./TxStatus";

export function RevenuePanel({ detail }: { detail: ProjectDetail }) {
  const { api, account, refresh, walletBalance } = useLive();
  const { project, revenue, versions, deposits } = detail;
  const mine = detail.account;
  const active = versions[versions.length - 1];

  const [depositAmount, setDepositAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [depositErrors, setDepositErrors] = useState<string[]>([]);
  const [claimErrors, setClaimErrors] = useState<string[]>([]);
  const depositTx = useTransaction(api.interface);
  const claimTx = useTransaction(api.interface);

  const submitDeposit = async (e: FormEvent) => {
    e.preventDefault();
    const wei = parseEthInput(depositAmount);
    const errs: string[] = [];
    if (wei === null) errs.push("Enter an amount of test ETH greater than 0, e.g. 1 or 0.25.");
    else if (walletBalance !== null && wei >= walletBalance) {
      errs.push(`Not enough test ETH: this wallet holds ${formatEth(walletBalance)} and also needs gas.`);
    }
    setDepositErrors(errs);
    if (errs.length || wei === null) return;
    // The version the user is looking at is passed as `expectedVersion`; the contract rejects
    // the deposit if a different version became active in the meantime.
    const ok = await depositTx.run("Deposit", () => api.deposit(project.id, project.activeVersion, wei), refresh);
    if (ok) setDepositAmount("");
  };

  const submitClaim = async (e: FormEvent) => {
    e.preventDefault();
    const wei = parseEthInput(claimAmount);
    const errs: string[] = [];
    if (wei === null) errs.push("Enter an amount greater than 0.");
    else if (mine && wei > mine.claimable) errs.push(`You can claim at most ${formatEth(mine.claimable)}.`);
    setClaimErrors(errs);
    if (errs.length || wei === null) return;
    const ok = await claimTx.run("Claim", () => api.claim(project.id, wei), refresh);
    if (ok) setClaimAmount("");
  };

  return (
    <div className="revenue-grid">
      <section className="card panel" aria-labelledby={`deposit-${project.id}`}>
        <div className="panel-head">
          <h3 id={`deposit-${project.id}`}>Deposit revenue</h3>
        </div>
        {project.activeVersion === 0 || !active ? (
          <p className="muted">Deposits open once an agreement is active.</p>
        ) : (
          <form onSubmit={submitDeposit} className="live-form">
            <p className="panel-sub">
              Goes to <strong>version {project.activeVersion}</strong>:{" "}
              {active.splits.map((s, i) => (
                <span key={s.contributor}>
                  {i > 0 && ", "}
                  <Addr value={s.contributor} account={account} /> {formatBps(s.shareBps)}
                </span>
              ))}
              . If the agreement changes before your transaction lands, the contract rejects it.
            </p>
            <div className="inline-field">
              <label className="sr-only" htmlFor={`deposit-amt-${project.id}`}>
                Deposit amount in test ETH
              </label>
              <input
                id={`deposit-amt-${project.id}`}
                className="input"
                inputMode="decimal"
                placeholder="Amount (test ETH)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={depositTx.busy}>
                Deposit
              </button>
            </div>
            {walletBalance !== null && <p className="muted small">Wallet balance: {formatEth(walletBalance)}</p>}
            <FormErrors errors={depositErrors} />
            <TxStatus state={depositTx.state} />
          </form>
        )}
        <dl className="kv">
          <div>
            <dt>Total deposited</dt>
            <dd>{formatEth(revenue.deposited)}</dd>
          </div>
          <div>
            <dt>Claimed by contributors</dt>
            <dd>{formatEth(revenue.claimed)}</dd>
          </div>
          <div>
            <dt>Held by contract</dt>
            <dd>{formatEth(revenue.deposited - revenue.claimed)}</dd>
          </div>
          {revenue.byVersion.map((v) => (
            <div key={v.version}>
              <dt>Deposited under v{v.version}</dt>
              <dd>{formatEth(v.amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card panel" aria-labelledby={`claim-${project.id}`}>
        <div className="panel-head">
          <h3 id={`claim-${project.id}`}>Your earnings</h3>
        </div>
        <p className="panel-sub">
          For the connected wallet <Addr value={account} account={account} /> only. Claims pay this wallet and nobody else.
        </p>
        {mine && (
          <>
            <dl className="kv">
              <div>
                <dt>Claimable now</dt>
                <dd className="kv-strong" data-testid="claimable">
                  {formatEth(mine.claimable)}
                </dd>
              </div>
              <div>
                <dt>Earned (lifetime)</dt>
                <dd>{formatEth(mine.earned)}</dd>
              </div>
              <div>
                <dt>Already claimed</dt>
                <dd>{formatEth(mine.claimed)}</dd>
              </div>
              {mine.earnedByVersion
                .filter((v) => v.amount > 0n)
                .map((v) => (
                  <div key={v.version}>
                    <dt>Earned under v{v.version}</dt>
                    <dd>{formatEth(v.amount)}</dd>
                  </div>
                ))}
            </dl>
            <div className="form-actions">
              <button
                className="btn btn-primary"
                disabled={claimTx.busy || mine.claimable === 0n}
                onClick={() => claimTx.run("Claim all", () => api.claimAll(project.id), refresh)}
              >
                Claim all ({formatEth(mine.claimable)})
              </button>
            </div>
            {mine.claimable > 0n && (
              <form onSubmit={submitClaim} className="inline-field">
                <label className="sr-only" htmlFor={`claim-amt-${project.id}`}>
                  Partial claim amount in ETH
                </label>
                <input
                  id={`claim-amt-${project.id}`}
                  className="input"
                  inputMode="decimal"
                  placeholder="Partial amount"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                />
                <button className="btn btn-secondary" type="submit" disabled={claimTx.busy}>
                  Claim amount
                </button>
              </form>
            )}
            <FormErrors errors={claimErrors} />
            <TxStatus state={claimTx.state} />
          </>
        )}
      </section>

      <section className="card panel revenue-deposits" aria-labelledby={`deposits-${project.id}`}>
        <div className="panel-head">
          <h3 id={`deposits-${project.id}`}>Deposit history</h3>
        </div>
        {deposits.length === 0 ? (
          <p className="muted">No deposits yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Version</th>
                <th scope="col">From</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={String(d.id)}>
                  <td>{String(d.id)}</td>
                  <td>v{d.version}</td>
                  <td>
                    <Addr value={d.depositor} account={account} />
                  </td>
                  <td className="num">{formatEth(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
