import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <div className="container demo-banner-inner">
        <FlaskConical size={16} aria-hidden="true" />
        <p>
          <strong>Demo preview.</strong> Projects, earnings and activity below are sample data for illustration — nothing
          is read from or written to a blockchain yet, and no payments are made.
        </p>
      </div>
    </div>
  );
}
