export type ContentType =
  | "Music"
  | "Film"
  | "Documentary"
  | "Docuseries"
  | "Long-form video"
  | "Short-form video"
  | "Podcast";

export const CONTENT_TYPES: readonly ContentType[] = [
  "Music",
  "Film",
  "Documentary",
  "Docuseries",
  "Long-form video",
  "Short-form video",
  "Podcast",
];

export type ProjectStatus = "Earning" | "In production" | "Draft split";

export interface Contributor {
  name: string;
  handle: string;
  role: string;
  /** Share in basis points: 10_000 = 100%. */
  shareBps: number;
}

export interface Project {
  id: string;
  title: string;
  type: ContentType;
  tagline: string;
  status: ProjectStatus;
  /** Lifetime gross revenue in USD (demo). */
  lifetimeRevenueUsd: number;
  /** Revenue over the last 30 days in USD (demo). */
  last30dUsd: number;
  contributors: Contributor[];
  /** Two CSS colors used for the card cover gradient. */
  cover: [string, string];
}

export interface MonthlyEarning {
  month: string;
  usd: number;
}

export interface ActivityItem {
  id: string;
  kind: "payout" | "split" | "release" | "invite";
  text: string;
  project: string;
  when: string;
}
