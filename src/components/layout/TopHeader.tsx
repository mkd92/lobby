import React from 'react';
import { Link } from 'react-router-dom';

export const TopHeader: React.FC<{ isStaff: boolean }> = ({ isStaff }) => {
  return (
    <header className="fixed top-0 w-full z-50 transition-colors duration-300 h-20 border-none pointer-events-none">
      <div className="flex items-center justify-end px-8 h-full w-full pointer-events-auto">
        <div className="flex items-center gap-4 bg-surface-container-highest/40 backdrop-blur-xl p-2 rounded-2xl border border-outline-variant shadow-lg">
          {isStaff && (
            <span className="badge-modern bg-primary/10 text-primary" style={{ fontSize: '0.6rem', padding: '0.4rem 0.75rem' }}>Staff Access</span>
          )}
          <Link
            to="/settings"
            title="Preferences"
            className="active:scale-95 duration-200 p-2 rounded-xl hover:bg-surface-container-high transition-all"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>settings</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
