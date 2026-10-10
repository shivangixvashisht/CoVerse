export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="CoVerse home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b7bff" />
            <stop offset="1" stopColor="#ff7a59" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
        <path d="M20.5 11.2a6.5 6.5 0 1 0 0 9.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="21.5" cy="16" r="2" fill="#fff" />
      </svg>
      <span className="logo-word">CoVerse</span>
    </a>
  );
}
