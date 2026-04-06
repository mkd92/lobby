import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOwner } from '../context/OwnerContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/CommandPalette.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  action: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const { ownerId, isStaff } = useOwner();

  const [query,       setQuery]       = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, open);

  // Focus input when opened; reset state when closed
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keep active item scrolled into view
  useEffect(() => {
    const item = listRef.current?.querySelector<HTMLElement>(`.cmd-item.active`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    // Static navigation items (shown when query empty, or if query matches label)
    const navItems: PaletteItem[] = [
      { id: 'go-hostels',   label: 'Go to Hostels',   icon: 'apartment',   action: () => go('/hostels') },
      { id: 'go-payments',  label: 'Go to Payments',   icon: 'payments',    action: () => go('/payments') },
      { id: 'go-team',      label: 'Go to Team',        icon: 'groups',      action: () => go('/team') },
      ...(!isStaff ? [
        { id: 'go-customers', label: 'Go to Customers', icon: 'person',      action: () => go('/customers') },
        { id: 'go-leases',    label: 'Go to Leases',    icon: 'description', action: () => go('/leases') },
        { id: 'new-customer', label: 'New Customer',    icon: 'person_add',  action: () => go('/customers/new') },
        { id: 'new-lease',    label: 'New Lease',        icon: 'add_circle',  action: () => go('/leases/new') },
        { id: 'new-hostel',   label: 'New Hostel',       icon: 'add_home',    action: () => go('/hostels/new') },
      ] : []),
    ];

    // Tenant/customer search from query cache — no new Firestore reads
    type CachedCustomer = { id: string; full_name: string; email?: string; phone?: string };
    const cached = queryClient.getQueryData<CachedCustomer[]>(['customers', ownerId]) ?? [];

    const filteredNav = q
      ? navItems.filter(i => i.label.toLowerCase().includes(q))
      : navItems;

    const tenantItems: PaletteItem[] = q
      ? cached
          .filter(c => c.full_name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q)) || (c.phone?.includes(q)))
          .slice(0, 6)
          .map(c => ({
            id:       `tenant-${c.id}`,
            label:    c.full_name,
            sublabel: c.email || c.phone || 'Customer',
            icon:     'person',
            action:   () => go(`/customers/${c.id}`),
          }))
      : [];

    return [...filteredNav, ...tenantItems];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ownerId, isStaff]);

  // Clamp activeIndex when items change
  useEffect(() => {
    setActiveIndex(prev => Math.max(0, Math.min(prev, items.length - 1)));
  }, [items]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.action();
    }
  };

  if (!open) return null;

  const showTenants = query.trim().length > 0 && items.some(i => i.id.startsWith('tenant-'));

  return ReactDOM.createPortal(
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>

        {/* Input row */}
        <div className="cmd-input-row">
          <span className="material-symbols-outlined">search</span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search pages or customers…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--on-surface-variant)', opacity: 0.5, display: 'flex' }}
              onClick={() => setQuery('')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
            </button>
          )}
        </div>

        {/* Results */}
        <div className="cmd-results" ref={listRef}>
          {items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.35, fontSize: '0.875rem', fontWeight: 600 }}>
              No results for "{query}"
            </div>
          ) : (
            <>
              {/* Nav items section */}
              {items.filter(i => !i.id.startsWith('tenant-')).length > 0 && (
                <>
                  <div className="cmd-section-label">Navigation</div>
                  {items
                    .filter(i => !i.id.startsWith('tenant-'))
                    .map((item, idx) => (
                      <button
                        key={item.id}
                        className={`cmd-item${activeIndex === idx ? ' active' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={item.action}
                      >
                        <div className="cmd-item-icon">
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div>
                          <div className="cmd-item-label">{item.label}</div>
                          {item.sublabel && <div className="cmd-item-sublabel">{item.sublabel}</div>}
                        </div>
                      </button>
                    ))
                  }
                </>
              )}

              {/* Tenant items section */}
              {showTenants && (
                <>
                  <div className="cmd-section-label" style={{ marginTop: '0.5rem' }}>Customers</div>
                  {items
                    .filter(i => i.id.startsWith('tenant-'))
                    .map((item, i) => {
                      const idx = items.filter(x => !x.id.startsWith('tenant-')).length + i;
                      return (
                        <button
                          key={item.id}
                          className={`cmd-item${activeIndex === idx ? ' active' : ''}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={item.action}
                        >
                          <div className="cmd-item-icon">
                            <span className="material-symbols-outlined">{item.icon}</span>
                          </div>
                          <div>
                            <div className="cmd-item-label">{item.label}</div>
                            {item.sublabel && <div className="cmd-item-sublabel">{item.sublabel}</div>}
                          </div>
                        </button>
                      );
                    })
                  }
                </>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="cmd-footer">
          <span className="cmd-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span className="cmd-hint"><kbd>Enter</kbd> open</span>
          <span className="cmd-hint"><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CommandPalette;
