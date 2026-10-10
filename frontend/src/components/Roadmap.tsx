import { CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    title: "Connect your wallet",
    body: "Link MetaMask to identify yourself as a collaborator. Read-only — CoVerse never asks for your keys.",
    state: "Available",
    icon: CheckCircle2,
  },
  {
    title: "Agree on a split",
    body: "Create a project, propose changes, and approve or reject each version from your own wallet in the Live workspace. Works on the local Hardhat test network.",
    state: "Available (local test network)",
    icon: CheckCircle2,
  },
  {
    title: "Claim your earnings",
    body: "Deposit test ETH to a project and each contributor claims their own share in the Live workspace. Local test network only — public deployment and real payments are not available.",
    state: "Available (local test network)",
    icon: CheckCircle2,
  },
];

export function Roadmap() {
  return (
    <section className="card panel" id="roadmap" aria-labelledby="roadmap-title">
      <div className="panel-head">
        <h2 id="roadmap-title">How CoVerse works</h2>
      </div>
      <ol className="steps">
        {STEPS.map(({ title, body, state, icon: Icon }, i) => (
          <li key={title} className="step">
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <div className="step-title">
                <h3>{title}</h3>
                <span className={`pill ${state.startsWith("Available") ? "pill-available" : "pill-planned"}`}>
                  <Icon size={12} aria-hidden="true" /> {state}
                </span>
              </div>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
