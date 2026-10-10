import { Coins, GitMerge, Rocket, UserPlus } from "lucide-react";
import { DEMO_ACTIVITY } from "../data/demo";
import type { ActivityItem } from "../types";
import { DemoTag } from "./DemoTag";

const ICONS: Record<ActivityItem["kind"], typeof Coins> = {
  payout: Coins,
  split: GitMerge,
  release: Rocket,
  invite: UserPlus,
};

export function ActivityFeed() {
  return (
    <section className="card panel" aria-labelledby="activity-title">
      <div className="panel-head">
        <h2 id="activity-title">Recent activity</h2>
        <DemoTag />
      </div>
      <ol className="feed">
        {DEMO_ACTIVITY.map((a) => {
          const Icon = ICONS[a.kind];
          return (
            <li key={a.id} className="feed-item">
              <span className={`feed-icon feed-${a.kind}`} aria-hidden="true">
                <Icon size={15} />
              </span>
              <div>
                <p className="feed-text">{a.text}</p>
                <p className="feed-meta">
                  {a.project} · {a.when}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
