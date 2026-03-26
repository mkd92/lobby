import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/Lobby.css';

const LogoMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <div className={`logo-mark size-${size}`}>
    <span className="logo-l">L</span>
    <span className="logo-l logo-l-flip">L</span>
  </div>
);

const Sidebar: React.FC<{ isCollapsed: boolean; setIsCollapsed: (v: boolean) => void }> = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
        <Link to="/" className={`nav-item ${isActive('/') ? 'active' : ''}`} title="Dashboard">
          <span className="material-symbols-outlined mr-3">dashboard</span>
          {!isCollapsed && <span>Dashboard</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">Assets</div>}
        <Link to="/properties" className={`nav-item ${location.pathname.startsWith('/properties') ? 'active' : ''}`} title="Properties">
          <span className="material-symbols-outlined mr-3">domain</span>
          {!isCollapsed && <span>Properties</span>}
        </Link>
        <Link to="/hostels" className={`nav-item ${location.pathname.startsWith('/hostels') ? 'active' : ''}`} title="Hostels">
          <span className="material-symbols-outlined mr-3">hotel</span>
          {!isCollapsed && <span>Hostels</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">People</div>}
        <Link to="/customers" className={`nav-item ${isActive('/customers') ? 'active' : ''}`} title="Customers">
          <span className="material-symbols-outlined mr-3">group</span>
          {!isCollapsed && <span>Customers</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">Financials</div>}
        <Link to="/leases" className={`nav-item ${location.pathname.startsWith('/leases') ? 'active' : ''}`} title="Leases">
          <span className="material-symbols-outlined mr-3">contract</span>
          {!isCollapsed && <span>Leases</span>}
        </Link>
        <Link to="/payments" className={`nav-item ${isActive('/payments') ? 'active' : ''}`} title="Payments">
          <span className="material-symbols-outlined mr-3">payments</span>
          {!isCollapsed && <span>Payments</span>}
        </Link>

        {!isCollapsed && <div className="nav-section-label">System</div>}
        <Link to="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`} title="Settings">
          <span className="material-symbols-outlined mr-3">settings</span>
          {!isCollapsed && <span>Settings</span>}
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
      </div>
    </aside>
  );
};

const MobileTopBar: React.FC = () => {
  return (
    <header className="mobile-top-bar">
      <div className="logo-wordmark">
        <LogoMark size="sm" />
        <span className="logo-name">Lobby</span>
      </div>
      <Link to="/settings" className="nav-item p-2" title="Settings">
        <span className="material-symbols-outlined">settings</span>
      </Link>
    </header>
  );
};

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = isActive('/customers') || isActive('/payments');

  // Close the sheet when navigating
  React.useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <div className="more-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={e => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <Link to="/customers" className={`more-sheet-item ${isActive('/customers') ? 'active' : ''}`}>
              <span className="material-symbols-outlined">group</span>
              <span>People</span>
            </Link>
            <Link to="/payments" className={`more-sheet-item ${isActive('/payments') ? 'active' : ''}`}>
              <span className="material-symbols-outlined">payments</span>
              <span>Payments</span>
            </Link>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        <Link to="/" className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
          <span className="material-symbols-outlined">dashboard</span>
          <span>Home</span>
        </Link>
        <Link to="/properties" className={`mobile-nav-item ${location.pathname.startsWith('/properties') ? 'active' : ''}`}>
          <span className="material-symbols-outlined">domain</span>
          <span>Properties</span>
        </Link>
        <Link to="/hostels" className={`mobile-nav-item ${location.pathname.startsWith('/hostels') ? 'active' : ''}`}>
          <span className="material-symbols-outlined">hotel</span>
          <span>Hostels</span>
        </Link>
        <Link to="/leases" className={`mobile-nav-item ${location.pathname.startsWith('/leases') ? 'active' : ''}`}>
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

  return (
    <>
      <MobileTopBar />
      <div className="app-layout flex-col">
        <div className="layout-wrapper flex flex-1">
          <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
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
