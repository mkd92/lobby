import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefetchMap } from '../../App';
import { useOwner } from '../../context/OwnerContext';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { userRole } = useOwner();
  const isViewer = userRole === 'viewer';
  const isActive = (path: string) => location.pathname === path;
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const prefetch = (key: keyof typeof prefetchMap) => {
    prefetchMap[key]?.();
  };

  return (
    <>
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet glass-panel" onClick={e => e.stopPropagation()}>
            {isViewer ? (
              <>
                <Link
                  to="/settings"
                  className={`more-sheet-item ${isActive('/settings') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('settings')}
                >
                  <span className="material-symbols-outlined">tune</span>
                  <span>Preferences</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/reports"
                  className={`more-sheet-item ${isActive('/reports') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('reports')}
                >
                  <span className="material-symbols-outlined">monitoring</span>
                  <span>Intelligence Reports</span>
                </Link>
                <Link
                  to="/team"
                  className={`more-sheet-item ${isActive('/team') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('team')}
                >
                  <span className="material-symbols-outlined">badge</span>
                  <span>Personnel & Access</span>
                </Link>
                <Link
                  to="/settings"
                  className={`more-sheet-item ${isActive('/settings') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('settings')}
                >
                  <span className="material-symbols-outlined">tune</span>
                  <span>Preferences</span>
                </Link>
              </>
            )}
            {typeof __BUILD_TIME__ !== 'undefined' && (
              <div style={{ padding: '1rem', fontSize: '0.6rem', opacity: 0.3, color: 'var(--on-surface-variant)', fontFamily: 'monospace', textAlign: 'center', borderTop: '1px solid var(--outline-variant)', marginTop: '0.5rem' }}>
                VAULT v{new Date(__BUILD_TIME__).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-lg rounded-[32px] z-50 bg-surface/80 backdrop-blur-[32px] shadow-ambient border border-outline-variant md:hidden">
        <div className="flex justify-around items-center h-20 px-2">
          <Link
            to="/"
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${isActive('/') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
            onMouseEnter={() => prefetch('lobby')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.5rem' }}>analytics</span>
          </Link>

          <Link
            to="/portfolio"
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/portfolio') || location.pathname.startsWith('/hostels') || location.pathname.startsWith('/properties') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
            onMouseEnter={() => prefetch('portfolio')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/portfolio') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.5rem' }}>home_work</span>
          </Link>

          <Link
            to="/customers"
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/customers') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
            onMouseEnter={() => prefetch('customers')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/customers') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.5rem' }}>supervised_user_circle</span>
          </Link>

          <Link
            to="/agreements"
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/agreements') || location.pathname.startsWith('/leases') || location.pathname.startsWith('/property-leases') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
            onMouseEnter={() => prefetch('agreements')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/agreements') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.5rem' }}>gavel</span>
          </Link>

          <Link
            to="/payments"
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/payments') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
            onMouseEnter={() => prefetch('payments')}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/payments') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.5rem' }}>account_balance_wallet</span>
          </Link>

          <button
            className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${moreOpen ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant opacity-50'}`}
            onClick={() => setMoreOpen(prev => !prev)}
          >
            <span className="material-symbols-outlined" style={{ transform: moreOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s ease', fontSize: '1.5rem' }}>more_horiz</span>
          </button>
        </div>
      </nav>
    </>
  );
};
