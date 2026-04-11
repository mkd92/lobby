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
    <div className="view-container page-fade-in" style={{ maxWidth: '800px' }}>
      <header className="view-header">
        <button 
          onClick={() => navigate(-1)} 
          className="view-eyebrow flex items-center gap-2 hover:text-on-surface transition-colors mb-10"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>arrow_back</span>
          Back to Relationship Base
        </button>
        <h1 className="view-title text-4xl md:text-6xl">Identify Entity</h1>
        <p className="text-on-surface-variant mt-4 font-medium opacity-70">Establish a new professional stakeholder relationship in the registry.</p>
      </header>

      <div className="modern-card">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-bold leading-relaxed mb-8">
              {error}
            </div>
          )}

          <div className="form-group-modern">
            <label>Legal Designation (Full Name)</label>
            <input 
              name="full_name" 
              type="text" 
              placeholder="e.g. Alexandra Sterling" 
              value={formData.full_name} 
              onChange={handleChange} 
              required 
              style={{ fontSize: '1.125rem', fontWeight: 700 }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group-modern">
              <label>Digital Correspondence</label>
              <input 
                name="email" 
                type="email" 
                placeholder="alexandra@example.com" 
                value={formData.email} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group-modern">
              <label>Primary Tele-Channel</label>
              <input 
                name="phone" 
                type="tel" 
                placeholder="+1 (555) 000-0000" 
                value={formData.phone} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group-modern">
              <label>Government Identifier (Aadhaar)</label>
              <input 
                name="aadhar_number" 
                type="text" 
                placeholder="XXXX XXXX XXXX" 
                maxLength={14} 
                value={formData.aadhar_number} 
                onChange={handleChange} 
              />
            </div>
            <div className="form-group-modern">
              <label>Verification Asset (Drive Link)</label>
              <input 
                name="aadhar_drive_link" 
                type="url" 
                placeholder="https://drive.google.com/..." 
                value={formData.aadhar_drive_link} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-8 border-t border-white/5">
            <button 
              type="button" 
              className="primary-button flex-1" 
              onClick={() => navigate(-1)}
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
                {loading ? 'Initializing...' : 'Confirm Registration'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCustomer;
