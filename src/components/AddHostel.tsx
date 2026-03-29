import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';

const AddHostel: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
      navigate('/hostels');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back
          </div>
          <h1 className="view-title">New Facility Setup</h1>
          <p className="text-on-surface-variant mt-2">Initialize a new hostel facility for shared accommodation management.</p>
        </div>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} className="modal-form-modern" style={{ padding: 0 }}>
          {error && <div className="error-message mb-6" style={{ background: 'rgba(186,26,26,0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '0.75rem', fontWeight: 600 }}>{error}</div>}

          <div className="form-group-modern">
            <label>Hostel Facility Name</label>
            <input name="name" type="text" placeholder="e.g. Skyline Student Living" value={formData.name} onChange={handleChange} required />
          </div>

          <div className="form-group-modern">
            <label>Physical Operating Address</label>
            <input name="address" type="text" placeholder="Full street address, City, Zip" value={formData.address} onChange={handleChange} required />
          </div>

          <footer className="modal-footer-modern" style={{ padding: '2rem 0 0', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Discard</button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>{loading ? 'Initializing...' : 'Confirm Facility'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddHostel;
