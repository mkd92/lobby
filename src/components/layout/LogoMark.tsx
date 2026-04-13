import React from 'react';

export const LogoMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <div className={`logo-mark size-${size}`}>
    {/*
      Arch mark — mirrors the logo:
      · Outer arch: straight sides + perfect semicircular top
      · Inner arch: same shape, stops at sill level (not full height)
      · Sill ledges: horizontal connectors between inner and outer arch at base of inner
      · Base line: extends beyond the outer arch feet
    */}
    <svg viewBox="0 0 100 90" fill="none" aria-label="Lobby" role="img">
      {/* Outer arch */}
      <path
        d="M 14 82 L 14 46 A 36 36 0 0 1 86 46 L 86 82"
        stroke="currentColor" strokeWidth="5" strokeLinecap="butt"
      />
      {/* Inner arch — sides stop at sill (y=70), not the base */}
      <path
        d="M 26 70 L 26 50 A 24 24 0 0 1 74 50 L 74 70"
        stroke="currentColor" strokeWidth="5" strokeLinecap="butt"
      />
      {/* Left sill ledge */}
      <line x1="14" y1="70" x2="26" y2="70"
        stroke="currentColor" strokeWidth="5" strokeLinecap="butt"
      />
      {/* Right sill ledge */}
      <line x1="74" y1="70" x2="86" y2="70"
        stroke="currentColor" strokeWidth="5" strokeLinecap="butt"
      />
      {/* Base line */}
      <line x1="4" y1="82" x2="96" y2="82"
        stroke="currentColor" strokeWidth="5" strokeLinecap="butt"
      />
    </svg>
  </div>
);
