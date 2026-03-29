import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Leases.css';

interface Payment {
  id: string;
  lease_id: string;
  owner_id: string;
  tenant_name: string;
  unit_number: string | null;
  property_name: string | null;
  bed_number: string | null;
  room_number: string | null;
  hostel_name: string | null;
  rent_amount: number;
  amount: number;
  payment_date: string;
  month_for: string;
  payment_method: string | null;
  status: 'Paid' | 'Pending';
}

const PaymentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [form, setForm] = useState({
    amount: '',
    payment_date: '',
    month_for: '',
    payment_method: 'Cash',
    status: 'Paid' as 'Paid' | 'Pending',
  });
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'payments', id!));
      if (!snap.exists()) throw new Error('Transaction record not found');
      const data = { id: snap.id, ...snap.data() } as Payment;

      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      const curr = ownerSnap.data()?.currency || 'USD';
      const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      setCurrencySymbol(symbols[curr] || '$');

      return data;
    },
    enabled: !!id && !!ownerId,
  });

  useEffect(() => {
    if (payment) {
      setForm({
        amount: String(payment.amount),
        payment_date: payment.payment_date,
        month_for: payment.month_for,
        payment_method: payment.payment_method || 'Cash',
        status: payment.status,
      });
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'payments', id!), {
        amount: parseFloat(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        status: form.status,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      showAlert('Financial record synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Transaction Vault" />;
  if (!payment) return null;

  const isHostel = !!payment.bed_number;
  const propName = payment.property_name || payment.hostel_name;
  const unitLabel = isHostel ? `Room ${payment.room_number} · Bed ${payment.bed_number}` : `Unit ${payment.unit_number}`;

  return (
    <div className="view-container page-fade-in mesh-gradient-bg">
      {DialogMount}
      
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/payments')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Financial Ledger
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Receipt Entry
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">receipt</span>
            TXN: {payment.id.slice(0, 12).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="badge-modern bg-primary/10 text-primary border border-white/5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">
            {payment.month_for}
          </span>
          <span className={`badge-modern border border-white/5 px-4 py-2 rounded-xl text-xs font-bold ${payment.status === 'Paid' ? 'bg-primary-container/20 text-primary-container' : 'bg-secondary-container/20 text-secondary'}`}>
            {payment.status.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Asset & Entity</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Payee Designation</label>
                <div className="text-white font-display font-bold text-2xl tracking-tight">{payment.tenant_name}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Portfolio Inventory</label>
                <div className="text-white/80 font-medium text-lg">{propName} — {unitLabel}</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Financial Value</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Settled Amount</label>
                <div className="text-white font-display font-black text-5xl tracking-tighter">
                  {currencySymbol}{payment.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Contracted Rent</label>
                <div className="text-white/60 font-display font-bold text-2xl tracking-tight">
                  {currencySymbol}{payment.rent_amount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <h2 className="text-white font-display font-bold text-3xl tracking-tight mb-12">Transaction Management</h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Settlement Value ({currencySymbol})</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high border-none rounded-2xl p-5 font-display font-bold text-xl" required disabled={isStaff} />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Settlement Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high border-none rounded-2xl p-5 font-medium text-white" required disabled={isStaff} />
                </div>
              </div>

              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-4">Payment Channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['Cash', 'Bank Transfer', 'Online', 'Check'].map(m => (
                    <button key={m} type="button" onClick={() => setForm({...form, payment_method: m})} className={`py-4 rounded-2xl font-bold text-[0.7rem] uppercase tracking-widest transition-all ${form.payment_method === m ? 'bg-white text-on-primary scale-[1.02]' : 'bg-surface-container-low text-secondary/40'}`} disabled={isStaff}>{m}</button>
                  ))}
                </div>
              </div>

              <div className="form-group-modern">
                <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-4">Accounting Status</label>
                <div className="flex gap-4">
                  {['Paid', 'Pending'].map(s => (
                    <button key={s} type="button" onClick={() => setForm({...form, status: s as any})} className={`flex-1 py-4 rounded-2xl font-bold text-[0.7rem] uppercase tracking-widest transition-all ${form.status === s ? 'bg-white text-on-primary scale-[1.02]' : 'bg-surface-container-low text-secondary/40'}`} disabled={isStaff}>{s}</button>
                  ))}
                </div>
              </div>

              {!isStaff && (
                <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-white/5">
                  <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" onClick={() => navigate('/payments')}>Discard Changes</button>
                  <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[220px]" disabled={saving}>{saving ? 'Synchronizing...' : 'Update Record'}</button>
                </footer>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetail;
