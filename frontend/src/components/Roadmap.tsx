import { CheckCircle2, CircleDashed, Hammer } from "lucide-react";

const STEPS = [
  {
    title: "Connect your wallet",
    body: "Link MetaMask to identify yourself as a collaborator. Read-only — CoVerse never asks for your keys.",
    state: "Available",
    icon: CheckCircle2,
  },
  {
    title: "Agree on a split",
    body: "Record each contributor's share of a project. A registry contract with tests exists; the UI flow is next.",
    state: "In development",
    icon: Hammer,
  },
  {
    title: "Get paid automatically",
    body: "Revenue arriving on-chain is distributed by the agreed split. Not built yet — no funds are handled today.",
    state: "Planned",
    icon: CircleDashed,
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
