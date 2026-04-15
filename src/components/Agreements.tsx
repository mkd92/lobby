import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwner } from '../context/OwnerContext';
import Leases from './Leases';
import PropertyLeases from './PropertyLeases';
import '../styles/Shared.css';

const Agreements: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hostel' | 'property'>('hostel');
  const { userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const navigate = useNavigate();

  return (
    <div className="view-container page-fade-in">
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Legal Administration</p>
          <h1 className="view-title text-4xl md:text-6xl">Contractual Agreements</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate(activeTab === 'hostel' ? '/leases/new' : '/property-leases/new')}
            className="primary-button"
          >
            <span className="material-symbols-outlined mr-2">description</span>
            New Agreement
          </button>
        )}
      </header>

      <div className="view-toolbar mb-12" style={{ background: 'var(--surface-container-low)', padding: '0.5rem', borderRadius: '1.5rem', display: 'inline-flex', gap: '0.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'hostel' ? 'active' : ''}`}
          onClick={() => setActiveTab('hostel')}
          style={{ padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', position: 'relative' }}
        >
          Hostel Agreements
          {activeTab === 'hostel' && <div className="tab-indicator" />}
        </button>
        <button
          className={`tab-btn ${activeTab === 'property' ? 'active' : ''}`}
          onClick={() => setActiveTab('property')}
          style={{ padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', position: 'relative' }}
        >
          Property Agreements
          {activeTab === 'property' && <div className="tab-indicator" />}
        </button>
      </div>

      <div className="agreements-content">
        {activeTab === 'hostel' ? <Leases isEmbedded /> : <PropertyLeases isEmbedded />}
      </div>
    </div>
  );
};

export default Agreements;
