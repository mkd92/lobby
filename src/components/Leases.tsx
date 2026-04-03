import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Units.css';
import '../styles/Leases.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Tenant    { id: string; full_name: string; email: string; phone: string; }
interface Property  { id: string; name: string; }
interface Unit      { id: string; unit_number: string; type: string; base_rent: number; status: string; property_id: string; }
interface Hostel    { id: string; name: string; }
interface Room      { id: string; room_number: string; floor: number; beds?: Bed[]; }
interface Bed       { id: string; bed_number: string; price: number; status: string; room_id: string; hostel_id: string; }

interface Lease {
  id: string;
  unit_id: string | null;
  bed_id: string | null;
  tenant_id: string;
  tenant_name: string;
  unit_number: string | null;
  property_name: string | null;
  bed_number: string | null;
  room_number: string | null;
  hostel_name: string | null;
  rent_amount: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  status: 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
}

type LeaseType = 'property' | 'hostel';
type FilterTab  = 'All' | 'Active' | 'Expired' | 'Terminated';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'unit_asc' | 'rent_desc' | 'rent_asc';

interface SelectOption {
  value: string;
  label: string;
  sub?: string;
}

const EMPTY_FORM = {
  tenant_id: '',
  unit_id: '',
  bed_id: '',
  rent_amount: '',
  first_month_rent: '',
  security_deposit: '',
  start_date: '',
  end_date: '',
  status: 'Active' as Lease['status'],
  notes: '',
};

// ── CustomSelect ───────────────────────────────────────────────────────
const CustomSelect: React.FC<{
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  prefilled?: boolean;
  searchable?: boolean;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled = false, prefilled = false, searchable = false }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const filtered = searchable 
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()) || (o.sub && o.sub.toLowerCase().includes(searchTerm.toLowerCase())))
    : options;

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchTerm('');
    }
    setHighlightedIdx(-1);
  }, [open, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlightedIdx(p => (p < filtered.length - 1 ? p + 1 : p));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx(p => (p > 0 ? p - 1 : p));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlightedIdx >= 0) {
        onChange(filtered[highlightedIdx].value);
        setOpen(false);
      } else {
        setOpen(!open);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`custom-select-container ${disabled ? 'disabled' : ''}`} ref={ref} onKeyDown={handleKeyDown}>
      <div 
        className={`custom-select-trigger ${open ? 'open' : ''} ${prefilled ? 'prefilled' : ''}`} 
        onClick={() => !disabled && setOpen(!open)}
        tabIndex={disabled ? -1 : 0}
        style={{ background: 'var(--surface-container-low)', padding: '1rem 1.25rem', borderRadius: '1.125rem', border: 'none' }}
      >
        <div className="trigger-text-wrap">
          {selected ? (
            <div className="selected-val">
              <span className="main-lab" style={{ color: 'var(--primary)', fontWeight: 700 }}>{selected.label}</span>
              {selected.sub && <span className="sub-lab" style={{ opacity: 0.5, fontSize: '0.75rem', marginLeft: '0.5rem' }}>{selected.sub}</span>}
            </div>
          ) : <span className="placeholder" style={{ opacity: 0.4 }}>{placeholder}</span>}
        </div>
        <span className="material-symbols-outlined trigger-icon" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          keyboard_arrow_down
        </span>
      </div>

      {open && (
        <div className="custom-options glass-panel" style={{ top: 'calc(100% + 0.5rem)', background: 'var(--surface)', backdropFilter: 'blur(32px)', borderRadius: '1.25rem', border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-elevated)', zIndex: 100 }}>
          {searchable && (
            <div className="select-search-box" style={{ padding: '0.75rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Type to filter..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--surface-container-low)', border: 'none', borderRadius: '0.75rem', padding: '0.5rem 0.75rem', width: '100%', color: 'var(--on-surface)', fontSize: '0.875rem' }}
              />
            </div>
          )}
          <div className="options-list-scroll custom-scrollbar" style={{ maxHeight: '240px', overflowY: 'auto' }} ref={optionsRef}>
            {filtered.length === 0 ? (
              <div className="no-options" style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.875rem' }}>No matches identified</div>
            ) : filtered.map((o, i) => (
              <div 
                key={o.value} 
                className={`custom-option ${o.value === value ? 'selected' : ''} ${highlightedIdx === i ? 'highlighted' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ padding: '0.875rem 1.25rem', transition: '0.2s' }}
              >
                <div className="opt-content">
                  <div className="opt-label" style={{ fontWeight: o.value === value ? 800 : 600, color: o.value === value ? 'var(--primary)' : 'inherit' }}>{o.label}</div>
                  {o.sub && <div className="opt-sub" style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.15rem' }}>{o.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────
const Leases: React.FC = () => {
  const { ownerId, isStaff } = useOwner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [filter, setFilter] = useState<FilterTab>('All');
  const [sort, setSort] = useState<SortOption>('date_desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaseType, setLeaseType] = useState<LeaseType>('property');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEscapeKey(() => closeModal(), isModalOpen);

  const invalidateLeases = () => queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });

  // ── Data Fetching ──────────────────────────────────────────────────
  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['leases', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId)));
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      const ownerData = ownerSnap.data();
      const curr = ownerData?.currency || 'USD';
      const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      setCurrencySymbol(symbols[curr] || '$');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const allLeases = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lease));

      // Auto-expire leases whose end_date has passed and free up the unit/bed
      const expiredBatch = writeBatch(db);
      let hasExpired = false;
      for (const lease of allLeases) {
        if (lease.status === 'Active' && lease.end_date && new Date(lease.end_date) < today) {
          expiredBatch.update(doc(db, 'leases', lease.id), { status: 'Expired' });
          if (lease.unit_id) expiredBatch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
          if (lease.bed_id)  expiredBatch.update(doc(db, 'beds',  lease.bed_id),  { status: 'Vacant' });
          lease.status = 'Expired';
          hasExpired = true;
        }
      }
      if (hasExpired) await expiredBatch.commit();

      return allLeases.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    },
    enabled: !!ownerId,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)).sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: isModalOpen,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
    },
    enabled: isModalOpen && leaseType === 'property',
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', ownerId, form.unit_id],
    queryFn: async () => {
      const q = query(collection(db, 'units'), where('property_id', '==', form.unit_id), where('status', '==', 'Vacant'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
    },
    enabled: isModalOpen && leaseType === 'property' && !!form.unit_id,
  });

  const { data: hostels = [] } = useQuery({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel));
    },
    enabled: isModalOpen && leaseType === 'hostel',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', ownerId, form.unit_id],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', form.unit_id)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: isModalOpen && leaseType === 'hostel' && !!form.unit_id,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds', ownerId, form.bed_id],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('room_id', '==', form.bed_id), where('status', '==', 'Vacant')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: isModalOpen && leaseType === 'hostel' && !!form.bed_id,
  });

  // ── Modal Actions ──────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setLeaseType('property');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === form.tenant_id);
      let payload: any = {
        owner_id: ownerId,
        tenant_id: form.tenant_id,
        tenant_name: tenant?.full_name || '',
        rent_amount: parseFloat(form.rent_amount),
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        notes: form.notes || null,
        updated_at: serverTimestamp(),
      };

      const batch = writeBatch(db);

      if (leaseType === 'property') {
        const unit = units.find(u => u.id === form.unit_id);
        const prop = properties.find(p => p.id === unit?.property_id);
        payload.unit_id = form.unit_id;
        payload.unit_number = unit?.unit_number || '';
        payload.property_name = prop?.name || '';
        payload.bed_id = null;
        batch.update(doc(db, 'units', form.unit_id), { status: 'Occupied' });
      } else {
        const bed = beds.find(b => b.id === form.bed_id);
        const room = rooms.find(r => r.id === form.bed_id);
        payload.bed_id = form.bed_id;
        payload.bed_number = bed?.bed_number || '';
        payload.room_number = room?.room_number || '';
        payload.hostel_name = hostels.find(h => h.id === form.unit_id)?.name || '';
        batch.update(doc(db, 'beds', form.bed_id), { status: 'Occupied' });
      }

      payload.created_at = serverTimestamp();
      batch.set(doc(collection(db, 'leases')), payload);

      await batch.commit();
      invalidateLeases();
      closeModal();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lease: Lease) => {
    const ok = await showConfirm(`Are you sure you want to terminate this lease agreement for ${lease.tenant_name}? This action is irreversible.`, { danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'leases', lease.id));
      if (lease.status === 'Active') {
        if (lease.unit_id) batch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
        if (lease.bed_id)  batch.update(doc(db, 'beds',  lease.bed_id),  { status: 'Vacant' });
      }
      await batch.commit();
      invalidateLeases();
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = leases.filter(l => filter === 'All' || l.status === filter);
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'date_asc':  return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case 'name_asc':  return a.tenant_name.localeCompare(b.tenant_name);
        case 'name_desc': return b.tenant_name.localeCompare(a.tenant_name);
        case 'unit_asc':  return (a.unit_number || a.room_number || '').localeCompare(b.unit_number || b.room_number || '');
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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="view-eyebrow">Lease Portfolio</p>
            <h1 className="view-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Contractual Yield</h1>
          </div>
          {!isStaff && (
            <button onClick={openCreate} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>description</span>
              Generate Agreement
            </button>
          )}
        </div>
      </header>

      {/* Metrics Bar */}
      {leases.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar">
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

      {/* Modern Filter Tabs */}
      <div className="view-toolbar">
        <div className="filter-tabs-modern">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', fontSize: '1rem', opacity: 0.5, pointerEvents: 'none' }}>sort</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              style={{ background: 'var(--surface-container-low)', border: 'none', borderRadius: '1rem', padding: '0.625rem 1rem 0.625rem 2.25rem', color: 'var(--on-surface)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="name_asc">Tenant A–Z</option>
              <option value="name_desc">Tenant Z–A</option>
              <option value="unit_asc">Unit / Room</option>
              <option value="rent_desc">Rent High–Low</option>
              <option value="rent_asc">Rent Low–High</option>
            </select>
          </div>
          <div className="prop-filter-count">
            {filtered.length} / {leases.length} Legal Agreements Identified
          </div>
        </div>
      </div>

      <div className="leases-content-area">
        {isLoading ? (
          <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingScreen message="Accessing Agreement Vault" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>contract_delete</span>
            </div>
            <h2>Clean Slate</h2>
            <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Your document vault is clear for this selection. Adjust your parameters or initialize a new agreement.</p>
            {filter === 'All' && !isStaff && <button className="primary-button glass-panel mt-4" onClick={openCreate} style={{ background: 'rgba(255,255,255,0.05)' }}>Initialize First Agreement</button>}
          </div>
        ) : (
          <>
            <div className="leases-table-container desktop-only">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th className="col-tenant">Tenant Entity</th>
                    <th className="col-asset">Asset Designation</th>
                    <th>Inventory</th>
                    <th>Financial Value</th>
                    <th>Contractual Period</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lease => {
                    const isHostel  = !!lease.bed_id;
                    const propName  = isHostel ? lease.hostel_name : lease.property_name;
                    const unitLabel = isHostel
                      ? `Room ${lease.room_number} · Bed ${lease.bed_number}`
                      : `${lease.unit_number}`;
                    return (
                      <tr key={lease.id} onClick={() => navigate(`/leases/${lease.id}`)} style={{ cursor: 'pointer' }}>
                        <td className="col-tenant">
                          <div className="flex items-center gap-4" style={{ overflow: 'hidden' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--primary-container)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 900, flexShrink: 0 }}>{initials(lease.tenant_name || '?')}</div>
                            <span className="text-truncate" style={{ fontWeight: 700, fontSize: '0.9375rem' }} title={lease.tenant_name}>{lease.tenant_name}</span>
                          </div>
                        </td>
                        <td className="col-asset">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
                            <div className="badge-modern" style={{ width: 'fit-content', fontSize: '0.55rem', padding: '0.15rem 0.5rem', background: isHostel ? 'rgba(208, 228, 255, 0.1)' : 'rgba(194, 217, 211, 0.1)', color: isHostel ? 'var(--tertiary)' : 'var(--primary)' }}>{isHostel ? 'Shared' : 'Private'}</div>
                            <span className="text-truncate" style={{ fontSize: '0.875rem', fontWeight: 500 }} title={propName || '—'}>{propName || '—'}</span>
                          </div>
                        </td>
                        <td><span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{unitLabel}</span></td>
                        <td>
                          <div className="financial-cell" style={{ fontSize: '1rem' }}>{currencySymbol}{Number(lease.rent_amount).toLocaleString()}</div>
                          {lease.security_deposit ? <div style={{ fontSize: '0.6875rem', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dep: {currencySymbol}{Number(lease.security_deposit).toLocaleString()}</div> : null}
                        </td>
                        <td>
                          <div className="period-cell">
                            <div>{fmt(lease.start_date)}</div>
                            <div style={{ opacity: 0.4 }}>{lease.end_date ? `to ${fmt(lease.end_date)}` : 'Rolling Open'}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-modern ${lease.status === 'Active' ? 'badge-success' : lease.status === 'Expired' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.55rem' }}>{lease.status}</span>
                        </td>
                        <td>
                          {!isStaff && (
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button className="btn-icon danger" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); handleDelete(lease); }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only flex flex-col gap-5">
              {filtered.map(lease => (
                <div key={lease.id} className="modern-card glass-panel" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => navigate(`/leases/${lease.id}`)}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center" style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--on-primary)', fontSize: '1.5rem' }}>{lease.bed_id ? 'hotel' : 'domain'}</span>
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <h3 className="lease-tenant-name" title={lease.tenant_name}>{lease.tenant_name}</h3>
                        <div className="text-truncate" style={{ fontSize: '0.8125rem', opacity: 0.6, fontWeight: 700, color: 'var(--primary)' }} title={lease.unit_number || `Bed ${lease.bed_number}`}>{lease.unit_number || `Bed ${lease.bed_number}`}</div>
                      </div>
                    </div>
                    <span className={`badge-modern ${lease.status === 'Active' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.55rem', flexShrink: 0, marginLeft: '1rem' }}>{lease.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <div style={{ opacity: 0.4, fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Monthly Yield</div>
                      <div style={{ fontWeight: 900, color: 'var(--on-surface)', fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{currencySymbol}{Number(lease.rent_amount).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.4, fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Agreement End</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{lease.end_date ? fmt(lease.end_date) : 'Open Rolling'}</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="view-link" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--secondary)' }}>Manage Contract <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_forward_ios</span></span>
                    {!isStaff && (
                      <button className="btn-icon danger" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); handleDelete(lease); }}><span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-content-modern" style={{ maxWidth: '680px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">Executive Agreement</h2>
              <p className="modal-subtitle">Establish legal terms and financial obligations for this entity</p>
            </header>
            <form onSubmit={handleSubmit} className="modal-form-modern">
              <div className="lease-type-toggle" style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-container-low)', padding: '0.4rem', borderRadius: '1.25rem', marginBottom: '1.5rem' }}>
                <button type="button" className={`toggle-btn ${leaseType === 'property' ? 'active' : ''}`} onClick={() => setLeaseType('property')} style={{ flex: 1, border: 'none', padding: '0.875rem', borderRadius: '1rem', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', background: leaseType === 'property' ? 'var(--surface-container-highest)' : 'transparent', color: leaseType === 'property' ? 'white' : 'var(--on-surface-variant)', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>Private Asset</button>
                <button type="button" className={`toggle-btn ${leaseType === 'hostel' ? 'active' : ''}`} onClick={() => setLeaseType('hostel')} style={{ flex: 1, border: 'none', padding: '0.875rem', borderRadius: '1rem', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', background: leaseType === 'hostel' ? 'var(--surface-container-highest)' : 'transparent', color: leaseType === 'hostel' ? 'white' : 'var(--on-surface-variant)', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>Shared Facility</button>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="form-group-modern">
                  <label>Primary Legal Entity</label>
                  <CustomSelect options={tenants.map(t => ({ value: t.id, label: t.full_name, sub: t.phone || t.email }))} value={form.tenant_id} onChange={v => setForm({...form, tenant_id: v})} placeholder="Search or select legal entity..." searchable />
                </div>
              </div>

              <footer className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/5">
                <button type="button" className="primary-button glass-panel" onClick={closeModal} style={{ background: 'rgba(255,255,255,0.05)' }}>Discard Draft</button>
                <button type="submit" className="primary-button" disabled={saving} style={{ minWidth: '160px' }}>{saving ? 'Processing...' : 'Finalize Contract'}</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leases;
