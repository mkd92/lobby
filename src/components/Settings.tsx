import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth, db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useTheme } from '../context/ThemeContext';
import { LoadingScreen } from './layout/LoadingScreen';
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
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc' },
];

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', currency: 'USD' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      setMessage({ text: 'Settings updated successfully!', type: 'success' });
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

  if (isLoading) return <LoadingScreen message="Loading settings" />;

  return (
    <div className="view-container">
      <header className="view-header">
        <div>
          <p className="view-eyebrow">
            System Preferences
          </p>
          <h1 className="view-title">Account Settings</h1>
        </div>
      </header>

      {message && (
        <div className={`mb-8 p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`} style={{
          backgroundColor: message.type === 'success' ? 'var(--primary-container)' : 'rgba(186,26,26,0.1)',
          color: message.type === 'success' ? 'var(--on-primary-container)' : 'var(--error)',
          borderColor: 'transparent',
          fontSize: '0.9rem',
          fontWeight: 600,
          borderRadius: '1rem',
          marginBottom: '2rem'
        }}>
          {message.text}
        </div>
      )}

      <div className="modern-card mb-12" style={{ padding: '2.5rem' }}>
        <h2 className="settings-section-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Owner Profile</h2>
        <form onSubmit={handleSave} className="settings-form">
          <div className="settings-grid">
            <div className="form-group-modern">
              <label>Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: John Doe"
                required
              />
            </div>
            <div className="form-group-modern">
              <label>Email Address</label>
              <input
                type="email"
                value={profile.email}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
            <div className="form-group-modern">
              <label>Phone Number</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="form-group-modern">
              <label>Preferred Currency</label>
              <div className="custom-select-container" ref={dropdownRef}>
                <div
                  className={`custom-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{currentCurrency.symbol}</span>
                    {currentCurrency.code} — {currentCurrency.name}
                  </span>
                  <span className="material-symbols-outlined" style={{
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}>expand_more</span>
                </div>
                {isDropdownOpen && (
                  <div className="custom-options" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {currencies.map(c => (
                      <div
                        key={c.code}
                        className={`custom-option ${profile.currency === c.code ? 'selected' : ''}`}
                        onClick={() => selectCurrency(c.code)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '1.5rem', fontWeight: 800 }}>{c.symbol}</span>
                          <span>{c.code} <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.75rem' }}>— {c.name}</span></span>
                        </span>
                        {profile.currency === c.code && <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button type="submit" className="primary-button" disabled={saving} style={{ marginTop: '2rem' }}>
            {saving ? 'Syncing...' : 'Update Profile'}
          </button>
        </form>
      </div>

      <div className="modern-card mb-12" style={{ padding: '2.5rem' }}>
        <h2 className="settings-section-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Display Theme</h2>
        <div className="appearance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <button
            className={`appearance-card ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            style={{
              padding: '2rem',
              borderRadius: '1.5rem',
              border: `2px solid ${theme === 'light' ? 'var(--primary)' : 'var(--outline-variant)'}`,
              background: theme === 'light' ? 'var(--primary-container)' : 'var(--surface-container-low)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: theme === 'light' ? 'var(--primary)' : 'var(--on-surface-variant)' }}>light_mode</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--on-surface)' }}>Light</span>
          </button>
          <button
            className={`appearance-card ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            style={{
              padding: '2rem',
              borderRadius: '1.5rem',
              border: `2px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--outline-variant)'}`,
              background: theme === 'dark' ? 'var(--primary-container)' : 'var(--surface-container-low)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: theme === 'dark' ? 'var(--primary)' : 'var(--on-surface-variant)' }}>dark_mode</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--on-surface)' }}>Dark</span>
          </button>
        </div>
      </div>

      <div className="modern-card" style={{ padding: '2.5rem', border: '1px solid rgba(186,26,26,0.2)', background: 'rgba(186,26,26,0.02)' }}>
        <h2 className="settings-section-title" style={{ color: 'var(--error)', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', verticalAlign: 'middle', marginRight: '0.5rem' }}>dangerous</span>
          Session Termination
        </h2>
        <p className="settings-description" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }}>You will be signed out of your account on this device. All unsaved changes will be lost.</p>
        <button
          className="primary-button"
          style={{ background: 'var(--error)', marginTop: '1.5rem' }}
          onClick={async () => { await signOut(auth); navigate('/login'); }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.35rem' }}>logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Settings;
