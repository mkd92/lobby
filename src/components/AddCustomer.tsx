import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import '../styles/Auth.css';

const AddCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'tenants'), {
        ...formData,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      navigate('/customers');
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
        <h1 className="display-small">New Customer</h1>
        <p className="text-on-surface-variant">Register a new tenant or client to your system.</p>
      </header>

      <div className="bg-surface-container-lowest p-12 rounded-3xl shadow-ambient border border-outline-variant">
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message mb-6">{error}</div>}

          <div className="form-group">
            <label>Full Name</label>
            <input name="full_name" type="text" className="auth-input" placeholder="e.g. John Doe" value={formData.full_name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Email Address (Optional)</label>
            <input name="email" type="email" className="auth-input" placeholder="john@example.com" value={formData.email} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input name="phone" type="tel" className="auth-input" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} />
          </div>

          <div className="flex gap-4 mt-8">
            <button type="button" className="primary-button" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)', boxShadow: 'none' }} onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>{loading ? 'Adding...' : 'Register Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomer;
