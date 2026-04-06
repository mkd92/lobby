import React from 'react';
import ReactDOM from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/CommandPalette.css';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['⌘', 'K'],     action: 'Open command palette' },
  { keys: ['?'],           action: 'Toggle this help' },
  { keys: ['G', 'H'],      action: 'Go to Hostels' },
  { keys: ['G', 'P'],      action: 'Go to Payments' },
  { keys: ['G', 'C'],      action: 'Go to Customers' },
  { keys: ['G', 'L'],      action: 'Go to Leases' },
  { keys: ['G', 'T'],      action: 'Go to Team' },
  { keys: ['↑', '↓'],      action: 'Navigate list rows' },
  { keys: ['Enter'],       action: 'Open selected row' },
  { keys: ['Esc'],         action: 'Close / cancel' },
];

const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ open, onClose }) => {
  useEscapeKey(onClose, open);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-box" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <span className="shortcuts-title">Keyboard Shortcuts</span>
          <button className="shortcuts-close" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>close</span>
          </button>
        </div>
        <div className="shortcuts-table">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="shortcuts-row">
              <span className="shortcuts-action">{action}</span>
              <div className="shortcuts-keys">
                {keys.map((k, i) => (
                  <kbd key={i}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShortcutsHelp;
