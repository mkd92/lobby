import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwner } from '../../context/OwnerContext';
import PullToRefresh from '../PullToRefresh';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';
import { InvitesNotification } from './InvitesNotification';
import CommandPalette from '../CommandPalette';
import ShortcutsHelp from '../ShortcutsHelp';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { useGlobalKeyNav } from '../../hooks/useGlobalKeyNav';
import '../../styles/Lobby.css';

export const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { isStaff } = useOwner();
  const navigate = useNavigate();
  const { paletteOpen, closePalette } = useCommandPalette();

  useGlobalKeyNav(navigate, () => setHelpOpen(v => !v), !paletteOpen);

  return (
    <div className="app-layout">
      <PullToRefresh />
      <InvitesNotification />
      <TopHeader isStaff={isStaff} />
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isStaff={isStaff} />
      <main className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
      <BottomNav />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
};
