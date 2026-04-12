import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Leases.css';

interface Lease {
  id: string;
  bed_id: string | null;
  tenant_id: string;
  tenant_name: string;
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

const LeaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [form, setForm] = useState({
    rent_amount: '',
    security_deposit: '',
    start_date: '',
    end_date: '',
    status: 'Active' as Lease['status'],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const { data: lease, isLoading } = useQuery({
    queryKey: ['lease', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'leases', id!));
      if (!snap.exists()) throw new Error('Lease agreement not found');
      
      const data = { id: snap.id, ...snap.data() } as Lease;
      
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      const curr = ownerSnap.data()?.currency || 'USD';
      const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      setCurrencySymbol(symbols[curr] || '$');

      return data;
    },
    enabled: !!id && !!ownerId,
  });

  useEffect(() => {
    if (lease) {
      setForm({
        rent_amount: String(lease.rent_amount),
        security_deposit: lease.security_deposit ? String(lease.security_deposit) : '',
        start_date: lease.start_date,
        end_date: lease.end_date || '',
        status: lease.status,
        notes: lease.notes || '',
      });
    }
  }, [lease]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !lease) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const leaseRef = doc(db, 'leases', id!);
      
      // Automatically derive status from end_date if it's set
      let derivedStatus = form.status;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (form.end_date && new Date(form.end_date) < today && form.status === 'Active') {
        derivedStatus = 'Expired';
      }

      const updates = {
        rent_amount: parseFloat(form.rent_amount),
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: derivedStatus,
        notes: form.notes || null,
        updated_at: serverTimestamp(),
      };

      batch.update(leaseRef, updates);

      // If status changed to Expired/Terminated, free up the bed
      if (derivedStatus !== 'Active' && lease.bed_id) {
        batch.update(doc(db, 'beds', lease.bed_id), { status: 'Vacant' });
      } else if (derivedStatus === 'Active' && lease.bed_id) {
        // If re-activated, mark bed as occupied
        batch.update(doc(db, 'beds', lease.bed_id), { status: 'Occupied' });
      }

      await batch.commit();
      
      queryClient.invalidateQueries({ queryKey: ['lease', id] });
      queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });
      showAlert('Contract records synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Legal Documents" />;
  if (!lease) return null;

  const unitLabel = `Room ${lease.room_number} · Bed ${lease.bed_number}`;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/leases')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Portfolio Vault
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Agreement Details
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">verified</span>
            ID: {lease.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="badge-modern bg-primary/10 text-primary border border-white/5 px-4 py-2 rounded-xl text-xs font-bold">
            SHARED FACILITY
          </span>
          <span className={`badge-modern border border-white/5 px-4 py-2 rounded-xl text-xs font-bold ${lease.status === 'Active' ? 'bg-primary-container/20 text-primary-container' : 'bg-secondary-container/20 text-secondary'}`}>
            {lease.status.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Asset Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">hotel</span>
            </div>
            
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Asset Profile</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Legal Designation</label>
                <div className="text-white font-display font-bold text-2xl tracking-tight">{lease.tenant_name}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Portfolio Asset</label>
                <div className="text-white/80 font-medium text-lg">{lease.hostel_name}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Inventory Identification</label>
                <div className="text-white/80 font-medium text-lg">{unitLabel}</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Financial Obligation</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Agreed Monthly Yield</label>
                <div className="text-white font-display font-black text-5xl tracking-tighter">
                  {currencySymbol}{lease.rent_amount.toLocaleString()}
                </div>
              </div>
              {lease.security_deposit && (
                <div>
                  <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Security Retainer</label>
                  <div className="text-white/60 font-display font-bold text-2xl tracking-tight">
                    {currencySymbol}{lease.security_deposit.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Record Management (8 cols) */}
        <div className="lg:col-span-8">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-white font-display font-bold text-3xl tracking-tight">Legal Provisions</h2>
              {isOwner && (
                <div className="flex items-center gap-2 text-primary-container/60 text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                  Ready for Sync
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Adjust Monthly Yield ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.rent_amount} 
                    onChange={e => setForm({...form, rent_amount: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={!isOwner} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Adjust Security Retainer ({currencySymbol})</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.security_deposit} 
                    onChange={e => setForm({...form, security_deposit: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    disabled={!isOwner} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Commencement Date</label>
                  <input 
                    type="date" 
                    value={form.start_date} 
                    onChange={e => setForm({...form, start_date: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    required 
                    disabled={!isOwner} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Target Maturity Date</label>
                  <input 
                    type="date" 
                    value={form.end_date} 
                    onChange={e => setForm({...form, end_date: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    disabled={!isOwner} 
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-4">Agreement Status Lifecycle</label>
                <div className="flex flex-wrap gap-4">
                  {(['Active', 'Expired', 'Terminated'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({...form, status: s})}
                      className={`flex-1 py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all duration-300 ${form.status === s ? 'bg-white text-on-primary shadow-lg scale-[1.02]' : 'bg-surface-container-low text-secondary/40 hover:text-white hover:bg-white/5'}`}
                      disabled={!isOwner}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Contractual Addendum & Internal Intelligence</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})}
                  className="auth-input w-full min-h-[160px] bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-3xl p-6 font-medium text-white leading-relaxed resize-none"
                  placeholder="Record additional contractual provisions, negotiation history, or risk assessment..."
                  disabled={!isOwner}
                />
              </div>

              {isOwner && (
                <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-white/5">
                  <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" onClick={() => navigate('/leases')}>
                    Discard Changes
                  </button>
                  <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[220px]" disabled={saving}>
                    {saving ? 'Synchronizing...' : 'Finalize Agreement'}
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

export default LeaseDetail;
