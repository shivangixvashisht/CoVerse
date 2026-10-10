import { ArrowRight, Plus } from "lucide-react";
import { DEMO_PROFILE } from "../data/demo";
import { DemoTag } from "./DemoTag";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-copy">
        <p className="eyebrow">
          Welcome back, {DEMO_PROFILE.name.split(" ")[0]} <DemoTag label="Demo profile" />
        </p>
        <h1 id="hero-title">
          Create together.
          <br />
          <span className="gradient-text">Get paid fairly.</span>
        </h1>
        <p className="lede">
          CoVerse records who made what — across music, film, documentaries, podcasts and video — and splits revenue
          transparently between every collaborator.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="#live">
            <Plus size={18} aria-hidden="true" /> Start a collaboration
          </a>
          <a className="btn btn-ghost btn-lg" href="#splits">
            See how splits work <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
