import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Leases.css';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  aadhar_number?: string;
  aadhar_drive_link?: string;
  created_at: any;
  owner_id: string;
}

interface Lease {
  id: string;
  status: string;
  unit_number: string;
  property_name: string;
  rent_amount: number;
}

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    aadhar_number: '',
    aadhar_drive_link: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'tenants', id!));
      if (!snap.exists()) throw new Error('Stakeholder record not found');
      return { id: snap.id, ...snap.data() } as Customer;
    },
    enabled: !!id,
  });

  const { data: activeLeases = [] } = useQuery({
    queryKey: ['customer-leases', id],
    queryFn: async () => {
      const q = query(collection(db, 'leases'), where('tenant_id', '==', id), where('status', '==', 'Active'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Lease));
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name,
        email: customer.email || '',
        phone: customer.phone || '',
        aadhar_number: customer.aadhar_number || '',
        aadhar_drive_link: customer.aadhar_drive_link || '',
      });
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tenants', id!), {
        ...form,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers', ownerId] });
      showAlert('Stakeholder records synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Stakeholder Records" />;
  if (!customer) return null;

  const fmtDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/customers')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Registry Base
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Entity Profile
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">verified</span>
            ID: {customer.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="badge-modern bg-primary/10 text-primary border border-white/5 px-4 py-2 rounded-xl text-xs font-bold uppercase">
            Registered Entity
          </span>
          <span className={`badge-modern border border-white/5 px-4 py-2 rounded-xl text-xs font-bold bg-primary-container/20 text-primary-container uppercase`}>
            Verified
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Entity Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">person</span>
            </div>
            
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Identity Profile</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Full Legal Designation</label>
                <div className="text-white font-display font-bold text-2xl tracking-tight">{customer.full_name}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Onboarding Date</label>
                <div className="text-white/80 font-medium text-lg">{fmtDate(customer.created_at)}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Trust Standing</label>
                <div className="text-success font-display font-bold text-lg">Exemplary Standing</div>
              </div>
              {customer.aadhar_number && (
                <div>
                  <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Aadhaar</label>
                  <div className="text-white/80 font-medium" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{customer.aadhar_number}</span>
                    {customer.aadhar_drive_link && (
                      <a href={customer.aadhar_drive_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }} title="View Aadhaar PDF">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>picture_as_pdf</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Active Engagements</h3>
            <div className="flex flex-col gap-6">
              {activeLeases.length === 0 ? (
                <div className="text-secondary/40 text-sm font-medium italic">No active contractual obligations identified.</div>
              ) : (
                activeLeases.map(lease => (
                  <div key={lease.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => navigate(`/leases/${lease.id}`)}>
                    <div className="text-xs uppercase tracking-widest font-black text-primary mb-1">{lease.property_name}</div>
                    <div className="text-white font-bold">{lease.unit_number}</div>
                    <div className="text-secondary/60 text-xs mt-1">Active Agreement</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Record Management (8 cols) */}
        <div className="lg:col-span-8">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-white font-display font-bold text-3xl tracking-tight">Modify Parameters</h2>
              {isOwner && (
                <div className="flex items-center gap-2 text-primary-container/60 text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                  Ready for Sync
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Full Legal Designation</label>
                <input 
                  type="text" 
                  value={form.full_name} 
                  onChange={e => setForm({...form, full_name: e.target.value})} 
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                  required 
                  disabled={!isOwner} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Digital Correspondence</label>
                  <input 
                    type="email" 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    placeholder="email@legal.com"
                    disabled={!isOwner} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Primary Tele-Channel</label>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    placeholder="+1 (000) 000-0000"
                    disabled={!isOwner} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Aadhaar Number</label>
                  <input
                    type="text"
                    value={form.aadhar_number}
                    onChange={e => setForm({...form, aadhar_number: e.target.value})}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                    disabled={!isOwner}
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">
                    Aadhaar PDF
                    {form.aadhar_drive_link && (
                      <a href={form.aadhar_drive_link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', verticalAlign: 'middle' }}>open_in_new</span>
                      </a>
                    )}
                  </label>
                  <input
                    type="url"
                    value={form.aadhar_drive_link}
                    onChange={e => setForm({...form, aadhar_drive_link: e.target.value})}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-medium text-white"
                    placeholder="https://drive.google.com/..."
                    disabled={!isOwner}
                  />
                </div>
              </div>

              {isOwner && (
                <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-white/5">
                  <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" onClick={() => navigate('/customers')}>
                    Discard Changes
                  </button>
                  <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[200px]" disabled={saving}>
                    {saving ? 'Synchronizing...' : 'Confirm Changes'}
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

export default CustomerDetail;
