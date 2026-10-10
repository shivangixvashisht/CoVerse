import type { Project } from "../types";

/** The demo profile's share of a project's revenue, in USD. */
export function shareOf(project: Project, handle: string, field: "lifetimeRevenueUsd" | "last30dUsd"): number {
  const me = project.contributors.find((c) => c.handle === handle);
  return me ? (project[field] * me.shareBps) / 10_000 : 0;
}

export function summarize(projects: Project[], handle: string) {
  const mine = projects.filter((p) => p.contributors.some((c) => c.handle === handle));
  const collaborators = new Set(mine.flatMap((p) => p.contributors.map((c) => c.handle)));
  collaborators.delete(handle);
  return {
    lifetimeUsd: mine.reduce((sum, p) => sum + shareOf(p, handle, "lifetimeRevenueUsd"), 0),
    last30dUsd: mine.reduce((sum, p) => sum + shareOf(p, handle, "last30dUsd"), 0),
    projectCount: mine.length,
    earningCount: mine.filter((p) => p.status === "Earning").length,
    collaboratorCount: collaborators.size,
  };
}
