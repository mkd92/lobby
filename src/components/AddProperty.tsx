import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/Auth.css'; // Reusing base form styles
import '../styles/Properties.css';

const propertyTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed'];

const AddProperty: React.FC = () => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'Residential',
    image_url: ''
  });

  // Handle outside clicks for dropdown
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const selectType = (type: string) => {
    setFormData(prev => ({ ...prev, type }));
    setIsDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { error: insertError } = await supabase
        .from('properties')
        .insert([
          { 
            ...formData,
            owner_id: user.id 
          }
        ]);

      if (insertError) throw insertError;

      // Navigate back to properties list
      navigate('/properties');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <header className="mb-12">
        <button 
          onClick={() => navigate(-1)} 
          className="text-primary font-bold flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <h1 className="display-small">New Property</h1>
        <p className="text-on-surface-variant">Enter the details to add a new property to your portfolio.</p>
      </header>

      <div className="bg-surface-container-lowest p-12 rounded-3xl shadow-ambient border border-outline-variant">
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message mb-6">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Property Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className="auth-input"
              placeholder="e.g. Indigo Estate"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Full Address</label>
            <input
              id="address"
              name="address"
              type="text"
              className="auth-input"
              placeholder="123 Architect St, City, Country"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="form-group">
              <label htmlFor="type">Property Type</label>
              <div className="custom-select-container" ref={dropdownRef}>
                <div 
                  className={`custom-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsDropdownOpen(!isDropdownOpen);
                    } else if (e.key === 'Escape') {
                      setIsDropdownOpen(false);
                    }
                  }}
                >
                  {formData.type}
                  <span className="material-symbols-outlined" style={{ 
                    transition: '0.2s', 
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    fontSize: '1.25rem'
                  }}>
                    keyboard_arrow_down
                  </span>
                </div>
                {isDropdownOpen && (
                  <div className="custom-options">
                    {propertyTypes.map(type => (
                      <div 
                        key={type}
                        className={`custom-option ${formData.type === type ? 'selected' : ''}`}
                        onClick={() => selectType(type)}
                      >
                        {type}
                        {formData.type === type && (
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="image_url">Header Image URL (Optional)</label>
            <input
              id="image_url"
              name="image_url"
              type="url"
              className="auth-input"
              placeholder="https://images.unsplash.com/..."
              value={formData.image_url}
              onChange={handleChange}
            />
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              type="button" 
              className="primary-button" 
              style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)', boxShadow: 'none' }}
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button flex-1" disabled={loading}>
              {loading ? 'Creating Property...' : 'Register Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperty;
