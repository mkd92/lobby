import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/Leases.css';
import '../styles/Properties.css';

const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', 'Office', 'Retail', 'Warehouse'];

const currencySymbols: { [key: string]: string } = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
};

interface Unit {
  id: string;
  unit_number: string;
  floor: number;
  type: string;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
  base_rent: number;
  area_sqft: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  total_units: number;
  owner_id: string;
}

// ── CustomSelect (Vault Style) ──────────────────────────────────────────
const CustomSelect: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}> = ({ options, value, onChange, label, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`custom-select-container ${disabled ? 'disabled' : ''}`} ref={ref}>
      <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">{label}</label>
      <div 
        className={`custom-select-trigger ${open ? 'open' : ''}`} 
        onClick={() => !disabled && setOpen(!open)}
        style={{ background: 'var(--surface-container-low)', padding: '1rem 1.25rem', borderRadius: '1.125rem', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{value}</span>
        <span className="material-symbols-outlined" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.4 }}>
          keyboard_arrow_down
        </span>
      </div>

      {open && (
        <div className="custom-options glass-panel" style={{ top: 'calc(100% + 0.5rem)', background: 'var(--surface)', backdropFilter: 'blur(32px)', borderRadius: '1.25rem', border: '1px solid var(--outline-variant)', position: 'absolute', width: '100%', zIndex: 100, boxShadow: 'var(--shadow-elevated)' }}>
          <div className="options-list-scroll custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {options.map((o) => (
              <div 
                key={o} 
                className={`custom-option ${o === value ? 'selected' : ''}`}
                onClick={() => { onChange(o); setOpen(false); }}
                style={{ padding: '0.875rem 1.25rem', cursor: 'pointer', fontWeight: o === value ? 800 : 600, color: o === value ? 'var(--primary)' : 'inherit' }}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isStaff = userRole !== 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '0',
    type: 'Studio',
    base_rent: '',
    area_sqft: '',
    status: 'Vacant' as Unit['status'],
  });
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const [propForm, setPropForm] = useState({ name: '', address: '', type: '' });
  const [savingProp, setSavingProp] = useState(false);

  useEscapeKey(() => setIsModalOpen(false), isModalOpen);

  const { data: property, isLoading: isPropLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'properties', id!));
      if (!snap.exists()) throw new Error('Property not found');
      
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      setCurrencySymbol(currencySymbols[ownerSnap.data()?.currency || 'USD'] || '$');
      
      const data = { id: snap.id, ...snap.data() } as Property;
      setPropForm({ name: data.name, address: data.address, type: data.type });
      return data;
    },
    enabled: !!id && !!ownerId,
  });

  const handlePropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    setSavingProp(true);
    try {
      await updateDoc(doc(db, 'properties', id!), {
        ...propForm,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
      showAlert('Asset profile synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSavingProp(false);
    }
  };

  const { data: units = [] } = useQuery({
    queryKey: ['units', id],
    queryFn: async () => {
      const q = query(collection(db, 'units'), where('property_id', '==', id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit))
        .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
    },
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const total = units.length;
    const occupied = units.filter(u => u.status === 'Occupied').length;
    const vacant = units.filter(u => u.status === 'Vacant').length;
    const rent = units.reduce((acc, u) => acc + (u.base_rent || 0), 0);
    return { 
      total, 
      occupied,
      vacant,
      occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0, 
      totalRent: rent 
    };
  }, [units]);

  const openAdd = () => {
    setUnitForm({ unit_number: '', floor: '0', type: 'Studio', base_rent: '', area_sqft: '', status: 'Vacant' });
    setIsModalOpen(true);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { 
        ...unitForm, 
        floor: parseInt(unitForm.floor), 
        base_rent: parseFloat(unitForm.base_rent), 
        area_sqft: parseFloat(unitForm.area_sqft), 
        property_id: id, 
        owner_id: ownerId, 
        updated_at: serverTimestamp() 
      };
      
      await addDoc(collection(db, 'units'), { ...payload, created_at: serverTimestamp() });
      await updateDoc(doc(db, 'properties', id!), { total_units: (property?.total_units || 0) + 1 });
      
      queryClient.invalidateQueries({ queryKey: ['units', id] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      setIsModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: Unit) => {
    if (u.status === 'Occupied') { 
      showAlert('Operation Restricted: Cannot terminate an occupied inventory record. Terminate the active lease first.'); 
      return; 
    }
    const ok = await showConfirm(`Are you sure you want to remove Unit ${u.unit_number} from the registry?`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'units', u.id));
      await updateDoc(doc(db, 'properties', id!), { total_units: Math.max(0, (property?.total_units || 0) - 1) });
      queryClient.invalidateQueries({ queryKey: ['units', id] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isPropLoading) return <LoadingScreen message="Accessing Portfolio Asset" />;
  if (!property) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/properties')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Portfolio Vault
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Asset Detail
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">location_on</span>
            {property.address}
          </p>
        </div>
        {!isStaff && (
          <button className="primary-button min-w-[200px]" onClick={openAdd}>
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>add_business</span>
            Add Inventory
          </button>
        )}
      </header>

      {/* Metrics Bar */}
      <div className="properties-metrics-bar custom-scrollbar">
        <div className="prop-metric">
          <span className="prop-metric-label">Total Inventory</span>
          <span className="prop-metric-value">{stats.total}</span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Occupancy Rate</span>
          <span className="prop-metric-value" style={{ color: stats.occupancy > 80 ? 'var(--color-success)' : 'inherit' }}>{stats.occupancy}%</span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Portfolio Yield</span>
          <span className="prop-metric-value">{currencySymbol}{stats.totalRent.toLocaleString()}</span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Vacant Units</span>
          <span className="prop-metric-value" style={{ color: stats.vacant > 0 ? 'var(--tertiary)' : 'inherit' }}>{stats.vacant}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Asset Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">domain</span>
            </div>
            
            <h2 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Asset Profile</h2>
            <form onSubmit={handlePropSubmit} className="flex flex-col gap-8">
              <div className="form-group-modern">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Legal Asset Name</label>
                <input 
                  type="text" 
                  value={propForm.name} 
                  onChange={e => setPropForm({...propForm, name: e.target.value})}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-xl p-3 font-display font-bold text-lg text-white"
                  required
                  disabled={isStaff}
                />
              </div>
              <div className="form-group-modern">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Physical Address</label>
                <input 
                  type="text" 
                  value={propForm.address} 
                  onChange={e => setPropForm({...propForm, address: e.target.value})}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-xl p-3 font-medium text-white/80"
                  required
                  disabled={isStaff}
                />
              </div>
              <div className="form-group-modern">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Classification</label>
                <select 
                  value={propForm.type} 
                  onChange={e => setPropForm({...propForm, type: e.target.value})}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-xl p-3 font-medium text-white/80 appearance-none"
                  disabled={isStaff}
                >
                  {['Residential', 'Commercial', 'Industrial', 'Mixed'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {!isStaff && (
                <button type="submit" className="primary-button text-[0.7rem] py-3" disabled={savingProp}>
                  {savingProp ? 'Syncing...' : 'Update Profile'}
                </button>
              )}
            </form>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Asset Insights</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Active Leases</span>
                <span className="text-white font-bold">{stats.occupied}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Available Slots</span>
                <span className="text-white font-bold">{stats.vacant}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Avg. Rent</span>
                <span className="text-white font-bold">{currencySymbol}{stats.total > 0 ? Math.round(stats.totalRent / stats.total).toLocaleString() : 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Inventory Registry (8 cols) */}
        <div className="lg:col-span-8">
          <div className="leases-table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Inventory ID</th>
                  <th>Classification</th>
                  <th>Floor</th>
                  <th>Base Rent</th>
                  <th>Surface</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '4rem', opacity: 0.4, fontSize: '0.875rem' }}>
                      No inventory records identified for this asset.
                    </td>
                  </tr>
                ) : (
                  units.map(u => (
                    <tr key={u.id} onClick={() => navigate(`/units/${u.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--primary)' }}>{u.unit_number}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{u.type}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>Floor {u.floor}</span>
                      </td>
                      <td>
                        <div className="financial-cell" style={{ fontSize: '0.9375rem' }}>{currencySymbol}{u.base_rent.toLocaleString()}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{u.area_sqft} SQFT</span>
                      </td>
                      <td>
                        <span className={`badge-modern ${u.status === 'Vacant' ? 'badge-success' : u.status === 'Occupied' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.5rem' }}>
                          {u.status}
                        </span>
                      </td>
                      <td>
                        {!isStaff && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn-icon danger" style={{ color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); handleDelete(u); }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content-modern" style={{ maxWidth: '640px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">Add Inventory</h2>
              <p className="modal-subtitle">Configure spatial and financial parameters for this unit</p>
            </header>
            <form onSubmit={handleUnitSubmit} className="modal-form-modern">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Unit Designation</label>
                  <input 
                    type="text" 
                    value={unitForm.unit_number} 
                    onChange={e => setUnitForm({...unitForm, unit_number: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    placeholder="e.g. 101"
                    required 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Floor Level</label>
                  <input 
                    type="number" 
                    value={unitForm.floor} 
                    onChange={e => setUnitForm({...unitForm, floor: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CustomSelect 
                  label="Classification" 
                  options={unitTypes} 
                  value={unitForm.type} 
                  onChange={v => setUnitForm({...unitForm, type: v})} 
                />
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Operational Status</label>
                  <div className="flex gap-2">
                    {(['Vacant', 'Occupied', 'Maintenance'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUnitForm({...unitForm, status: s})}
                        className={`flex-1 py-3 px-2 rounded-xl font-bold text-[0.6rem] uppercase tracking-widest transition-all duration-300 ${unitForm.status === s ? 'bg-white text-on-primary shadow-lg' : 'bg-surface-container-low text-secondary/40 hover:text-white'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Base Monthly Yield ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={unitForm.base_rent} 
                    onChange={e => setUnitForm({...unitForm, base_rent: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Surface Area (SQFT)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={unitForm.area_sqft} 
                    onChange={e => setUnitForm({...unitForm, area_sqft: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
              </div>

              <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-8 pt-6 border-t border-white/5">
                <button type="button" className="primary-button glass-panel w-full sm:w-auto" onClick={() => setIsModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)' }}>Discard</button>
                <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[200px]" disabled={saving}>
                  {saving ? 'Synchronizing...' : 'Finalize Record'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
