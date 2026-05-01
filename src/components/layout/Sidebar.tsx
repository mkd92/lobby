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
  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const { availableAccounts, ownerId, userRole } = useOwner();
  const ownerName = availableAccounts.find(a => a.id === ownerId)?.name ?? '';
  const isViewer = userRole === 'viewer';

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const prefetch = (key: keyof typeof prefetchMap) => {
    prefetchMap[key]?.();
  };

  return (
    <aside className={`tonal-sidebar glass-panel ${isCollapsed ? 'collapsed' : ''}`} style={{ borderRight: '1px solid var(--outline-variant)', background: 'rgba(0,0,0,0.2)' }}>
      <div className="sidebar-header" style={{ padding: isCollapsed ? '1.5rem 0' : '2.5rem 1.5rem' }}>
        {!isCollapsed && (
          <div className="logo-wordmark flex items-center gap-3">
            <LogoMark size="sm" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.05em', color: 'var(--on-surface)', textTransform: 'uppercase' }}>Lobby</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', width: '32px', height: '32px', borderRadius: '10px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
            {isCollapsed ? 'side_navigation' : 'menu_open'}
          </span>
        </button>
      </div>

      <nav className="nav-links flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.75rem' }}>

        {isViewer ? (
          // Viewer: only Payments
          <>
            {!isCollapsed && <div className="view-eyebrow" style={{ marginTop: '0.5rem', marginLeft: '1rem', marginBottom: '0.75rem', fontSize: '0.6rem', opacity: 0.3 }}>Operations</div>}
            <Link
              to="/payments"
              className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
              title="Payments"
              onMouseEnter={() => prefetch('payments')}
              style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>account_balance_wallet</span>
              {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Payments</span>}
            </Link>
          </>
        ) : (
          // Owner / Manager: full nav
          <>
            <Link
              to="/"
              className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              title="Dashboard"
              onMouseEnter={() => prefetch('lobby')}
              style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>analytics</span>
              {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Dashboard</span>}
            </Link>

            <Link
              to="/portfolio"
              className={`nav-item ${isActive('/portfolio') ? 'active' : ''}`}
              title="Properties"
              onMouseEnter={() => prefetch('portfolio')}
              style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>home_work</span>
              {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Properties</span>}
            </Link>

            {!isCollapsed && <div className="view-eyebrow" style={{ marginTop: '2rem', marginLeft: '1rem', marginBottom: '0.75rem', fontSize: '0.6rem', opacity: 0.3 }}>Operations</div>}
            {!isStaff && (
              <Link
                to="/customers"
                className={`nav-item ${isActive('/customers') ? 'active' : ''}`}
                title="Tenants"
                onMouseEnter={() => prefetch('customers')}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>supervised_user_circle</span>
                {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tenants</span>}
              </Link>
            )}
            {!isStaff && (
              <Link
                to="/agreements"
                className={`nav-item ${isActive('/agreements') ? 'active' : ''}`}
                title="Leases"
                onMouseEnter={() => prefetch('agreements')}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>gavel</span>
                {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Leases</span>}
              </Link>
            )}
            <Link
              to="/payments"
              className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
              title="Payments"
              onMouseEnter={() => prefetch('payments')}
              style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>account_balance_wallet</span>
              {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Payments</span>}
            </Link>
            {!isStaff && (
              <Link
                to="/reports"
                className={`nav-item ${isActive('/reports') ? 'active' : ''}`}
                title="Reports"
                onMouseEnter={() => prefetch('reports')}
                style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>monitoring</span>
                {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Reports</span>}
              </Link>
            )}
            <Link
              to="/team"
              className={`nav-item ${isActive('/team') ? 'active' : ''}`}
              title="Team"
              onMouseEnter={() => prefetch('team')}
              style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>badge</span>
              {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Team</span>}
            </Link>
          </>
        )}

        {/* Staff mode badge */}
        {isStaff && !isCollapsed && (
          <div style={{
            margin: '1rem', padding: '1rem',
            borderRadius: '1rem',
            background: 'rgba(245,158,11,0.05)',
            border: '1px solid rgba(245,158,11,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--color-warning)' }}>verified_user</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-warning)' }}>
                {isViewer ? 'Viewer Access' : 'Staff Access'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ownerName}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingBottom: '1rem' }}>
          {!isCollapsed && <div className="view-eyebrow" style={{ marginLeft: '1rem', marginBottom: '0.75rem', fontSize: '0.6rem', opacity: 0.3 }}>System</div>}
          <Link
            to="/settings"
            className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
            title="Settings"
            onMouseEnter={() => prefetch('settings')}
            style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>tune</span>
            {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Settings</span>}
          </Link>
          <button
            onClick={handleSignOut}
            className="nav-item sign-out-btn w-full text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.875rem 1rem', borderRadius: '0.75rem', marginTop: '0.25rem' }}
            title="Sign Out"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>logout</span>
            {!isCollapsed && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sign Out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
};
