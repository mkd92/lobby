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
import '../styles/Properties.css';
import '../styles/Settings.css';
import '../styles/Leases.css';

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
  const { ownerId, isStaff } = useOwner();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', currency: 'USD' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const selectCurrency = (code: string) => {
    setProfile(prev => ({ ...prev, currency: code }));
    setIsDropdownOpen(false);
  };

  const currentCurrency = currencies.find(c => c.code === profile.currency) || currencies[0];

  if (isLoading) return <LoadingScreen message="Accessing System Preferences" />;

  return (
    <div className="view-container page-fade-in">
      {/* Editorial Header */}
      <header className="view-header">
        <p className="view-eyebrow">System Configuration</p>
        <h1 className="text-on-surface font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
          Preferences
        </h1>
      </header>

      {message && (
        <div className={`mb-10 p-6 rounded-[2rem] border transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-primary/5 border-primary/20 text-on-surface' : 'bg-error/10 border-error/20 text-error'}`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="font-bold tracking-tight">{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Profile (8 cols) */}
        <div className="lg:col-span-8">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <h2 className="text-on-surface font-display font-bold text-3xl tracking-tight mb-12">Registry Profile</h2>
            
            <form onSubmit={handleSave} className="flex flex-col gap-10">
              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-on-surface-variant opacity-60 block mb-3">Legal Entity Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl text-on-surface"
                  placeholder="Registry designation"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-on-surface-variant opacity-60 block mb-3">Digital Correspondence</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="auth-input w-full bg-surface-container-low opacity-40 cursor-not-allowed border-none rounded-2xl p-5 font-medium text-on-surface"
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-on-surface-variant opacity-60 block mb-3">Primary Tele-Channel</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-on-surface"
                    placeholder="Registry contact"
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-on-surface-variant opacity-60 block mb-3">Operational Currency</label>
                <div className="custom-select-container relative" ref={dropdownRef}>
                  <div
                    className={`custom-select-trigger flex justify-between items-center bg-surface-container-low p-5 rounded-2xl cursor-pointer hover:bg-surface-container-high transition-colors ${isDropdownOpen ? 'open' : ''}`}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span className="flex items-center gap-4 text-on-surface">
                      <span className="w-10 h-10 flex items-center justify-center bg-surface-container-highest rounded-xl text-primary font-black text-lg">{currentCurrency.symbol}</span>
                      <span className="font-bold">{currentCurrency.code} <span className="opacity-40 font-medium ml-2">— {currentCurrency.name}</span></span>
                    </span>
                    <span className="material-symbols-outlined transition-transform duration-300 text-on-surface-variant" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                  </div>
                  
                  {isDropdownOpen && (
                    <div className="custom-options absolute top-full left-0 right-0 mt-2 z-[100] glass-panel overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--surface)', boxShadow: 'var(--shadow-elevated)', border: '1px solid var(--outline-variant)' }}>
                      {currencies.map(c => (
                        <div
                          key={c.code}
                          className={`custom-option p-4 flex justify-between items-center cursor-pointer hover:bg-surface-container-high transition-colors ${profile.currency === c.code ? 'bg-primary/10 text-primary' : 'text-on-surface'}`}
                          onClick={() => selectCurrency(c.code)}
                        >
                          <span className="flex items-center gap-4">
                            <span className="w-8 h-8 flex items-center justify-center bg-surface-container-highest rounded-lg font-black text-sm">{c.symbol}</span>
                            <span className="font-bold">{c.code} <span className="opacity-40 font-medium text-xs ml-1">— {c.name}</span></span>
                          </span>
                          {profile.currency === c.code && <span className="material-symbols-outlined text-primary">check</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-outline-variant">
                <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[200px]" disabled={saving}>
                  {saving ? 'Synchronizing...' : 'Finalize Profile'}
                </button>
              </footer>
            </form>
          </div>

          {/* Team & Access — link to dedicated page */}
          {!isStaff && (
            <div className="glass-panel p-10 md:p-16 rounded-[48px] mt-10">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <h2 className="text-on-surface font-display font-bold text-3xl tracking-tight mb-3">Team & Access</h2>
                  <p className="text-on-surface-variant opacity-70 text-sm font-medium leading-relaxed max-w-sm">
                    Invite stakeholders to view your portfolio with read-only access. Manage your team from the dedicated page.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/team')}
                  className="primary-button whitespace-nowrap"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>supervisor_account</span>
                  Manage Team
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Appearance & Auth (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Theme Switcher */}
          <div className="glass-panel p-10 rounded-[40px]">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8 text-on-surface-variant">Environment Appearance</h3>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center justify-between p-6 rounded-3xl transition-all duration-300 ${theme === 'light' ? 'bg-primary text-on-primary scale-[1.02] shadow-xl' : 'bg-surface-container-low text-on-surface-variant opacity-60 hover:text-on-surface hover:opacity-100'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined">light_mode</span>
                  <span className="font-bold uppercase tracking-widest text-[0.7rem]">Frosted Light</span>
                </div>
                {theme === 'light' && <span className="material-symbols-outlined">check_circle</span>}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-between p-6 rounded-3xl transition-all duration-300 ${theme === 'dark' ? 'bg-primary text-on-primary scale-[1.02] shadow-xl' : 'bg-surface-container-low text-on-surface-variant opacity-60 hover:text-on-surface hover:opacity-100'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined">dark_mode</span>
                  <span className="font-bold uppercase tracking-widest text-[0.7rem]">Obsidian Vault</span>
                </div>
                {theme === 'dark' && <span className="material-symbols-outlined">check_circle</span>}
              </button>
            </div>
          </div>

          {/* App Update */}
          <div className="glass-panel p-10 rounded-[40px]">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8 text-on-surface-variant">Application Build</h3>
            <p className="text-on-surface-variant opacity-50 text-[0.7rem] font-medium mb-6 leading-relaxed">
              Built {new Date(__BUILD_TIME__).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
            <button
              onClick={() => needRefresh ? updateServiceWorker(true) : navigator.serviceWorker?.getRegistration().then(r => r?.update())}
              className={`w-full py-3 rounded-2xl font-black uppercase tracking-[0.15em] text-[0.62rem] flex items-center justify-center gap-2 transition-all ${needRefresh ? 'bg-primary text-on-primary hover:opacity-90 shadow-lg shadow-primary/20' : 'bg-surface-container-low text-on-surface-variant opacity-60 hover:opacity-100'}`}
            >
              <span className="material-symbols-outlined text-sm">{needRefresh ? 'system_update' : 'check_circle'}</span>
              {needRefresh ? 'Update Available — Install' : 'Check for Update'}
            </button>
          </div>

          {/* Session Management */}
          <div className="glass-panel p-10 rounded-[40px] border border-error/10 bg-error/5">
            <h3 className="view-eyebrow text-[0.625rem] text-error/60 mb-8">Session Integrity</h3>
            <p className="text-on-surface-variant opacity-70 text-xs font-medium leading-relaxed mb-8">
              Terminating the current session will revoke access on this device. Registry parameters will persist.
            </p>
            <button
              onClick={async () => { await signOut(auth); navigate('/login'); }}
              className="w-full py-4 rounded-2xl bg-error text-white font-black uppercase tracking-[0.2em] text-[0.65rem] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Terminate Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
