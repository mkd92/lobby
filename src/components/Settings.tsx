import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth, db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useTheme } from '../context/ThemeContext';
import { LoadingScreen } from './layout/LoadingScreen';

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc' },
];

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isStaff = userRole !== 'owner';
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', currency: 'USD' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => () => { if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['owner-profile', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'owners', ownerId!));
      return snap.data();
    },
  });

  useEffect(() => {
    if (data) {
      setProfile({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        currency: data.currency || 'USD',
      });
    }
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'owners', ownerId!), profile);
      queryClient.invalidateQueries({ queryKey: ['owner-profile', ownerId] });
      setMessage({ text: 'System parameters synchronized.', type: 'success' });
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing System Preferences" />;

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '1200px' }}>
      <header className="view-header">
        <p className="view-eyebrow">System Configuration</p>
        <h1 className="view-title text-4xl md:text-6xl">Preferences</h1>
      </header>

      {message && (
        <div className={`modern-card mb-8 py-4 flex items-center gap-4 ${message.type === 'success' ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'}`}>
          <span className="material-symbols-outlined" style={{ color: message.type === 'success' ? 'var(--color-success)' : 'var(--error)' }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Registry Profile */}
          <div className="modern-card">
            <div className="view-eyebrow mb-10">Registry Profile</div>
            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <div className="form-group-modern">
                <label>Legal Entity Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Official facility designation"
                  required
                  style={{ fontSize: '1.125rem', fontWeight: 700 }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group-modern">
                  <label>Digital Correspondence</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group-modern">
                  <label>Primary Tele-Channel</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Registry contact"
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label>Operational Currency</label>
                <select 
                  value={profile.currency} 
                  onChange={e => setProfile(prev => ({ ...prev, currency: e.target.value }))}
                  style={{ fontWeight: 600 }}
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>

              <div className="pt-8 border-t border-white/5 flex justify-end">
                <button type="submit" className="primary-button px-10" disabled={saving}>
                  {saving ? 'Synchronizing...' : 'Finalize Profile'}
                </button>
              </div>
            </form>
          </div>

          {!isStaff && (
            <>
              {/* Team & Access */}
              <div className="modern-card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <div className="view-eyebrow mb-2">Personnel & Access</div>
                    <h2 className="text-xl font-bold mb-2">Portfolio Stakeholders</h2>
                    <p className="text-on-surface-variant text-sm font-medium opacity-70">Assign and manage access for managers and auditors.</p>
                  </div>
                  <button onClick={() => navigate('/team')} className="primary-button" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}>
                    Manage Personnel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Appearance */}
          <div className="modern-card">
            <div className="view-eyebrow mb-8">Environment</div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${theme === 'light' ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">light_mode</span>
                  <span className="text-xs uppercase tracking-widest">Frosted Light</span>
                </div>
                {theme === 'light' && <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>check_circle</span>}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-between p-4 rounded-xl transition-all ${theme === 'dark' ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">dark_mode</span>
                  <span className="text-xs uppercase tracking-widest">Obsidian Vault</span>
                </div>
                {theme === 'dark' && <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>check_circle</span>}
              </button>
            </div>
          </div>

          {/* Versioning */}
          <div className="modern-card">
            <div className="view-eyebrow mb-6">Build Status</div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Version</span>
              <span className="text-xs font-black text-on-surface">v1.2.4-STABLE</span>
            </div>
            <button
              onClick={() => needRefresh ? updateServiceWorker(true) : navigator.serviceWorker?.getRegistration().then(r => r?.update())}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${needRefresh ? 'bg-color-success text-on-primary shadow-lg' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>{needRefresh ? 'system_update' : 'sync'}</span>
              {needRefresh ? 'Update Build' : 'Refresh Cache'}
            </button>
          </div>

          {/* Session */}
          <div className="modern-card" style={{ border: '1px solid rgba(239, 68, 68, 0.1)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div className="view-eyebrow mb-6" style={{ color: 'var(--error)', opacity: 1 }}>Security</div>
            <p className="text-on-surface-variant text-xs font-medium leading-relaxed mb-8 opacity-70">
              Revoke session access on this device. Your data registry will remain secured in the vault.
            </p>
            <button
              onClick={async () => { await signOut(auth); navigate('/login'); }}
              className="w-full py-4 rounded-xl bg-error text-white font-bold uppercase tracking-widest text-[0.65rem] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>logout</span>
              Terminate Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
