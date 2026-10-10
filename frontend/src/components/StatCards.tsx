import { Coins, Layers, TrendingUp, Users } from "lucide-react";
import { DEMO_PROFILE, DEMO_PROJECTS } from "../data/demo";
import { summarize } from "../data/selectors";
import { formatUsd } from "../lib/format";

export function StatCards() {
  const s = summarize(DEMO_PROJECTS, DEMO_PROFILE.handle);
  const stats = [
    { label: "Lifetime earnings", value: formatUsd(s.lifetimeUsd), note: "Your share, all projects", icon: Coins },
    { label: "Last 30 days", value: formatUsd(s.last30dUsd), note: "Your share", icon: TrendingUp },
    { label: "Projects", value: String(s.projectCount), note: `${s.earningCount} earning`, icon: Layers },
    { label: "Collaborators", value: String(s.collaboratorCount), note: "Across all projects", icon: Users },
  ];
  return (
    <section className="stats" aria-label="Summary (demo data)">
      {stats.map(({ label, value, note, icon: Icon }) => (
        <div className="card stat" key={label}>
          <div className="stat-head">
            <span className="stat-label">{label}</span>
            <Icon size={16} aria-hidden="true" className="stat-icon" />
          </div>
          <div className="stat-value">{value}</div>
          <div className="stat-note">{note}</div>
        </div>
      ))}
    </section>
  );
}
