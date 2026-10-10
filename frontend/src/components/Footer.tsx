export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} CoVerse · Early preview</span>
        <span className="muted">All figures shown are demo data. Not financial advice.</span>
      </div>
    </footer>
  );
}
