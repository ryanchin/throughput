export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Connecting lines */}
        <line x1="200" y1="150" x2="450" y2="300" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="450" y1="300" x2="750" y2="200" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="750" y1="200" x2="1000" y2="350" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="300" y1="500" x2="600" y2="450" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="600" y1="450" x2="900" y2="550" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="450" y1="300" x2="300" y2="500" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="750" y1="200" x2="600" y2="450" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="1000" y1="350" x2="900" y2="550" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="150" y1="650" x2="300" y2="500" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="900" y1="550" x2="1050" y2="680" stroke="var(--accent)" strokeOpacity="0.1" strokeWidth="1" />

        {/* Nodes (circles) with drift animations */}
        <circle cx="200" cy="150" r="4" fill="var(--accent)" fillOpacity="0.15" style={{ animation: 'drift-1 25s ease-in-out infinite' }} />
        <circle cx="450" cy="300" r="6" fill="var(--accent)" fillOpacity="0.18" style={{ animation: 'drift-2 30s ease-in-out infinite' }} />
        <circle cx="750" cy="200" r="5" fill="var(--accent)" fillOpacity="0.15" style={{ animation: 'drift-3 22s ease-in-out infinite' }} />
        <circle cx="1000" cy="350" r="4" fill="var(--accent)" fillOpacity="0.15" style={{ animation: 'drift-1 28s ease-in-out infinite' }} />
        <circle cx="300" cy="500" r="5" fill="var(--accent)" fillOpacity="0.18" style={{ animation: 'drift-2 26s ease-in-out infinite' }} />
        <circle cx="600" cy="450" r="7" fill="var(--accent)" fillOpacity="0.15" style={{ animation: 'drift-3 32s ease-in-out infinite' }} />
        <circle cx="900" cy="550" r="4" fill="var(--accent)" fillOpacity="0.15" style={{ animation: 'drift-1 24s ease-in-out infinite' }} />
        <circle cx="150" cy="650" r="3" fill="var(--accent)" fillOpacity="0.12" style={{ animation: 'drift-2 27s ease-in-out infinite' }} />
        <circle cx="1050" cy="680" r="3" fill="var(--accent)" fillOpacity="0.12" style={{ animation: 'drift-3 29s ease-in-out infinite' }} />
        <circle cx="550" cy="100" r="3" fill="var(--accent)" fillOpacity="0.12" style={{ animation: 'drift-1 31s ease-in-out infinite' }} />
      </svg>
    </div>
  );
}
