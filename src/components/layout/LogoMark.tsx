import React from 'react';

export const LogoMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <div className={`logo-mark size-${size}`}>
    <span className="logo-l">L</span>
    <span className="logo-l logo-l-flip">L</span>
  </div>
);
