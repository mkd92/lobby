import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/Auth.css';

const AddHostel: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ownerId } = useOwner();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '' });

  useEscapeKey(() => navigate(-1));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, 'hostels'), {
        ...formData,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
      navigate('/hostels');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '560px', margin: '0 auto' }}>

      {/* Back */}
      <div
        className="view-eyebrow"
        style={{ cursor: 'pointer', marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        onClick={() => navigate(-1)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
        Back
      </div>

      {/* Icon + heading */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '1.25rem',
          background: 'var(--primary-container)', color: 'var(--on-primary-container)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>apartment</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.75rem', letterSpacing: '-0.03em', margin: 0 }}>
          New Facility
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', fontWeight: 500, marginTop: '0.5rem', opacity: 0.7 }}>
          Register a hostel facility for shared accommodation
        </p>
      </div>

      {/* Form card */}
      <div className="auth-card" style={{ padding: '2.5rem' }}>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e as unknown as React.FormEvent); }}>

          {/* Name */}
          <div className="auth-input-group">
            <label>
              <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', verticalAlign: 'middle', marginRight: '0.35rem', opacity: 0.6 }}>corporate_fare</span>
              Facility Name
            </label>
            <input
              name="name"
              type="text"
              placeholder="e.g. Skyline Student Living"
              value={formData.name}
              onChange={handleChange}
              className="auth-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              autoFocus
              required
            />
          </div>

          {/* Address */}
          <div className="auth-input-group">
            <label>
              <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', verticalAlign: 'middle', marginRight: '0.35rem', opacity: 0.6 }}>location_on</span>
              Physical Address
            </label>
            <input
              name="address"
              type="text"
              placeholder="Full street address, City, Zip"
              value={formData.address}
              onChange={handleChange}
              className="auth-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                flex: 1, padding: '1rem', borderRadius: '1.125rem', fontWeight: 700,
                fontSize: '0.875rem', background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)', cursor: 'pointer',
                color: 'var(--on-surface-variant)', transition: 'all 0.2s',
              }}
            >
              Discard
            </button>
            <button
              type="submit"
              className="primary-button auth-button"
              style={{ flex: 2, margin: 0 }}
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Confirm Facility'}
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.65rem', opacity: 0.3, fontWeight: 600, marginTop: '-0.25rem' }}>
            ⌘ Enter to submit · Esc to cancel
          </p>
        </form>
      </div>
    </div>
  );
};

export default AddHostel;
