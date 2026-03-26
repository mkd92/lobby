import { useState, useCallback, useRef } from 'react';
import '../styles/Dialog.css';

type DialogState =
  | { type: 'alert';   message: string; resolve: () => void }
  | { type: 'confirm'; message: string; title?: string; danger?: boolean; resolve: (v: boolean) => void }
  | null;

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState>(null);
  // Keep a ref so closures in async functions always see latest setter
  const setRef = useRef(setDialog);
  setRef.current = setDialog;

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise(resolve => {
      setRef.current({ type: 'alert', message, resolve });
    });
  }, []);

  const showConfirm = useCallback((message: string, options?: { title?: string; danger?: boolean }): Promise<boolean> => {
    return new Promise(resolve => {
      setRef.current({ type: 'confirm', message, title: options?.title, danger: options?.danger ?? false, resolve });
    });
  }, []);

  const DialogMount = dialog ? (
    <div className="dialog-overlay" onClick={e => {
      // Only close alert on backdrop click, not confirm (force a decision)
      if (e.target === e.currentTarget && dialog.type === 'alert') {
        dialog.resolve();
        setDialog(null);
      }
    }}>
      <div className={`dialog-box ${dialog.type === 'confirm' && dialog.danger ? 'danger' : ''}`}>

        {/* Icon */}
        <div className={`dialog-icon-wrap ${dialog.type === 'confirm' && dialog.danger ? 'danger' : dialog.type === 'alert' ? 'alert' : 'confirm'}`}>
          <span className="material-symbols-outlined">
            {dialog.type === 'alert' ? 'info' : dialog.danger ? 'delete_forever' : 'help'}
          </span>
        </div>

        {/* Content */}
        <div className="dialog-content">
          {dialog.type === 'confirm' && dialog.title && (
            <div className="dialog-title">{dialog.title}</div>
          )}
          <div className="dialog-message">{dialog.message}</div>
        </div>

        {/* Actions */}
        <div className="dialog-actions">
          {dialog.type === 'alert' ? (
            <button
              className="dialog-btn primary"
              onClick={() => { dialog.resolve(); setDialog(null); }}
              autoFocus
            >
              OK
            </button>
          ) : (
            <>
              <button
                className="dialog-btn secondary"
                onClick={() => { dialog.resolve(false); setDialog(null); }}
              >
                Cancel
              </button>
              <button
                className={`dialog-btn ${dialog.danger ? 'danger' : 'primary'}`}
                onClick={() => { dialog.resolve(true); setDialog(null); }}
                autoFocus
              >
                {dialog.danger ? 'Delete' : 'Confirm'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { showAlert, showConfirm, DialogMount };
}
