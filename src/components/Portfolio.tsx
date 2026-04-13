import React, { useState } from 'react';
import Hostels from './Hostels';
import Properties from './Properties';
import '../styles/Shared.css';

const Portfolio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hostels' | 'properties'>('hostels');

  return (
    <div className="view-container page-fade-in">
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Asset Management</p>
          <h1 className="view-title text-4xl md:text-6xl">Portfolio Overview</h1>
        </div>
      </header>

      <div className="view-toolbar mb-12" style={{ background: 'var(--surface-container-low)', padding: '0.5rem', borderRadius: '1.5rem', display: 'inline-flex', gap: '0.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'hostels' ? 'active' : ''}`}
          onClick={() => setActiveTab('hostels')}
          style={{ padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', position: 'relative' }}
        >
          Hostel Facilities
          {activeTab === 'hostels' && <div className="tab-indicator" />}
        </button>
        <button
          className={`tab-btn ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
          style={{ padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', position: 'relative' }}
        >
          Rental Properties
          {activeTab === 'properties' && <div className="tab-indicator" />}
        </button>
      </div>

      <div className="portfolio-content">
        {activeTab === 'hostels' ? <Hostels isEmbedded /> : <Properties isEmbedded />}
      </div>
    </div>
  );
};

export default Portfolio;
