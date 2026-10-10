import { lazy, Suspense, useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { DemoBanner } from "./components/DemoBanner";
import { EarningsChart } from "./components/EarningsChart";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ProjectGrid } from "./components/ProjectGrid";
import { Roadmap } from "./components/Roadmap";
import { SplitBreakdown } from "./components/SplitBreakdown";
import { StatCards } from "./components/StatCards";
import { DEMO_PROJECTS } from "./data/demo";
import { useWallet } from "./hooks/useWallet";

// Loaded on demand so ethers.js stays out of the initial bundle.
const LiveWorkspace = lazy(() => import("./components/live/LiveWorkspace"));

export default function App() {
  const wallet = useWallet();
  const [selectedId, setSelectedId] = useState(DEMO_PROJECTS[0]!.id);
  const selected = DEMO_PROJECTS.find((p) => p.id === selectedId) ?? DEMO_PROJECTS[0]!;

  return (
    <div id="top" className="page">
      <Header wallet={wallet} />
      <DemoBanner />
      <main className="container main" id="overview">
        <Hero />
        <Suspense fallback={<p className="muted">Loading live workspace…</p>}>
          <LiveWorkspace wallet={wallet} />
        </Suspense>
        <div className="preview-divider" id="preview">
          <h2>Dashboard design preview</h2>
          <p className="panel-sub">
            Everything below is <strong>demo data</strong> showing the planned dashboard. It is not read from the
            blockchain.
          </p>
        </div>
        <StatCards />
        <div className="row row-split">
          <EarningsChart />
          <SplitBreakdown key={selected.id} project={selected} />
        </div>
        <ProjectGrid projects={DEMO_PROJECTS} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="row row-even">
          <ActivityFeed />
          <Roadmap />
        </div>
      </main>
      <Footer />
    </div>
  );
}
