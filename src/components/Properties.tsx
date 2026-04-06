import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useAppData } from '../hooks/useAppData';
import { LoadingScreen } from './layout/LoadingScreen';
import type { Property } from '../hooks/useProperties';
import '../styles/Properties.css';

const Properties: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const { properties, isLoading, mutations } = useAppData();
  const { removeProperty, checkOccupiedUnits } = mutations;

  const [search, setSearch] = useState('');

  const filteredProperties = useMemo(() => {
    return properties.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [properties, search]);

  const totalUnits = useMemo(() => 
    properties.reduce((acc, p) => acc + (p.unitCount || 0), 0), 
  [properties]);

  const handleDelete = async (e: React.MouseEvent, property: Property) => {
    e.preventDefault();
    e.stopPropagation();

    const occupiedCount = await checkOccupiedUnits(property.id);

    if (occupiedCount > 0) {
      await showAlert(`Cannot delete — ${occupiedCount} unit(s) are currently occupied.\nPlease terminate all active leases first.`);
      return;
    }

    const ok = await showConfirm(`Delete "${property.name}" and all its units? This cannot be undone.`, { danger: true });
    if (!ok) return;

    try {
      await removeProperty(property.id);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Portfolio Vault" />;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header">
        <p className="view-eyebrow">Portfolio Assets</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h1 className="view-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Property Management</h1>
          {canCreate && (
            <button onClick={() => navigate('/properties/new')} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>add</span>
              Register Asset
            </button>
          )}
        </div>
      </header>

      {/* Portfolio Quick Metrics */}
      {properties.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar">
          <div className="prop-metric">
            <span className="prop-metric-label">Holdings</span>
            <span className="prop-metric-value">{properties.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Total Units</span>
            <span className="prop-metric-value">{totalUnits}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Asset Diversity</span>
            <span className="prop-metric-value" style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'auto' }}>Mixed</span>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="properties-toolbar">
        <div className="prop-search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input 
            type="text" 
            placeholder="Search assets by name, address, or type..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="prop-search-input"
          />
        </div>
        <div className="prop-filter-count">
          {filteredProperties.length} / {properties.length} Assets Identified
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>domain_disabled</span>
          </div>
          <h2 className="mb-4">Empty Portfolio</h2>
          <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Register your first property asset to begin tracking units, occupancy, and financial yields.</p>
          {canCreate && (
            <button onClick={() => navigate('/properties/new')} className="primary-button">Initialize Portfolio</button>
          )}
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>search_off</span>
          </div>
          <h2 className="mb-4">No Assets Found</h2>
          <p className="text-on-surface-variant">Adjust your filtering parameters to locate specific property entries.</p>
          <button className="primary-button glass-panel mt-8" onClick={() => setSearch('')} style={{ background: 'rgba(255,255,255,0.05)' }}>Reset Search</button>
        </div>
      ) : (
        <div className="properties-grid">
          {filteredProperties.map(property => (
            <div key={property.id} className="property-card" onClick={() => navigate(`/properties/${property.id}`)}>
              <div className="property-card-visual">
                <div className="property-type-chip">{property.type}</div>
                <div className="property-icon-large">
                  <span className="material-symbols-outlined">
                    {property.type === 'Residential' ? 'home' : 
                     property.type === 'Commercial' ? 'store' : 
                     property.type === 'Industrial' ? 'factory' : 'apartment'}
                  </span>
                </div>
                {isOwner && (
                  <div className="property-card-quick-actions" onClick={e => e.stopPropagation()}>
                    <button className="prop-mini-btn danger" onClick={e => handleDelete(e, property)} title="Terminate Asset">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="property-card-body">
                <h3 className="property-name-modern">{property.name}</h3>
                <div className="property-address-modern">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--primary)', opacity: 0.5 }}>location_on</span>
                  {property.address}
                </div>
                
                <div className="property-card-stats-row">
                  <div className="stat-pill">
                    <span className="stat-pill-label">Inventory</span>
                    <span className="stat-pill-value">{property.unitCount || 0} Units</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-label">Status</span>
                    <span className="stat-pill-value" style={{ color: 'var(--primary)' }}>Active</span>
                  </div>
                </div>
              </div>
              
              <div className="property-card-footer">
                <span className="view-link">
                  Detailed Management Dashboard
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Properties;
