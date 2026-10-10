/**
 * DEMO DATA — illustrative only.
 *
 * Everything in this file is fictional sample content used to design the
 * dashboard. None of it is read from a blockchain, and no payments have been
 * made. Replace with real data sources once contracts and indexing exist.
 */
import type { ActivityItem, MonthlyEarning, Project } from "../types";

export const DEMO_PROFILE = {
  name: "Aria Nwosu",
  handle: "@aria.makes",
  role: "Singer-songwriter & producer",
};

export const DEMO_PROJECTS: Project[] = [
  {
    id: "midnight-sessions",
    title: "Midnight Sessions",
    type: "Music",
    tagline: "Five-track neo-soul EP recorded live in one night.",
    status: "Earning",
    lifetimeRevenueUsd: 18420,
    last30dUsd: 2310,
    cover: ["#7c5cff", "#ff6f91"],
    contributors: [
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Vocals & songwriting", shareBps: 4000 },
      { name: "Theo Lindqvist", handle: "@theo.beats", role: "Production", shareBps: 3000 },
      { name: "Mara Okafor", handle: "@mara.mix", role: "Mixing & mastering", shareBps: 1500 },
      { name: "Jun Park", handle: "@junpark.art", role: "Cover artwork", shareBps: 1000 },
      { name: "Sol Reyes", handle: "@solkeys", role: "Session keys", shareBps: 500 },
    ],
  },
  {
    id: "salt-marsh",
    title: "Tides of the Salt Marsh",
    type: "Documentary",
    tagline: "A year with the people restoring a vanishing coastline.",
    status: "Earning",
    lifetimeRevenueUsd: 42650,
    last30dUsd: 3980,
    cover: ["#0f9b8e", "#2c3e8f"],
    contributors: [
      { name: "Imogen Hale", handle: "@imogen.films", role: "Director", shareBps: 3500 },
      { name: "Kofi Mensah", handle: "@kofi.dp", role: "Cinematography", shareBps: 2500 },
      { name: "Lena Brandt", handle: "@lena.cuts", role: "Editing", shareBps: 2000 },
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Original score", shareBps: 1200 },
      { name: "Ravi Iyer", handle: "@ravi.voice", role: "Narration", shareBps: 800 },
    ],
  },
  {
    id: "second-shift",
    title: "Second Shift",
    type: "Podcast",
    tagline: "Weekly conversations with artists who kept their day jobs.",
    status: "Earning",
    lifetimeRevenueUsd: 9760,
    last30dUsd: 1140,
    cover: ["#f7971e", "#c0392b"],
    contributors: [
      { name: "Dani Cole", handle: "@danicole", role: "Host", shareBps: 5000 },
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Co-host & theme music", shareBps: 3000 },
      { name: "Priya Shah", handle: "@priya.audio", role: "Audio editing", shareBps: 2000 },
    ],
  },
  {
    id: "long-way-north",
    title: "The Long Way North",
    type: "Docuseries",
    tagline: "Six episodes following a touring band across Scandinavia.",
    status: "In production",
    lifetimeRevenueUsd: 0,
    last30dUsd: 0,
    cover: ["#3a6186", "#89253e"],
    contributors: [
      { name: "Theo Lindqvist", handle: "@theo.beats", role: "Showrunner", shareBps: 3000 },
      { name: "Imogen Hale", handle: "@imogen.films", role: "Director", shareBps: 3000 },
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Music & on-screen talent", shareBps: 2500 },
      { name: "Kofi Mensah", handle: "@kofi.dp", role: "Cinematography", shareBps: 1500 },
    ],
  },
  {
    id: "neon-alleys",
    title: "Neon Alleys",
    type: "Short-form video",
    tagline: "60-second street-performance clips from five cities.",
    status: "Earning",
    lifetimeRevenueUsd: 6180,
    last30dUsd: 940,
    cover: ["#00c6ff", "#7b2ff7"],
    contributors: [
      { name: "Jun Park", handle: "@junpark.art", role: "Creative direction", shareBps: 4000 },
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Performer", shareBps: 3500 },
      { name: "Lena Brandt", handle: "@lena.cuts", role: "Editing", shareBps: 2500 },
    ],
  },
  {
    id: "studio-diaries",
    title: "Studio Diaries: Making an EP",
    type: "Long-form video",
    tagline: "A 90-minute behind-the-scenes cut of Midnight Sessions.",
    status: "Earning",
    lifetimeRevenueUsd: 4320,
    last30dUsd: 610,
    cover: ["#ee9ca7", "#6a3093"],
    contributors: [
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Creator", shareBps: 5000 },
      { name: "Theo Lindqvist", handle: "@theo.beats", role: "Producer", shareBps: 2500 },
      { name: "Lena Brandt", handle: "@lena.cuts", role: "Editing", shareBps: 2500 },
    ],
  },
  {
    id: "paper-satellites",
    title: "Paper Satellites",
    type: "Film",
    tagline: "Short fiction film about two siblings building a radio.",
    status: "Draft split",
    lifetimeRevenueUsd: 0,
    last30dUsd: 0,
    cover: ["#434343", "#d4a017"],
    contributors: [
      { name: "Imogen Hale", handle: "@imogen.films", role: "Writer & director", shareBps: 4000 },
      { name: "Aria Nwosu", handle: "@aria.makes", role: "Composer", shareBps: 2000 },
      { name: "Kofi Mensah", handle: "@kofi.dp", role: "Cinematography", shareBps: 2000 },
      { name: "Sol Reyes", handle: "@solkeys", role: "Sound design", shareBps: 2000 },
    ],
  },
];

/** Demo profile's monthly share of revenue across all projects (USD). */
export const DEMO_MONTHLY_EARNINGS: MonthlyEarning[] = [
  { month: "Mar", usd: 1180 },
  { month: "Apr", usd: 1420 },
  { month: "May", usd: 1360 },
  { month: "Jun", usd: 1910 },
  { month: "Jul", usd: 2240 },
  { month: "Aug", usd: 2080 },
  { month: "Sep", usd: 2675 },
  { month: "Oct", usd: 2930 },
];

export const DEMO_ACTIVITY: ActivityItem[] = [
  { id: "a1", kind: "payout", text: "Monthly revenue share calculated", project: "Midnight Sessions", when: "2 hours ago" },
  { id: "a2", kind: "split", text: "Lena Brandt approved the revenue split", project: "Studio Diaries: Making an EP", when: "Yesterday" },
  { id: "a3", kind: "release", text: "Episode 14 published", project: "Second Shift", when: "2 days ago" },
  { id: "a4", kind: "invite", text: "Sol Reyes invited you to collaborate", project: "Paper Satellites", when: "4 days ago" },
  { id: "a5", kind: "payout", text: "Licensing revenue recorded", project: "Tides of the Salt Marsh", when: "1 week ago" },
];
