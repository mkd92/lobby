import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOwner } from '../../context/OwnerContext';

export const TopHeader: React.FC<{ isStaff: boolean }> = ({ isStaff }) => {
  const { availableAccounts, ownerId, switchAccount } = useOwner();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAccount = availableAccounts.find(a => a.id === ownerId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showSwitcher = availableAccounts.length > 1;

  return (
    <header className="fixed top-0 w-full z-50 transition-colors duration-300 h-20 border-none pointer-events-none">
      <div className="flex items-center justify-end px-8 h-full w-full pointer-events-auto">
        <div className="flex items-center gap-4 bg-surface-container-highest/40 backdrop-blur-xl p-2 rounded-2xl border border-outline-variant shadow-lg">
          {isStaff && currentAccount && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.875rem', borderRadius: '999px',
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.35)',
              color: '#f59e0b',
              fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.04em',
              whiteSpace: 'nowrap', userSelect: 'none',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>visibility</span>
              Staff Mode · {currentAccount.name}
            </div>
          )}

          {/* Account switcher — desktop only */}
          {showSwitcher && (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-container-high transition-all text-white/70 hover:text-white"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>manage_accounts</span>
                <span className="text-xs font-bold tracking-wide max-w-[120px] truncate">{currentAccount?.name ?? '—'}</span>
                <span className="material-symbols-outlined opacity-50" style={{ fontSize: '0.9rem' }}>
                  {open ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 min-w-[180px] bg-surface-container-highest/95 backdrop-blur-2xl border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
                  {availableAccounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => { switchAccount(account.id); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-bold tracking-wide transition-colors hover:bg-surface-container-high ${account.id === ownerId ? 'text-primary' : 'text-white/60'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                        {account.isOwn ? 'person' : 'supervised_user_circle'}
                      </span>
                      <span className="truncate">{account.name}</span>
                      {account.id === ownerId && (
                        <span className="material-symbols-outlined ml-auto text-primary" style={{ fontSize: '1rem' }}>check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
