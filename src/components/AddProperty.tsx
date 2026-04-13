import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

const AddProperty: React.FC = () => {
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
      await addDoc(collection(db, 'properties'), {
        ...formData,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
      navigate('/properties');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '600px' }}>
      <button
        onClick={() => navigate(-1)}
        className="view-eyebrow flex items-center gap-2 hover:text-on-surface transition-colors mb-10"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>arrow_back</span>
        Back to Portfolio
      </button>

      <div className="modern-card">
        <header className="mb-10">
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--surface-container-highest)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined opacity-60">home_work</span>
          </div>
          <h1 className="view-title text-3xl mb-2">New Property</h1>
          <p className="text-on-surface-variant text-sm font-medium opacity-70">Register a new rental property for unit-based accommodation management.</p>
        </header>

        {error && (
          <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-bold leading-relaxed mb-8">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e as any); }}>
          <div className="form-group-modern">
            <label>Property Name</label>
            <input
              name="name"
              type="text"
              placeholder="e.g. Riverside Apartments"
              value={formData.name}
              onChange={handleChange}
              autoFocus
              required
              style={{ fontSize: '1.125rem', fontWeight: 700 }}
            />
          </div>

          <div className="form-group-modern">
            <label>Physical Address</label>
            <input
              name="address"
              type="text"
              placeholder="Full property address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-10">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="primary-button flex-1"
              style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
            >
              Discard
            </button>
            <button
              type="submit"
              className="primary-button flex-[2]"
              disabled={loading}
            >
              <span className="font-black text-xs uppercase tracking-widest">
                {loading ? 'Saving...' : 'Add Property'}
              </span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[0.6rem] font-black uppercase tracking-[0.2em] opacity-30">
              ⌘ Enter to submit · Esc to cancel
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperty;
