import React, { useState, useRef, useMemo } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  writeBatch,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSkeleton } from './layout/PageSkeleton';
import '../styles/Properties.css';
import '../styles/Leases.css';

interface PropertyLease {
  id: string;
  unit_id: string | null;
  tenant_id: string;
  tenant_name: string;
  unit_number: string | null;
  property_id: string | null;
  property_name: string | null;
  rent_amount: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  status: 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
}

type FilterTab = 'All' | 'Active' | 'Expired' | 'Terminated';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'unit_asc' | 'rent_desc' | 'rent_asc';

const PropertyLeases: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded }) => {
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [filter, setFilter] = useState<FilterTab>('All');
  const [sort, setSort] = useState<SortOption>('date_desc');
  const expiredRef = useRef(false);

  const invalidateLeases = () => queryClient.invalidateQueries({ queryKey: ['property-leases', ownerId] });

  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const currencySymbol = SYMBOLS[ownerProfile?.currency] || '$';

  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['property-leases', ownerId],
    queryFn: async () => {
      const [leasesSnap, propertiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'property_leases'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId))),
      ]);

      const propertiesData = propertiesSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
      const propertyMap = new Map(propertiesData.map(p => [p.id, p.name]));

      const allLeases = leasesSnap.docs.map(d => {
        const data = d.data();
        const propertyName = data.property_id ? propertyMap.get(data.property_id) : null;
        return {
          id: d.id,
          ...data,
          property_name: propertyName || data.property_name,
        } as PropertyLease;
      });

      if (!expiredRef.current) {
        expiredRef.current = true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unitsSnap = await getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId)));
        const unitMap = new Map(unitsSnap.docs.map(d => [d.id, d.data().status]));

        const integrityBatch = writeBatch(db);
        let hasChanges = false;

        for (const lease of allLeases) {
          if (lease.status === 'Active' && lease.end_date && new Date(lease.end_date) < today) {
            integrityBatch.update(doc(db, 'property_leases', lease.id), { status: 'Expired' });
            if (lease.unit_id) {
              integrityBatch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
            }
            lease.status = 'Expired';
            hasChanges = true;
          }

          if (lease.status !== 'Active' && lease.unit_id) {
            if (unitMap.get(lease.unit_id) === 'Occupied') {
              integrityBatch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
              hasChanges = true;
            }
          }
        }
        if (hasChanges) await integrityBatch.commit();
      }

      return allLeases.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    },
    enabled: !!ownerId,
  });

  const handleDelete = async (lease: PropertyLease) => {
    const ok = await showConfirm(`Terminate lease agreement for ${lease.tenant_name}? This action is irreversible.`, { danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'property_leases', lease.id));
      if (lease.status === 'Active' && lease.unit_id) {
        batch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
      }
      await batch.commit();
      invalidateLeases();
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const filtered = useMemo(() => {
    const list = leases.filter(l => filter === 'All' || l.status === filter);
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'date_asc':  return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'name_asc':  return a.tenant_name.localeCompare(b.tenant_name);
        case 'name_desc': return b.tenant_name.localeCompare(a.tenant_name);
        case 'unit_asc':  return (a.unit_number || '').localeCompare(b.unit_number || '');
        case 'rent_desc': return b.rent_amount - a.rent_amount;
        case 'rent_asc':  return a.rent_amount - b.rent_amount;
        default: return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      }
    });
  }, [leases, filter, sort]);

  const stats = {
    total:   leases.length,
    active:  leases.filter(l => l.status === 'Active').length,
    expired: leases.filter(l => l.status === 'Expired').length,
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className={`${!isEmbedded ? 'view-container' : ''} page-fade-in`}>
      {DialogMount}

      {!isEmbedded && (
        <header className="view-header">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <p className="view-eyebrow">Property Lease Portfolio</p>
              <h1 className="view-title text-4xl md:text-6xl">Property Agreements</h1>
            </div>
            {canCreate && (
              <button onClick={() => navigate('/property-leases/new')} className="primary-button">
                <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>description</span>
                New Agreement
              </button>
            )}
          </div>
        </header>
      )}

      {leases.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar mb-12">
          <div className="prop-metric">
            <span className="prop-metric-label">Active Leases</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{stats.active}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Expired</span>
            <span className="prop-metric-value" style={{ color: stats.expired > 0 ? 'var(--error)' : 'inherit' }}>{stats.expired}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Total</span>
            <span className="prop-metric-value">{stats.total}</span>
          </div>
        </div>
      )}

      <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div className="filter-tabs-modern" style={{ margin: 0 }}>
          {(['All', 'Active', 'Expired', 'Terminated'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              className={`tab-btn ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab}
              {filter === tab && <div className="tab-indicator" />}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: 'auto' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '180px' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', fontSize: '1rem', opacity: 0.5, pointerEvents: 'none' }}>sort</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.625rem 1rem 0.625rem 2.25rem', color: 'var(--on-surface)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="name_asc">Tenant A–Z</option>
              <option value="name_desc">Tenant Z–A</option>
              <option value="unit_asc">Unit Number</option>
              <option value="rent_desc">Rent High–Low</option>
              <option value="rent_asc">Rent Low–High</option>
            </select>
          </div>
          <div className="view-eyebrow" style={{ margin: 0, opacity: 0.4, fontSize: '0.6rem' }}>
            {filtered.length} Records
          </div>
        </div>
      </div>

      <div className="leases-content-area">
        {isLoading ? (
          <PageSkeleton cols={[3, 3, 2, 2, 2]} rows={7} />
        ) : filtered.length === 0 ? (
          <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>contract_delete</span>
            </div>
            <h2 className="text-xl font-bold mb-2">No Agreements Found</h2>
            <p className="text-on-surface-variant max-w-md mx-auto mb-8">No property lease agreements match these parameters.</p>
            {filter === 'All' && canCreate && <button className="primary-button" onClick={() => navigate('/property-leases/new')}>Create First Agreement</button>}
          </div>
        ) : (
          <div className="modern-table-wrap" style={{ borderRadius: '1.5rem' }}>
            <table className="modern-table responsive-leases-table">
              <thead>
                <tr>
                  <th className="col-tenant">Tenant</th>
                  <th className="col-facility">Property</th>
                  <th className="col-inventory">Unit</th>
                  <th className="col-yield">Monthly Rent</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lease => (
                  <tr key={lease.id} onClick={() => navigate(`/property-leases/${lease.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="col-tenant">
                      <div className="flex items-center gap-4">
                        <div className="lease-avatar">{initials(lease.tenant_name)}</div>
                        <div className="lease-info">
                          <span className="lease-name">{lease.tenant_name}</span>
                          <div className="lease-mobile-meta">
                            <span className="mobile-meta-item">{lease.property_name || 'Property'}</span>
                            <span className="mobile-meta-item">Unit {lease.unit_number}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="col-facility">
                      <div className="view-eyebrow" style={{ fontSize: '0.55rem', marginBottom: '0.25rem', opacity: 0.5 }}>Property</div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{lease.property_name || '—'}</span>
                    </td>
                    <td className="col-inventory">
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.875rem' }}>
                        Unit {lease.unit_number}
                      </span>
                    </td>
                    <td className="col-yield">
                      <div style={{ fontWeight: 800 }}>{currencySymbol}{lease.rent_amount.toLocaleString()}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700 }}>{fmt(lease.start_date)}</div>
                    </td>
                    <td className="col-status">
                      <span className={`badge-modern ${lease.status === 'Active' ? 'badge-success' : lease.status === 'Expired' ? 'badge-warning' : 'badge-error'}`}>
                        {lease.status}
                      </span>
                    </td>
                    <td className="col-actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {isOwner && (
                          <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(lease); }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                          </button>
                        )}
                        <span className="material-symbols-outlined opacity-20" style={{ marginLeft: '0.5rem' }}>arrow_forward_ios</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyLeases;
