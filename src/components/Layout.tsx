import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseClient';
import { prefetchMap } from '../App';
import { useOwner } from '../context/OwnerContext';
import PullToRefresh from './PullToRefresh';
import '../styles/Lobby.css';

const LogoMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <div className={`logo-mark size-${size}`}>
    <span className="logo-l">L</span>
    <span className="logo-l logo-l-flip">L</span>
  </div>
);

const Sidebar: React.FC<{ isCollapsed: boolean; setIsCollapsed: (v: boolean) => void; isStaff: boolean }> = ({ isCollapsed, setIsCollapsed, isStaff }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const prefetch = (key: keyof typeof prefetchMap) => {
    prefetchMap[key]?.();
  };

  return (
    <aside className={`tonal-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="logo-wordmark">
            <LogoMark size="md" />
            <span className="logo-name">Lobby</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className="material-symbols-outlined">
            {isCollapsed ? 'side_navigation' : 'menu_open'}
          </span>
        </button>
      </div>

      <nav className="nav-links flex-1">
        <Link
          to="/"
          className={`nav-item ${isActive('/') ? 'active' : ''}`}
          title="Dashboard"
          onMouseEnter={() => prefetch('lobby')}
          onTouchStart={() => prefetch('lobby')}
        >
          <span className="material-symbols-outlined mr-3">dashboard</span>
          {!isCollapsed && <span>Dashboard</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">Assets</div>}
        <Link
          to="/properties"
          className={`nav-item ${location.pathname.startsWith('/properties') ? 'active' : ''}`}
          title="Properties"
          onMouseEnter={() => prefetch('properties')}
          onTouchStart={() => prefetch('properties')}
        >
          <span className="material-symbols-outlined mr-3">domain</span>
          {!isCollapsed && <span>Properties</span>}
        </Link>
        <Link
          to="/hostels"
          className={`nav-item ${location.pathname.startsWith('/hostels') ? 'active' : ''}`}
          title="Hostels"
          onMouseEnter={() => prefetch('hostels')}
          onTouchStart={() => prefetch('hostels')}
        >
          <span className="material-symbols-outlined mr-3">hotel</span>
          {!isCollapsed && <span>Hostels</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">People</div>}
        <Link
          to="/customers"
          className={`nav-item ${isActive('/customers') ? 'active' : ''}`}
          title="Customers"
          onMouseEnter={() => prefetch('customers')}
          onTouchStart={() => prefetch('customers')}
        >
          <span className="material-symbols-outlined mr-3">group</span>
          {!isCollapsed && <span>Customers</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">Financials</div>}
        <Link
          to="/leases"
          className={`nav-item ${location.pathname.startsWith('/leases') ? 'active' : ''}`}
          title="Leases"
          onMouseEnter={() => prefetch('leases')}
          onTouchStart={() => prefetch('leases')}
        >
          <span className="material-symbols-outlined mr-3">contract</span>
          {!isCollapsed && <span>Leases</span>}
        </Link>
        <Link
          to="/payments"
          className={`nav-item ${isActive('/payments') ? 'active' : ''}`}
          title="Payments"
          onMouseEnter={() => prefetch('payments')}
          onTouchStart={() => prefetch('payments')}
        >
          <span className="material-symbols-outlined mr-3">payments</span>
          {!isCollapsed && <span>Payments</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">System</div>}
        <Link
          to="/settings"
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          title="Settings"
          onMouseEnter={() => prefetch('settings')}
          onTouchStart={() => prefetch('settings')}
        >
          <span className="material-symbols-outlined mr-3">settings</span>
          {!isCollapsed && <span>Settings</span>}
          {!isCollapsed && isStaff && (
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '99px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              Staff
            </span>
          )}
        </Link>
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant">
        <button
          onClick={handleSignOut}
          className="nav-item sign-out-btn w-full text-left"
          style={{ background: 'none', border: 'none' }}
          title="Sign Out"
        >
          <span className="material-symbols-outlined mr-3">logout</span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
        {!isCollapsed && (
          <div style={{ padding: '0.25rem 1.5rem 0.75rem', fontSize: '0.6rem', opacity: 0.3, color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
            v{new Date(__BUILD_TIME__).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        )}
      </div>
    </aside>
  );
};

const MobileTopBar: React.FC<{ isStaff: boolean }> = ({ isStaff }) => {
  return (
    <header className="mobile-top-bar">
      <div className="logo-wordmark">
        <LogoMark size="sm" />
        <span className="logo-name">Lobby</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isStaff && (
          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Staff
          </span>
        )}
        <Link
          to="/settings"
          title="Settings"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: 'var(--on-surface-variant)', textDecoration: 'none', flexShrink: 0 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>settings</span>
        </Link>
      </div>
    </header>
  );
};

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = isActive('/customers') || isActive('/payments');

  React.useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const prefetch = (key: keyof typeof prefetchMap) => {
    prefetchMap[key]?.();
  };

  return (
    <>
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={e => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <Link
              to="/customers"
              className={`more-sheet-item ${isActive('/customers') ? 'active' : ''}`}
              onMouseEnter={() => prefetch('customers')}
              onTouchStart={() => prefetch('customers')}
            >
              <span className="material-symbols-outlined">group</span>
              <span>People</span>
            </Link>
            <Link
              to="/payments"
              className={`more-sheet-item ${isActive('/payments') ? 'active' : ''}`}
              onMouseEnter={() => prefetch('payments')}
              onTouchStart={() => prefetch('payments')}
            >
              <span className="material-symbols-outlined">payments</span>
              <span>Payments</span>
            </Link>
            <div style={{ padding: '0.5rem 1.5rem', fontSize: '0.6rem', opacity: 0.3, color: 'var(--on-surface-variant)', fontFamily: 'monospace', textAlign: 'center' }}>
              v{new Date(__BUILD_TIME__).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        <Link
          to="/"
          className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
          onMouseEnter={() => prefetch('lobby')}
          onTouchStart={() => prefetch('lobby')}
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span>Home</span>
        </Link>
        <Link
          to="/properties"
          className={`mobile-nav-item ${location.pathname.startsWith('/properties') ? 'active' : ''}`}
          onMouseEnter={() => prefetch('properties')}
          onTouchStart={() => prefetch('properties')}
        >
          <span className="material-symbols-outlined">domain</span>
          <span>Properties</span>
        </Link>
        <Link
          to="/hostels"
          className={`mobile-nav-item ${location.pathname.startsWith('/hostels') ? 'active' : ''}`}
          onMouseEnter={() => prefetch('hostels')}
          onTouchStart={() => prefetch('hostels')}
        >
          <span className="material-symbols-outlined">hotel</span>
          <span>Hostels</span>
        </Link>
        <Link
          to="/leases"
          className={`mobile-nav-item ${location.pathname.startsWith('/leases') ? 'active' : ''}`}
          onMouseEnter={() => prefetch('leases')}
          onTouchStart={() => prefetch('leases')}
        >
          <span className="material-symbols-outlined">contract</span>
          <span>Leases</span>
        </Link>
        <button
          className={`mobile-nav-item more-btn ${isMoreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(prev => !prev)}
        >
          <span className="material-symbols-outlined">more_horiz</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isStaff } = useOwner();

  return (
    <>
      <PullToRefresh />
      <MobileTopBar isStaff={isStaff} />
      <div className="app-layout flex-col">
        <div className="layout-wrapper flex flex-1">
          <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isStaff={isStaff} />
          <main className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
};

export default Layout;
