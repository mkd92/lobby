import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';

const propertyTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed'];

const AddProperty: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'Residential',
    image_url: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectType = (type: string) => {
    setFormData(prev => ({ ...prev, type }));
    setIsDropdownOpen(false);
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
      navigate('/properties');
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
          <h1 className="view-title">New Asset Registration</h1>
          <p className="text-on-surface-variant mt-2">Onboard a new property into your management portfolio.</p>
        </div>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} className="modal-form-modern" style={{ padding: 0 }}>
          {error && <div className="error-message mb-6" style={{ background: 'rgba(186,26,26,0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '0.75rem', fontWeight: 600 }}>{error}</div>}

          <div className="form-group-modern">
            <label>Legal Property Name</label>
            <input name="name" type="text" placeholder="e.g. Sapphire Heights" value={formData.name} onChange={handleChange} required />
          </div>

          <div className="form-group-modern">
            <label>Full Physical Address</label>
            <input name="address" type="text" placeholder="Street, City, State, ZIP" value={formData.address} onChange={handleChange} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group-modern">
              <label>Asset Classification</label>
              <div className="custom-select-container" ref={dropdownRef}>
                <div
                  className={`custom-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {formData.type}
                  <span className="material-symbols-outlined transition-transform">keyboard_arrow_down</span>
                </div>
                {isDropdownOpen && (
                  <div className="custom-options">
                    {propertyTypes.map(type => (
                      <div key={type} className={`custom-option ${formData.type === type ? 'selected' : ''}`} onClick={() => selectType(type)}>
                        {type}
                        {formData.type === type && <span className="material-symbols-outlined">check</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group-modern">
              <label>Image URL (Optional)</label>
              <input name="image_url" type="url" placeholder="https://..." value={formData.image_url} onChange={handleChange} />
            </div>
          </div>

          <footer className="modal-footer-modern" style={{ padding: '2rem 0 0', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Discard</button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>{loading ? 'Onboarding...' : 'Confirm Registration'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddProperty;
