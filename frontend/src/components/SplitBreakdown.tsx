import { Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Project } from "../types";
import { formatBps, formatUsd, initials, totalBps } from "../lib/format";
import { DemoTag } from "./DemoTag";
import { seriesColor } from "../lib/series";
import { SplitBar } from "./SplitBar";

export function SplitBreakdown({ project }: { project: Project }) {
  const [active, setActive] = useState<number | null>(null);
  const total = totalBps(project.contributors);

  return (
    <section className="card panel" id="splits" aria-labelledby="split-title">
      <div className="panel-head">
        <div>
          <h2 id="split-title">Revenue split</h2>
          <p className="panel-sub">
            {project.title} · {project.type}
          </p>
        </div>
        <DemoTag />
      </div>

      <SplitBar contributors={project.contributors} size="lg" active={active} onHover={setActive} />

      <table className="split-table">
        <thead className="sr-only">
          <tr>
            <th scope="col">Collaborator</th>
            <th scope="col">Share</th>
            <th scope="col">Lifetime earnings</th>
          </tr>
        </thead>
        <tbody>
          {project.contributors.map((c, i) => (
            <tr
              key={c.handle}
              className={active === i ? "is-active" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <td>
                <div className="person">
                  <span className="avatar" style={{ boxShadow: `0 0 0 2px ${seriesColor(i)}` }} aria-hidden="true">
                    {initials(c.name)}
                  </span>
                  <span>
                    <span className="person-name">{c.name}</span>
                    <span className="person-role">{c.role}</span>
                  </span>
                </div>
              </td>
              <td className="num share">{formatBps(c.shareBps)}</td>
              <td className="num muted">{formatUsd((project.lifetimeRevenueUsd * c.shareBps) / 10_000)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="split-foot">
        <span className={total === 10_000 ? "check-ok" : "check-bad"}>
          <ShieldCheck size={15} aria-hidden="true" /> Shares total {formatBps(total)}
        </span>
        <span className="muted split-foot-note">
          <Lock size={13} aria-hidden="true" /> On-chain registration not yet enabled
        </span>
      </div>
    </section>
  );
}
