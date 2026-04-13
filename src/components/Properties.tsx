import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import { PageSkeleton } from './layout/PageSkeleton';
import { useDialog } from '../hooks/useDialog';
import '../styles/Properties.css';

interface PropertyData {
  id: string;
  name: string;
  address: string;
  unitCount: number;
}

const Properties: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded }) => {
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [search, setSearch] = useState('');

  const { data: properties = [], isLoading } = useQuery<PropertyData[]>({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      const [propSnap, unitSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId))),
      ]);

      const unitCounts: Record<string, number> = {};
      unitSnap.docs.forEach(d => {
        const pid = d.data().property_id;
        if (pid) unitCounts[pid] = (unitCounts[pid] || 0) + 1;
      });

      return propSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        address: d.data().address || '',
        unitCount: unitCounts[d.id] || 0,
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!ownerId,
  });

  const filteredProperties = useMemo(() => {
    return properties.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
    );
  }, [properties, search]);

  const totalUnits = useMemo(() =>
    properties.reduce((acc, p) => acc + p.unitCount, 0),
  [properties]);

  const handleDelete = async (e: React.MouseEvent, property: PropertyData) => {
    e.preventDefault();
    e.stopPropagation();

    if (property.unitCount > 0) {
      await showAlert(`Cannot delete — "${property.name}" currently has ${property.unitCount} unit(s). Remove all units first.`);
      return;
    }

    const ok = await showConfirm(`Delete property "${property.name}"? This action is permanent.`, { danger: true });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'properties', property.id));
      queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <div className="view-container"><PageSkeleton variant="cards" rows={6} /></div>;

  return (
    <div className={`${!isEmbedded ? 'view-container' : ''} page-fade-in`}>
      {DialogMount}

      {!isEmbedded && (
        <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="view-eyebrow">Portfolio Registry</p>
            <h1 className="view-title text-4xl md:text-6xl">Property Portfolio</h1>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/properties/new')} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>add_home_work</span>
              Add Property
            </button>
          )}
        </header>
      )}

      {properties.length > 0 && (
        <div className="properties-metrics-bar mb-12">
          <div className="prop-metric">
            <span className="prop-metric-label">Properties</span>
            <span className="prop-metric-value">{properties.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Total Units</span>
            <span className="prop-metric-value">{totalUnits}</span>
          </div>
        </div>
      )}

      <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', opacity: 0.3 }}>search</span>
          <input
            type="text"
            placeholder="Search by property name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.75rem 1.25rem 0.75rem 3rem', color: 'var(--on-surface)', fontSize: '0.875rem', fontWeight: 600 }}
          />
        </div>
        <div className="view-eyebrow" style={{ margin: 0, opacity: 0.4, fontSize: '0.6rem' }}>
          {filteredProperties.length} Properties Found
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>home_work</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No Properties Yet</h2>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">Register your first rental property to start managing units and leases.</p>
          {canCreate && (
            <button onClick={() => navigate('/properties/new')} className="primary-button">Add First Property</button>
          )}
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>search_off</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No Matching Properties</h2>
          <p className="text-on-surface-variant mb-8">Adjust your search to find a specific property.</p>
          <button className="primary-button" style={{ background: 'var(--surface-container-highest)' }} onClick={() => setSearch('')}>Clear Filter</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProperties.map(property => (
            <div key={property.id} className="modern-card group cursor-pointer" onClick={() => navigate(`/properties/${property.id}`)} style={{ padding: '2rem' }}>
              <div className="flex justify-between items-start mb-8">
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--outline-variant)' }}>
                  <span className="material-symbols-outlined text-on-surface opacity-60">home_work</span>
                </div>
                <div className="flex gap-2">
                  <span className="badge-modern badge-success">Active</span>
                  {isOwner && (
                    <button className="btn-icon danger" onClick={e => handleDelete(e, property)} style={{ background: 'rgba(239,68,68,0.05)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{property.name}</h3>
              <div className="flex items-center gap-2 text-on-surface-variant text-sm mb-8">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
                <span className="text-truncate">{property.address}</span>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <div className="flex-1">
                  <div className="view-eyebrow" style={{ fontSize: '0.55rem', marginBottom: '0.25rem' }}>Inventory</div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{property.unitCount} Units</div>
                </div>
                <div className="flex items-center text-secondary group-hover:translate-x-1 transition-transform">
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Properties;
