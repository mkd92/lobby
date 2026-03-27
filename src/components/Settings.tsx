import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import '../styles/Auth.css';
import '../styles/Properties.css';
import '../styles/Settings.css';

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
];

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'updating' | 'error';

const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [staffEmails, setStaffEmails] = useState<{ id: string; staff_email: string }[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    currency: 'USD'
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('owners')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile({
          full_name: data.full_name || '',
          email: data.email || '',
          currency: data.currency || 'USD'
        });

        // Fetch staff members
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, staff_email')
          .eq('owner_id', user.id);
        setStaffEmails(staffData || []);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        window.location.reload();
        return;
      }
      await reg.update();
      if (reg.waiting) {
        setUpdateStatus('updating');
        window.__updateSW?.(true);
        return;
      }
      // Listen briefly in case SW is still installing
      const onUpdateFound = () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && reg.waiting) {
            setUpdateStatus('updating');
            window.__updateSW?.(true);
          }
        });
      };
      reg.addEventListener('updatefound', onUpdateFound);
      setTimeout(() => {
        reg.removeEventListener('updatefound', onUpdateFound);
        setUpdateStatus('up-to-date');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }, 3000);
    } catch {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim()) return;
    setStaffLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('staff').insert({ owner_id: user!.id, staff_email: newStaffEmail.trim().toLowerCase() });
    if (!error) {
      setStaffEmails(prev => [...prev, { id: Date.now().toString(), staff_email: newStaffEmail.trim().toLowerCase() }]);
      setNewStaffEmail('');
    }
    setStaffLoading(false);
  };

  const handleRemoveStaff = async (id: string) => {
    await supabase.from('staff').delete().eq('id', id);
    setStaffEmails(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('owners')
        .update({
          full_name: profile.full_name,
          currency: profile.currency
        })
        .eq('id', user.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const selectCurrency = (code: string) => {
    setProfile(prev => ({ ...prev, currency: code }));
    setIsDropdownOpen(false);
  };

  const currentCurrency = currencies.find(c => c.code === profile.currency) || currencies[0];

  if (loading) return <div className="p-12">Loading settings...</div>;

  return (
    <div className="settings-page">
      <header className="mb-12">
        <h1 className="display-small">Settings</h1>
        <p className="text-on-surface-variant">Manage your profile and platform preferences.</p>
      </header>

      {message && (
        <div className={`mb-8 p-4 rounded-xl border ${
          message.type === 'success'
            ? 'settings-success-message'
            : 'error-message'
        }`}>
          {message.text}
        </div>
      )}

      {/* Staff Access */}
      <div className="settings-card">
        <h2 className="settings-section-title">Staff Access</h2>
        <p className="settings-description">Staff members can view all your data but cannot make changes.</p>

        <form onSubmit={handleAddStaff} className="settings-row" style={{ alignItems: 'flex-end', gap: '0.75rem' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Add Staff Email</label>
            <input
              type="email"
              className="auth-input"
              placeholder="staff@example.com"
              value={newStaffEmail}
              onChange={e => setNewStaffEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={staffLoading} style={{ padding: '0.65rem 1.25rem', flexShrink: 0 }}>
            {staffLoading ? 'Adding...' : 'Add'}
          </button>
        </form>

        {staffEmails.length > 0 && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {staffEmails.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--surface-container-low)', borderRadius: '0.75rem', border: '1px solid var(--outline-variant)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>badge</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{s.staff_email}</span>
                </div>
                <button
                  onClick={() => handleRemoveStaff(s.id)}
                  style={{ background: 'none', border: '1px solid var(--error)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>remove_circle</span>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card">
        <form onSubmit={handleSave} className="auth-form">

          {/* Profile */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <span className="material-symbols-outlined">person</span>
              Profile Information
            </h2>
            <div className="form-group mb-6">
              <label>Full Name</label>
              <input
                type="text"
                className="auth-input"
                value={profile.full_name}
                onChange={e => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input opacity-50"
                value={profile.email}
                disabled
              />
              <p className="text-xs mt-2 opacity-50">Email cannot be changed here.</p>
            </div>
          </section>

          {/* Appearance */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <span className="material-symbols-outlined">palette</span>
              Appearance
            </h2>
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <div className="settings-toggle-label">Night Mode</div>
                <div className="settings-toggle-desc">
                  Switch to a dark, low-light interface
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`theme-toggle-switch ${theme === 'dark' ? 'active' : ''}`}
                aria-label="Toggle night mode"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Night Mode'}
              >
                <span className="theme-toggle-thumb">
                  <span className="material-symbols-outlined">
                    {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                  </span>
                </span>
              </button>
            </div>
          </section>

          {/* Financial */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <span className="material-symbols-outlined">payments</span>
              Financial Preferences
            </h2>
            <div className="form-group">
              <label>Default Currency</label>
              <div className="custom-select-container" ref={dropdownRef}>
                <div
                  className={`custom-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ') { e.preventDefault(); setIsDropdownOpen(v => !v); }
                    if (e.key === 'Enter') { if (isDropdownOpen) { e.preventDefault(); setIsDropdownOpen(false); } }
                    if (e.key === 'Escape' || e.key === 'Tab') setIsDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{currentCurrency.symbol}</span>
                    <span>{currentCurrency.code} - {currentCurrency.name}</span>
                  </div>
                  <span className="material-symbols-outlined" style={{
                    transition: '0.2s',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    keyboard_arrow_down
                  </span>
                </div>
                {isDropdownOpen && (
                  <div className="custom-options">
                    {currencies.map(curr => (
                      <div
                        key={curr.code}
                        className={`custom-option ${profile.currency === curr.code ? 'selected' : ''}`}
                        onClick={() => selectCurrency(curr.code)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold opacity-50">{curr.symbol}</span>
                          <span>{curr.code} - {curr.name}</span>
                        </div>
                        {profile.currency === curr.code && (
                          <span className="material-symbols-outlined text-sm">check</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs mt-2 opacity-50">This will update all financial displays across the platform.</p>
            </div>
          </section>

          {/* App Updates */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <span className="material-symbols-outlined">system_update</span>
              App Updates
            </h2>
            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <div className="settings-toggle-label">Check for Updates</div>
                <div className="settings-toggle-desc">
                  {updateStatus === 'idle' && 'Fetch the latest version deployed on Vercel.'}
                  {updateStatus === 'checking' && 'Checking for a new version...'}
                  {updateStatus === 'up-to-date' && 'You\'re on the latest version.'}
                  {updateStatus === 'updating' && 'Applying update and reloading...'}
                  {updateStatus === 'error' && 'Could not check for updates. Try again.'}
                </div>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleCheckUpdate}
                disabled={updateStatus === 'checking' || updateStatus === 'updating'}
                style={{ minWidth: '7rem', flexShrink: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', verticalAlign: 'middle', marginRight: '0.3rem' }}>
                  {updateStatus === 'up-to-date' ? 'check_circle' : updateStatus === 'error' ? 'error' : 'refresh'}
                </span>
                {updateStatus === 'checking' ? 'Checking...' : updateStatus === 'updating' ? 'Updating...' : 'Refresh'}
              </button>
            </div>
          </section>

          <div className="pt-8 border-t border-outline-variant">
            <button type="submit" className="primary-button w-full" disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Sign Out */}
      <div className="settings-card" style={{ borderColor: 'var(--error-container)' }}>
        <h2 className="settings-section-title" style={{ color: 'var(--error)' }}>
          <span className="material-symbols-outlined">logout</span>
          Sign Out
        </h2>
        <p className="settings-description">You will be signed out of your account on this device.</p>
        <button
          className="primary-button"
          style={{ background: 'var(--error)', marginTop: '1rem' }}
          onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.35rem' }}>logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Settings;
