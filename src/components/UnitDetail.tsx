import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Leases.css';

const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', 'Office', 'Retail', 'Warehouse'];

interface Unit {
  id: string;
  unit_number: string;
  floor: number;
  type: string;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
  base_rent: number;
  area_sqft: number;
  property_id: string;
}

const UnitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isStaff = userRole !== 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [form, setForm] = useState({
    unit_number: '',
    floor: '',
    type: 'Studio',
    base_rent: '',
    area_sqft: '',
    status: 'Vacant' as Unit['status'],
  });
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const { data: unit, isLoading } = useQuery({
    queryKey: ['unit', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'units', id!));
      if (!snap.exists()) throw new Error('Unit record not found');
      
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      const curr = ownerSnap.data()?.currency || 'USD';
      const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      setCurrencySymbol(symbols[curr] || '$');

      return { id: snap.id, ...snap.data() } as Unit;
    },
    enabled: !!id && !!ownerId,
  });

  useEffect(() => {
    if (unit) {
      setForm({
        unit_number: unit.unit_number,
        floor: String(unit.floor),
        type: unit.type,
        base_rent: String(unit.base_rent),
        area_sqft: String(unit.area_sqft),
        status: unit.status,
      });
    }
  }, [unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'units', id!), {
        unit_number: form.unit_number,
        floor: parseInt(form.floor),
        type: form.type,
        base_rent: parseFloat(form.base_rent),
        area_sqft: parseFloat(form.area_sqft),
        status: form.status,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['unit', id] });
      queryClient.invalidateQueries({ queryKey: ['units', unit?.property_id] });
      showAlert('Inventory record synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!unit) return;
    if (unit.status === 'Occupied') {
      showAlert('Operation Restricted: Cannot terminate an occupied inventory record. Terminate the active lease first.');
      return;
    }
    const ok = await showConfirm(`Are you sure you want to remove Unit ${unit.unit_number} from the registry?`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'units', unit.id));
      queryClient.invalidateQueries({ queryKey: ['units', unit.property_id] });
      navigate(`/properties/${unit.property_id}`);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Inventory Record" />;
  if (!unit) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate(`/properties/${unit.property_id}`)}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Asset Registry
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Unit Detail
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">fingerprint</span>
            ID: {unit.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="badge-modern bg-primary/10 text-primary border border-white/5 px-4 py-2 rounded-xl text-xs font-bold uppercase">
            {unit.type}
          </span>
          <span className={`badge-modern border border-white/5 px-4 py-2 rounded-xl text-xs font-bold ${unit.status === 'Vacant' ? 'bg-primary-container/20 text-primary-container' : 'bg-secondary-container/20 text-secondary'}`}>
            {unit.status.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Asset Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">meeting_room</span>
            </div>
            
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Spatial Profile</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Unit Designation</label>
                <div className="text-white font-display font-bold text-2xl tracking-tight">{unit.unit_number}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Floor Level</label>
                <div className="text-white/80 font-medium text-lg">Level {unit.floor}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Surface Area</label>
                <div className="text-white/80 font-medium text-lg">{unit.area_sqft} SQFT</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Financial Profile</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Monthly Base Yield</label>
                <div className="text-white font-display font-black text-5xl tracking-tighter">
                  {currencySymbol}{unit.base_rent.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {!isStaff && (
            <button className="btn-icon danger w-full glass-panel py-4 rounded-2xl flex items-center justify-center gap-2 text-error font-bold" onClick={handleDelete}>
              <span className="material-symbols-outlined">delete</span>
              Terminate Inventory Record
            </button>
          )}
        </div>

        {/* Right Column: Record Management (8 cols) */}
        <div className="lg:col-span-8">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-white font-display font-bold text-3xl tracking-tight">Modify Parameters</h2>
              {!isStaff && (
                <div className="flex items-center gap-2 text-primary-container/60 text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                  Ready for Sync
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Unit Number</label>
                  <input 
                    type="text" 
                    value={form.unit_number} 
                    onChange={e => setForm({...form, unit_number: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Floor Level</label>
                  <input 
                    type="number" 
                    value={form.floor} 
                    onChange={e => setForm({...form, floor: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Classification</label>
                  <select 
                    value={form.type} 
                    onChange={e => setForm({...form, type: e.target.value})}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-bold text-white appearance-none"
                    disabled={isStaff}
                  >
                    {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Monthly Yield ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.base_rent} 
                    onChange={e => setForm({...form, base_rent: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Surface Area (SQFT)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={form.area_sqft} 
                    onChange={e => setForm({...form, area_sqft: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Status Lifecycle</label>
                  <div className="flex flex-wrap gap-2">
                    {(['Vacant', 'Occupied', 'Maintenance'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({...form, status: s})}
                        className={`flex-1 py-4 px-2 rounded-xl font-bold text-[0.65rem] uppercase tracking-widest transition-all duration-300 ${form.status === s ? 'bg-white text-on-primary shadow-lg scale-[1.02]' : 'bg-surface-container-low text-secondary/40 hover:text-white hover:bg-white/5'}`}
                        disabled={isStaff}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!isStaff && (
                <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-white/5">
                  <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" onClick={() => navigate(`/properties/${unit.property_id}`)}>
                    Discard Changes
                  </button>
                  <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[220px]" disabled={saving}>
                    {saving ? 'Synchronizing...' : 'Finalize Record'}
                  </button>
                </footer>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitDetail;
