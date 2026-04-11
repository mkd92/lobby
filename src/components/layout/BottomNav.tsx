import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefetchMap } from '../../App';
import { useOwner } from '../../context/OwnerContext';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { userRole } = useOwner();
  const isStaff = userRole !== 'owner';
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
            {isStaff ? (
              // Staff "More" sheet — Team only
              <Link
                to="/team"
                className={`more-sheet-item ${isActive('/team') ? 'active' : ''}`}
                onMouseEnter={() => prefetch('team')}
              >
                <span className="material-symbols-outlined">supervisor_account</span>
                <span>Team & Access</span>
              </Link>
            ) : (
              // Owner "More" sheet — Customers + Payments
              <>
                <Link
                  to="/customers"
                  className={`more-sheet-item ${isActive('/customers') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('customers')}
                >
                  <span className="material-symbols-outlined">group</span>
                  <span>Relationship Management</span>
                </Link>
                <Link
                  to="/payments"
                  className={`more-sheet-item ${isActive('/payments') ? 'active' : ''}`}
                  onMouseEnter={() => prefetch('payments')}
                >
                  <span className="material-symbols-outlined">payments</span>
                  <span>Financial Ledger</span>
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
        <div className="flex justify-around items-center h-20 px-6">
          {isViewer ? (
            // Viewer: Payments + sign-out only
            <>
              <Link
                to="/payments"
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/payments') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                onMouseEnter={() => prefetch('payments')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/payments') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>account_balance_wallet</span>
              </Link>

              <button
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${moreOpen ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant opacity-50'}`}
                onClick={() => setMoreOpen(prev => !prev)}
              >
                <span className="material-symbols-outlined" style={{ transform: moreOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s ease', fontSize: '1.75rem' }}>more_horiz</span>
              </button>
            </>
          ) : (
            // Owner / Manager: full bottom nav
            <>
              <Link
                to="/"
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${isActive('/') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                onMouseEnter={() => prefetch('lobby')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>dashboard</span>
              </Link>

              <Link
                to="/hostels"
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/hostels') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                onMouseEnter={() => prefetch('hostels')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/hostels') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>hotel</span>
              </Link>

              <Link
                to="/payments"
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${isActive('/payments') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                onMouseEnter={() => prefetch('payments')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/payments') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>payments</span>
              </Link>

              {isStaff ? (
                <Link
                  to="/payments"
                  className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${isActive('/payments') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                  onMouseEnter={() => prefetch('payments')}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive('/payments') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>payments</span>
                </Link>
              ) : (
                <Link
                  to="/leases"
                  className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${location.pathname.startsWith('/leases') ? 'bg-surface-container-highest text-primary scale-110' : 'text-on-surface-variant opacity-50 hover:text-primary hover:opacity-100'}`}
                  onMouseEnter={() => prefetch('leases')}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/leases') ? "'FILL' 1" : "'FILL' 0", fontSize: '1.75rem' }}>contract</span>
                </Link>
              )}

              <button
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${moreOpen ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant opacity-50'}`}
                onClick={() => setMoreOpen(prev => !prev)}
              >
                <span className="material-symbols-outlined" style={{ transform: moreOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s ease', fontSize: '1.75rem' }}>more_horiz</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
};
