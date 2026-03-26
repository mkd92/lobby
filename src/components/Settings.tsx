import React, { useState, useEffect, useRef } from 'react';
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

const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsDropdownOpen(!isDropdownOpen);
                    }
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

          <div className="pt-8 border-t border-outline-variant">
            <button type="submit" className="primary-button w-full" disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
