import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseClient';
import { prefetchMap } from '../../App';
import { LogoMark } from './LogoMark';
import { useOwner } from '../../context/OwnerContext';

export const Sidebar: React.FC<{ isCollapsed: boolean; setIsCollapsed: (v: boolean) => void; isStaff: boolean }> = ({ isCollapsed, setIsCollapsed, isStaff }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  const { availableAccounts, ownerId } = useOwner();
  const ownerName = availableAccounts.find(a => a.id === ownerId)?.name ?? '';

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const prefetch = (key: keyof typeof prefetchMap) => {
    prefetchMap[key]?.();
  };

  return (
    <aside className={`tonal-sidebar glass-panel ${isCollapsed ? 'collapsed' : ''}`} style={{ borderRight: '1px solid var(--outline-variant)' }}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="logo-wordmark">
            <LogoMark size="md" />
            <span className="font-display font-black text-xl tracking-tighter text-on-surface uppercase ml-2">Lobby</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
        >
          <span className="material-symbols-outlined">
            {isCollapsed ? 'side_navigation' : 'menu_open'}
          </span>
        </button>
      </div>

      <nav className="nav-links flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link
          to="/"
          className={`nav-item ${isActive('/') ? 'active' : ''}`}
          title="Dashboard"
          onMouseEnter={() => prefetch('lobby')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>dashboard</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Executive Overview</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label" style={{ marginTop: '2rem', opacity: 0.3 }}>Portfolio Assets</div>}
        <Link
          to="/properties"
          className={`nav-item ${location.pathname.startsWith('/properties') ? 'active' : ''}`}
          title="Properties"
          onMouseEnter={() => prefetch('properties')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>domain</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Real Estate Assets</span>}
        </Link>
        <Link
          to="/hostels"
          className={`nav-item ${location.pathname.startsWith('/hostels') ? 'active' : ''}`}
          title="Hostels"
          onMouseEnter={() => prefetch('hostels')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>hotel</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Shared Facilities</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label" style={{ marginTop: '2rem', opacity: 0.3 }}>Operations</div>}
        <Link
          to="/customers"
          className={`nav-item ${isActive('/customers') ? 'active' : ''}`}
          title="Customers"
          onMouseEnter={() => prefetch('customers')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>group</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Relationship Base</span>}
        </Link>
        <Link
          to="/leases"
          className={`nav-item ${isActive('/leases') ? 'active' : ''}`}
          title="Leases"
          onMouseEnter={() => prefetch('leases')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>contract</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Legal Agreements</span>}
        </Link>
        <Link
          to="/payments"
          className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
          title="Payments"
          onMouseEnter={() => prefetch('payments')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>payments</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Financial Ledger</span>}
        </Link>
        <Link
          to="/reports"
          className={`nav-item ${isActive('/reports') ? 'active' : ''}`}
          title="Reports"
          onMouseEnter={() => prefetch('reports')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>assessment</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Reports</span>}
        </Link>
        <Link
          to="/team"
          className={`nav-item ${isActive('/team') ? 'active' : ''}`}
          title="Team & Access"
          onMouseEnter={() => prefetch('team')}
          style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>supervisor_account</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Team & Access</span>}
        </Link>

        {/* Staff mode block */}
        {isStaff && !isCollapsed && (
          <div style={{
            margin: '0.5rem 0', padding: '1rem 1.25rem',
            borderRadius: '1.25rem',
            background: 'var(--surface-container-high)',
            borderLeft: '3px solid #f59e0b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#f59e0b' }}>visibility</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b' }}>Staff Mode</span>
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ownerName}
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600, marginTop: '0.15rem' }}>Read-Only Access</div>
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          {!isCollapsed && <div className="nav-section-label" style={{ opacity: 0.3 }}>System</div>}
          <Link
            to="/settings"
            className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
            title="Settings"
            onMouseEnter={() => prefetch('settings')}
            style={{ padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>settings</span>
            {!isCollapsed && <span style={{ fontWeight: 700 }}>Preferences</span>}
          </Link>
        </div>
      </nav>

      <div className="mt-8 pt-6 border-t border-outline-variant">
        <button
          onClick={handleSignOut}
          className="nav-item sign-out-btn w-full text-left"
          style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 0, padding: '1rem 1.25rem', borderRadius: '1.25rem' }}
          title="Sign Out"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>logout</span>
          {!isCollapsed && <span style={{ fontWeight: 700 }}>Terminate Session</span>}
        </button>
      </div>
    </aside>
  );
};
