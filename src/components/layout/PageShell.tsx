import React, { useState } from 'react';
import { useOwner } from '../../context/OwnerContext';
import PullToRefresh from '../PullToRefresh';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';
import '../../styles/Lobby.css';

export const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isStaff } = useOwner();

  return (
    <div className="app-layout">
      <PullToRefresh />
      <TopHeader isStaff={isStaff} />
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} isStaff={isStaff} />
      <main className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
};
