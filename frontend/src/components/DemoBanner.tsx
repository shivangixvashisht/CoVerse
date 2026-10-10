import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <div className="container demo-banner-inner">
        <FlaskConical size={16} aria-hidden="true" />
        <p>
          <strong>Demo preview + live local chain.</strong> Panels tagged “Demo data” are illustrative samples. The Live
          workspace reads and writes the real CoVerse contract on your local Hardhat test network — test ETH only.
        </p>
      </div>
    </div>
  );
}
