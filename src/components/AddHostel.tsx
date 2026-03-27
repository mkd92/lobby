import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import '../styles/Auth.css';

const AddHostel: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', address: '' });

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
      navigate('/hostels');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <header className="mb-12">
        <button onClick={() => navigate(-1)} className="text-primary font-bold flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <h1 className="display-small">New Hostel</h1>
        <p className="text-on-surface-variant">Register a new hostel facility to manage rooms and beds.</p>
      </header>

      <div className="bg-surface-container-lowest p-12 rounded-3xl shadow-ambient border border-outline-variant">
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message mb-6">{error}</div>}

          <div className="form-group">
            <label>Hostel Name</label>
            <input name="name" type="text" className="auth-input" placeholder="e.g. Sunshine Boys Hostel" value={formData.name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Full Address</label>
            <input name="address" type="text" className="auth-input" placeholder="Full street address" value={formData.address} onChange={handleChange} required />
          </div>

          <div className="flex gap-4 mt-8">
            <button type="button" className="primary-button" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)', boxShadow: 'none' }} onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>{loading ? 'Registering...' : 'Register Hostel'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddHostel;
