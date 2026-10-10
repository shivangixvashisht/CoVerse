import { Clapperboard, Film, Mic, Music, PlaySquare, Smartphone, Tv } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CONTENT_TYPES, type ContentType, type Project } from "../types";
import { formatUsd, initials } from "../lib/format";
import { DemoTag } from "./DemoTag";
import { SplitBar } from "./SplitBar";

const TYPE_ICONS: Record<ContentType, LucideIcon> = {
  Music: Music,
  Film: Clapperboard,
  Documentary: Film,
  Docuseries: Tv,
  "Long-form video": PlaySquare,
  "Short-form video": Smartphone,
  Podcast: Mic,
};

interface Props {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ProjectGrid({ projects, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<ContentType | "All">("All");
  const visible = useMemo(
    () => (filter === "All" ? projects : projects.filter((p) => p.type === filter)),
    [projects, filter],
  );

  return (
    <section className="section" id="projects" aria-labelledby="projects-title">
      <div className="section-head">
        <div>
          <h2 id="projects-title">Your collaborations</h2>
          <p className="panel-sub">Every project, every contributor, every share — in one place.</p>
        </div>
        <DemoTag />
      </div>

      <div className="chips" role="group" aria-label="Filter by content type">
        {(["All", ...CONTENT_TYPES] as const).map((t) => (
          <button key={t} className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          <p>No {filter.toLowerCase()} projects yet.</p>
        </div>
      ) : (
        <ul className="grid" role="list">
          {visible.map((p) => {
            const Icon = TYPE_ICONS[p.type];
            const selected = p.id === selectedId;
            return (
              <li key={p.id}>
                <article className={`card project ${selected ? "is-selected" : ""}`}>
                  <div
                    className="project-cover"
                    style={{ background: `linear-gradient(135deg, ${p.cover[0]}, ${p.cover[1]})` }}
                  >
                    <span className="type-badge">
                      <Icon size={13} aria-hidden="true" /> {p.type}
                    </span>
                    <span className={`status status-${p.status.replace(/\s+/g, "-").toLowerCase()}`}>{p.status}</span>
                  </div>
                  <div className="project-body">
                    <h3>{p.title}</h3>
                    <p className="project-tagline">{p.tagline}</p>
                    <SplitBar contributors={p.contributors} />
                    <div className="project-meta">
                      <div className="avatars" aria-label={`${p.contributors.length} collaborators`}>
                        {p.contributors.slice(0, 4).map((c) => (
                          <span key={c.handle} className="avatar avatar-sm" title={c.name}>
                            {initials(c.name)}
                          </span>
                        ))}
                        {p.contributors.length > 4 && (
                          <span className="avatar avatar-sm avatar-more">+{p.contributors.length - 4}</span>
                        )}
                      </div>
                      <div className="project-revenue">
                        <span className="muted">Lifetime</span>
                        <strong>{p.lifetimeRevenueUsd ? formatUsd(p.lifetimeRevenueUsd) : "—"}</strong>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-block"
                      aria-pressed={selected}
                      onClick={() => {
                        onSelect(p.id);
                        document.getElementById("splits")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {selected ? "Viewing split" : "View split"}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
