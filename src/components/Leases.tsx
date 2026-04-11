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

import '../styles/Leases.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Lease {
  id: string;
  bed_id: string | null;
  tenant_id: string;
  tenant_name: string;
  bed_number: string | null;
  room_number: string | null;
  hostel_id: string | null;
  hostel_name: string | null;
  rent_amount: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  status: 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
}

type FilterTab  = 'All' | 'Active' | 'Expired' | 'Terminated';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'unit_asc' | 'rent_desc' | 'rent_asc';

// ── Main Component ─────────────────────────────────────────────────────
const Leases: React.FC = () => {
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [filter, setFilter] = useState<FilterTab>('All');
  const [sort, setSort] = useState<SortOption>('date_desc');
  const expiredRef = useRef(false);

  const invalidateLeases = () => queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });

  // ── Data Fetching ──────────────────────────────────────────────────
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const currencySymbol = SYMBOLS[ownerProfile?.currency] || '$';

  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['leases', ownerId],
    queryFn: async () => {
      const [leasesSnap, hostelsSnap] = await Promise.all([
        getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId))),
      ]);

      const hostelsData = hostelsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
      const hostelMap = new Map(hostelsData.map(h => [h.id, h.name]));
      
      const allLeases = leasesSnap.docs.map(d => {
        const data = d.data();
        let hId = data.hostel_id;
        
        if (!hId) {
          if (hostelsData.length === 1) {
            hId = hostelsData[0].id;
          } 
          else if (data.hostel_name) {
            const storedName = data.hostel_name.toLowerCase();
            const match = hostelsData.find(h => 
              h.name.toLowerCase().includes(storedName) || 
              storedName.includes(h.name.toLowerCase())
            );
            if (match) hId = match.id;
          }
        }

        const hostelName = hId ? hostelMap.get(hId) : null;
        return { 
          id: d.id, 
          ...data,
          hostel_id: hId || null,
          hostel_name: hostelName || data.hostel_name
        } as Lease;
      });

      if (!expiredRef.current) {
        expiredRef.current = true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiredBatch = writeBatch(db);
        let hasExpired = false;
        for (const lease of allLeases) {
          if (lease.status === 'Active' && lease.end_date && new Date(lease.end_date) < today) {
            expiredBatch.update(doc(db, 'leases', lease.id), { status: 'Expired' });
            if (lease.bed_id)  expiredBatch.update(doc(db, 'beds',  lease.bed_id),  { status: 'Vacant' });
            lease.status = 'Expired';
            hasExpired = true;
          }
        }
        if (hasExpired) await expiredBatch.commit();
      }

      return allLeases.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    },
    enabled: !!ownerId,
  });

  const handleDelete = async (lease: Lease) => {
    const ok = await showConfirm(`Are you sure you want to terminate this lease agreement for ${lease.tenant_name}? This action is irreversible.`, { danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'leases', lease.id));
      if (lease.status === 'Active') {
        if (lease.bed_id)  batch.update(doc(db, 'beds',  lease.bed_id),  { status: 'Vacant' });
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
        case 'unit_asc':  return (a.room_number || '').localeCompare(b.room_number || '');
        case 'rent_desc': return b.rent_amount - a.rent_amount;
        case 'rent_asc':  return a.rent_amount - b.rent_amount;
        default: return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      }
    });
  }, [leases, filter, sort]);

  const stats = {
    total:      leases.length,
    active:     leases.filter(l => l.status === 'Active').length,
    expired:    leases.filter(l => l.status === 'Expired').length,
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="view-eyebrow">Lease Portfolio</p>
            <h1 className="view-title text-4xl md:text-6xl">Contractual Yield</h1>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/leases/new')} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>description</span>
              Generate Agreement
            </button>
          )}
        </div>
      </header>

      {/* Metrics Bar */}
      {leases.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar mb-12">
          <div className="prop-metric">
            <span className="prop-metric-label">Active Contracts</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{stats.active}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Maturity Alerts</span>
            <span className="prop-metric-value" style={{ color: stats.expired > 0 ? 'var(--error)' : 'inherit' }}>{stats.expired}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Total Volume</span>
            <span className="prop-metric-value">{stats.total}</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
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
              <option value="unit_asc">Room Number</option>
              <option value="rent_desc">Rent High–Low</option>
              <option value="rent_asc">Rent Low–High</option>
            </select>
          </div>
          <div className="view-eyebrow" style={{ margin: 0, opacity: 0.4, fontSize: '0.6rem' }}>
            {filtered.length} Identifiers
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
            <h2 className="text-xl font-bold mb-2">Agreement Vault Empty</h2>
            <p className="text-on-surface-variant max-w-md mx-auto mb-8">No active legal agreements found matching these parameters.</p>
            {filter === 'All' && canCreate && <button className="primary-button" onClick={() => navigate('/leases/new')}>Initialize First Agreement</button>}
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="modern-table-wrap desktop-only" style={{ borderRadius: '1.5rem' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Tenant Entity</th>
                    <th>Facility</th>
                    <th>Inventory</th>
                    <th>Monthly Yield</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lease => (
                    <tr key={lease.id} onClick={() => navigate(`/leases/${lease.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="flex items-center gap-4">
                          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--surface-container-highest)', color: 'var(--on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                            {initials(lease.tenant_name)}
                          </div>
                          <span style={{ fontWeight: 700 }}>{lease.tenant_name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="view-eyebrow" style={{ fontSize: '0.55rem', marginBottom: '0.25rem', opacity: 0.5 }}>Shared</div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{lease.hostel_name || '—'}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.875rem' }}>
                          Rm {lease.room_number} · Bed {lease.bed_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{currencySymbol}{lease.rent_amount.toLocaleString()}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 700 }}>{fmt(lease.start_date)}</div>
                      </td>
                      <td>
                        <span className={`badge-modern ${lease.status === 'Active' ? 'badge-success' : lease.status === 'Expired' ? 'badge-warning' : 'badge-error'}`}>
                          {lease.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
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

            {/* Mobile View */}
            <div className="mobile-only flex flex-col gap-4">
              {filtered.map(lease => (
                <div key={lease.id} className="modern-card" style={{ padding: '1.5rem' }} onClick={() => navigate(`/leases/${lease.id}`)}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center">
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-container-highest)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>hotel</span>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{lease.tenant_name}</h3>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Bed {lease.bed_number}</div>
                      </div>
                    </div>
                    <span className={`badge-modern ${lease.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>{lease.status}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-4">
                    <div>
                      <div className="view-eyebrow" style={{ fontSize: '0.55rem', marginBottom: '0.25rem' }}>Yield</div>
                      <div style={{ fontWeight: 900, fontSize: '1.125rem' }}>{currencySymbol}{lease.rent_amount.toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)' }}>Manage Agreement</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Leases;
