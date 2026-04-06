import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';

const AddCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '', aadhar_number: '', aadhar_drive_link: '' });

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
    <div className="view-container page-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back
          </div>
          <h1 className="view-title">Onboard New Customer</h1>
          <p className="text-on-surface-variant mt-2">Establish a new professional relationship in your database.</p>
        </div>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} className="modal-form-modern" style={{ padding: 0 }}>
          {error && <div className="error-message mb-6" style={{ background: 'rgba(186,26,26,0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '0.75rem', fontWeight: 600 }}>{error}</div>}

          <div className="form-group-modern">
            <label>Legal Full Name</label>
            <input name="full_name" type="text" placeholder="e.g. Alexandra Sterling" value={formData.full_name} onChange={handleChange} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group-modern">
              <label>Official Email Address</label>
              <input name="email" type="email" placeholder="alexandra@example.com" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group-modern">
              <label>Primary Phone Number</label>
              <input name="phone" type="tel" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group-modern">
              <label>Aadhaar Number</label>
              <input name="aadhar_number" type="text" placeholder="XXXX XXXX XXXX" maxLength={14} value={formData.aadhar_number} onChange={handleChange} />
            </div>
            <div className="form-group-modern">
              <label>Aadhaar PDF (Drive Link)</label>
              <input name="aadhar_drive_link" type="url" placeholder="https://drive.google.com/..." value={formData.aadhar_drive_link} onChange={handleChange} />
            </div>
          </div>

          <footer className="modal-footer-modern" style={{ padding: '2rem 0 0', marginTop: '1rem' }}>
            <button type="button" className="modal-discard-btn" onClick={() => navigate(-1)}>Discard</button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>{loading ? 'Establishing...' : 'Confirm Registration'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddCustomer;
