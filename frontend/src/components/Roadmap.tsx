import { CheckCircle2, Hammer } from "lucide-react";

const STEPS = [
  {
    title: "Connect your wallet",
    body: "Link MetaMask to identify yourself as a collaborator. Read-only — CoVerse never asks for your keys.",
    state: "Available",
    icon: CheckCircle2,
  },
  {
    title: "Agree on a split",
    body: "Every contributor approves each version of the split from their own wallet. The contract logic is built and tested; the in-app flow is next.",
    state: "In development",
    icon: Hammer,
  },
  {
    title: "Claim your earnings",
    body: "Revenue deposited on-chain is credited by the agreed split, and each contributor claims their own share. Built and tested in the contract on a local test chain; not yet available in the app.",
    state: "In development",
    icon: Hammer,
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
                <span className={`pill pill-${state.replace(/\s+/g, "-").toLowerCase()}`}>
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
