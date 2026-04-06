import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, getDoc, deleteDoc,
  updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useListKeyNav } from '../hooks/useListKeyNav';
import { generateMonthlyPayments, previewMonthlyPayments } from '../utils/generateMonthlyPayments';
import { LoadingScreen } from './layout/LoadingScreen';
import PaymentSlideOver from './PaymentSlideOver';
import '../styles/Units.css';
import '../styles/Leases.css';
import '../styles/Payments.css';

// ── Types ──────────────────────────────────────────────────────────────
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
  status: 'Paid' | 'Partial' | 'Pending';
}

type FilterTab = 'All' | 'Paid' | 'Partial' | 'Pending';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc' | 'amount_asc' | 'unit_asc';
type MetricPeriod = 'month' | 'quarter' | 'all';

// ── Overdue helpers ────────────────────────────────────────────────────
const now = new Date();
const isPastMonth = (monthFor: string) => {
  const d = new Date(monthFor);
  return d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth());
};
const monthsOverdue = (monthFor: string) => {
  const d = new Date(monthFor);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
};
const isOverdue = (p: Payment) => p.status !== 'Paid' && isPastMonth(p.month_for);

const Payments: React.FC = () => {
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [searchParams] = useSearchParams();
  const [filter, setFilter]           = useState<FilterTab>((searchParams.get('status') as FilterTab | null) ?? 'All');
  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState<SortOption>('date_desc');
  const [saving, setSaving]           = useState(false);
  const [metricPeriod, setMetricPeriod] = useState<MetricPeriod>('month');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode,   setViewMode]     = useState<'all' | 'property'>('all');
  const [propSort,   setPropSort]     = useState<{ col: 'date' | 'property' | 'tenant' | 'amount'; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' });

  // Receive payment modal
  const [receiveModal, setReceiveModal] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null });
  const [receiveForm, setReceiveForm]   = useState({ amount: '', payment_date: '', payment_method: 'Cash' });
  const [receiveSaving, setReceiveSaving] = useState(false);

  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const currencySymbol = SYMBOLS[ownerProfile?.currency] || '$';

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))
        .sort((a, b) => b.month_for.localeCompare(a.month_for) || b.payment_date.localeCompare(a.payment_date));
    },
    enabled: !!ownerId,
  });

  const filtered = useMemo(() => {
    const list = payments.filter(p => {
      const matchFilter = filter === 'All' || p.status === filter;
      const q = search.toLowerCase();
      const matchSearch = p.tenant_name.toLowerCase().includes(q) ||
        (p.property_name && p.property_name.toLowerCase().includes(q)) ||
        (p.hostel_name && p.hostel_name.toLowerCase().includes(q)) ||
        (p.unit_number && p.unit_number.toLowerCase().includes(q)) ||
        (p.month_for && p.month_for.toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'date_asc':    return a.month_for.localeCompare(b.month_for) || a.payment_date.localeCompare(b.payment_date);
        case 'name_asc':    return a.tenant_name.localeCompare(b.tenant_name);
        case 'name_desc':   return b.tenant_name.localeCompare(a.tenant_name);
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc':  return a.amount - b.amount;
        case 'unit_asc':    return (a.unit_number || a.bed_number || '').localeCompare(b.unit_number || b.bed_number || '');
        default:            return b.month_for.localeCompare(a.month_for) || b.payment_date.localeCompare(a.payment_date);
      }
    });
  }, [payments, filter, search, sort]);

  const { selectedId: kbSelectedId } = useListKeyNav(
    filtered,
    (p) => setSelectedId(p.id),
    !receiveModal.open && !selectedId,
  );

  // ── Metrics ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const inPeriod = (monthFor: string) => {
      const d = new Date(monthFor);
      if (metricPeriod === 'month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      } else if (metricPeriod === 'quarter') {
        return d.getFullYear() === now.getFullYear() &&
          Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
      }
      return true;
    };
    const period = payments.filter(p => inPeriod(p.month_for));
    return {
      settled:     period.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0),
      outstanding: period.filter(p => p.status !== 'Paid').reduce((s, p) => s + (p.rent_amount - p.amount), 0),
      collected:   payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0),
      overdue:     payments.filter(p => isOverdue(p)).reduce((s, p) => s + (p.rent_amount - p.amount), 0),
    };
  }, [payments, metricPeriod]);

  // ── Property ledger grouping ────────────────────────────────────────────
  const propertyLedger = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      let v = 0;
      switch (propSort.col) {
        case 'date':     v = (a.payment_date || '').localeCompare(b.payment_date || ''); break;
        case 'tenant':   v = a.tenant_name.localeCompare(b.tenant_name); break;
        case 'amount':   v = a.amount - b.amount; break;
        case 'property': v = (a.property_name || a.hostel_name || '').localeCompare(b.property_name || b.hostel_name || ''); break;
      }
      return propSort.dir === 'asc' ? v : -v;
    });
    const groups = new Map<string, { name: string; items: Payment[]; collected: number; outstanding: number }>();
    sorted.forEach(p => {
      const key = p.property_name || p.hostel_name || 'Unassigned';
      if (!groups.has(key)) groups.set(key, { name: key, items: [], collected: 0, outstanding: 0 });
      const g = groups.get(key)!;
      g.items.push(p);
      if (p.status === 'Paid')                          g.collected   += p.amount;
      if (p.status === 'Pending' || p.status === 'Partial') g.outstanding += (p.rent_amount - p.amount);
    });
    return [...groups.values()];
  }, [filtered, propSort]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSync = async () => {
    try {
      setSaving(true);
      const preview = await previewMonthlyPayments(ownerId!);
      setSaving(false);
      if (preview.toCreate.length === 0) {
        showAlert(`All ${preview.existing} active lease${preview.existing !== 1 ? 's' : ''} already have records for this month. Nothing to generate.`);
        return;
      }
      const lines = preview.toCreate.slice(0, 8).map(r => `• ${r.tenant_name} (${r.unit}) — ${currencySymbol}${r.rent_amount.toLocaleString()}`).join('\n');
      const more  = preview.toCreate.length > 8 ? `\n• …and ${preview.toCreate.length - 8} more` : '';
      const msg   = `${preview.toCreate.length} new record${preview.toCreate.length !== 1 ? 's' : ''} will be created:\n${lines}${more}${preview.existing ? `\n\n${preview.existing} existing record${preview.existing !== 1 ? 's' : ''} will be left unchanged.` : ''}`;
      const ok = await showConfirm(msg);
      if (!ok) return;
      setSaving(true);
      await generateMonthlyPayments(ownerId!);
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      showAlert('Cycle generation completed successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, paymentId: string) => {
    e.stopPropagation();
    const ok = await showConfirm('Are you sure you want to delete this payment record? This action cannot be undone.', { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'payments', paymentId));
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      showAlert('Record successfully removed from ledger.');
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const handleBulkPaid = async () => {
    if (selectedIds.size === 0) return;
    const toUpdate = payments.filter(p => selectedIds.has(p.id) && p.status !== 'Paid');
    if (toUpdate.length === 0) {
      showAlert('All selected records are already marked as Paid.');
      setSelectedIds(new Set());
      return;
    }
    const ok = await showConfirm(`Mark ${toUpdate.length} payment${toUpdate.length !== 1 ? 's' : ''} as Paid?`);
    if (!ok) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all(toUpdate.map(p => updateDoc(doc(db, 'payments', p.id), {
        status: 'Paid',
        amount: p.rent_amount,
        payment_date: p.payment_date || today,
        updated_at: serverTimestamp(),
      })));
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      setSelectedIds(new Set());
      showAlert(`${toUpdate.length} payment${toUpdate.length !== 1 ? 's' : ''} marked as Paid.`);
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openReceiveModal = (payment: Payment) => {
    const remaining = payment.status === 'Partial' ? payment.rent_amount - payment.amount : payment.rent_amount;
    const savedDate = localStorage.getItem('lastPaymentDate') || new Date().toISOString().split('T')[0];
    setReceiveForm({ amount: String(remaining), payment_date: savedDate, payment_method: 'Cash' });
    setReceiveModal({ open: true, payment });
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModal.payment) return;
    const p = receiveModal.payment;
    const newAmount = parseFloat(receiveForm.amount);
    if (!newAmount || newAmount <= 0) return;
    const alreadyReceived = p.status === 'Partial' ? p.amount : 0;
    const totalReceived   = alreadyReceived + newAmount;
    if (totalReceived > p.rent_amount) return;
    const newStatus: Payment['status'] = totalReceived >= p.rent_amount ? 'Paid' : 'Partial';
    setReceiveSaving(true);
    try {
      if (receiveForm.payment_date) localStorage.setItem('lastPaymentDate', receiveForm.payment_date);
      const storedAmount = newStatus === 'Paid' ? p.rent_amount : totalReceived;
      await updateDoc(doc(db, 'payments', p.id), {
        amount: storedAmount,
        payment_date: receiveForm.payment_date,
        payment_method: receiveForm.payment_method,
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      // Write transaction log
      await addDoc(collection(db, 'payments', p.id, 'transactions'), {
        amount:           newAmount,
        payment_date:     receiveForm.payment_date,
        payment_method:   receiveForm.payment_method,
        cumulative_total: storedAmount,
        recorded_at:      serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      setReceiveModal({ open: false, payment: null });
      showAlert(
        newStatus === 'Paid'
          ? 'Payment received in full. Record marked as Paid.'
          : `Partial payment recorded. ${currencySymbol}${(p.rent_amount - totalReceived).toLocaleString()} still outstanding.`
      );
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setReceiveSaving(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Ledger Vault" />;

  const periodLabel = metricPeriod === 'month' ? 'This Month' : metricPeriod === 'quarter' ? 'This Quarter' : 'All Time';

  return (
    <div className="view-container page-fade-in">
      {DialogMount}

      {/* Slide-over */}
      {selectedId && (
        <PaymentSlideOver
          id={selectedId}
          currencySymbol={currencySymbol}
          onClose={() => setSelectedId(null)}
          onUpdated={() => setSelectedId(null)}
        />
      )}

      {/* Receive Payment Modal */}
      {receiveModal.open && receiveModal.payment && (() => {
        const p = receiveModal.payment!;
        const alreadyReceived = p.status === 'Partial' ? p.amount : 0;
        const entered      = parseFloat(receiveForm.amount) || 0;
        const totalWouldBe = alreadyReceived + entered;
        const isOver       = totalWouldBe > p.rent_amount;
        const isFull       = !isOver && totalWouldBe > 0 && totalWouldBe >= p.rent_amount;
        const remaining    = p.rent_amount - totalWouldBe;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
               onClick={() => setReceiveModal({ open: false, payment: null })}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} />
            <div className="glass-panel" style={{ position: 'relative', borderRadius: '2.5rem', padding: '2.5rem', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-ambient)' }}
                 onClick={e => e.stopPropagation()}>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.4, marginBottom: '0.5rem' }}>Receive Payment</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.75rem', margin: 0, lineHeight: 1.1 }}>{p.tenant_name}</h2>
                <p style={{ fontSize: '0.8125rem', opacity: 0.5, fontWeight: 600, marginTop: '0.35rem' }}>{p.property_name || p.hostel_name} · {p.month_for}</p>
              </div>

              <div style={{ background: 'var(--surface-container-low)', borderRadius: '1.25rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700 }}>
                  <span style={{ opacity: 0.5 }}>Contracted Rent</span>
                  <span>{currencySymbol}{p.rent_amount.toLocaleString()}</span>
                </div>
                {p.status === 'Partial' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700 }}>
                      <span style={{ opacity: 0.5 }}>Already Received</span>
                      <span style={{ color: 'var(--color-success)' }}>{currencySymbol}{p.amount.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700 }}>
                      <span style={{ opacity: 0.5 }}>Balance Due</span>
                      <span style={{ color: '#fb923c' }}>{currencySymbol}{(p.rent_amount - p.amount).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              <form onSubmit={handleReceiveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group-modern">
                  <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.4, display: 'block', marginBottom: '0.5rem' }}>Amount ({currencySymbol})</label>
                  <input type="number" step="0.01" min="0.01" max={p.rent_amount - alreadyReceived} value={receiveForm.amount}
                    onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })}
                    className="auth-input w-full" style={{ borderRadius: '1rem', padding: '0.875rem 1rem', fontWeight: 700, fontSize: '1.125rem', background: 'var(--surface-container-low)', border: 'none', width: '100%', boxSizing: 'border-box' }} required />
                  {entered > 0 && (
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem', color: isOver ? 'var(--error)' : isFull ? 'var(--color-success)' : '#fb923c' }}>
                      {isOver
                        ? `Exceeds contracted rent by ${currencySymbol}${(totalWouldBe - p.rent_amount).toLocaleString()}`
                        : isFull
                        ? 'Full payment — record will be marked Paid'
                        : `Partial — ${currencySymbol}${remaining.toLocaleString()} will still be outstanding`}
                    </p>
                  )}
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.4, display: 'block', marginBottom: '0.5rem' }}>Date</label>
                  <input type="date" value={receiveForm.payment_date}
                    onChange={e => setReceiveForm({ ...receiveForm, payment_date: e.target.value })}
                    className="auth-input w-full" style={{ borderRadius: '1rem', padding: '0.875rem 1rem', fontWeight: 600, background: 'var(--surface-container-low)', border: 'none', width: '100%', boxSizing: 'border-box', color: 'var(--on-surface)' }} required />
                </div>

                <div className="form-group-modern">
                  <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.4, display: 'block', marginBottom: '0.5rem' }}>Payment Channel</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {['Cash', 'Bank Transfer', 'Online', 'Check'].map(m => (
                      <button key={m} type="button" onClick={() => setReceiveForm({ ...receiveForm, payment_method: m })}
                        style={{ padding: '0.625rem 0.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: receiveForm.payment_method === m ? 'white' : 'var(--surface-container-low)', color: receiveForm.payment_method === m ? '#111' : 'var(--on-surface-variant)' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setReceiveModal({ open: false, payment: null })}
                    style={{ flex: 1, padding: '0.875rem', borderRadius: '1rem', fontWeight: 700, fontSize: '0.8125rem', background: 'var(--surface-container-low)', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" style={{ flex: 2 }} disabled={receiveSaving || isOver || entered <= 0}>
                    {receiveSaving ? 'Processing...' : 'Receive Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, opacity: 0.8 }}>
            {selectedIds.size} selected
          </span>
          <button className="primary-button" style={{ padding: '0.5rem 1.25rem', fontSize: '0.8125rem' }} onClick={handleBulkPaid} disabled={saving}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.35rem' }}>check_circle</span>
            Mark as Paid
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-icon" style={{ color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>close</span>
          </button>
        </div>
      )}

      <header className="view-header">
        <p className="view-eyebrow">Financial Ledger</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h1 className="view-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Revenue & Receipts</h1>
          {!isStaff && (
            <button onClick={handleSync} className="primary-button" disabled={saving}>
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>autorenew</span>
              {saving ? 'Processing...' : 'Generate Cycle'}
            </button>
          )}
        </div>
      </header>

      {/* Metrics Bar */}
      {payments.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar" style={{ alignItems: 'center' }}>
          {/* Period selector */}
          <div className="prop-metric" style={{ borderRight: '1px solid var(--outline-variant)', paddingRight: '1.5rem' }}>
            <span className="prop-metric-label" style={{ marginBottom: '0.5rem' }}>Period</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['month', 'quarter', 'all'] as MetricPeriod[]).map(p => (
                <button key={p} onClick={() => setMetricPeriod(p)} style={{
                  padding: '0.3rem 0.625rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.6rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer',
                  background: metricPeriod === p ? 'var(--primary)' : 'transparent',
                  color: metricPeriod === p ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s',
                }}>
                  {p === 'month' ? 'Month' : p === 'quarter' ? 'QTD' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Total Collected</span>
            <span className="prop-metric-value" style={{ color: 'var(--primary)' }}>{currencySymbol}{stats.collected.toLocaleString()}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Settled ({periodLabel})</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{currencySymbol}{stats.settled.toLocaleString()}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Outstanding ({periodLabel})</span>
            <span className="prop-metric-value" style={{ color: 'var(--error)' }}>{currencySymbol}{stats.outstanding.toLocaleString()}</span>
          </div>
          {stats.overdue > 0 && (
            <div className="prop-metric">
              <span className="prop-metric-label" style={{ color: 'var(--error)' }}>Overdue</span>
              <span className="prop-metric-value" style={{ color: 'var(--error)' }}>{currencySymbol}{stats.overdue.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="properties-toolbar">
        <div className="prop-search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            type="text"
            placeholder="Search by payee entity, asset, or period..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="prop-search-input"
          />
        </div>
        <div className="filter-tabs-modern">
          {(['All', 'Paid', 'Partial', 'Pending'] as FilterTab[]).map(tab => (
            <button key={tab} className={`tab-btn ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>
              {tab}
              {filter === tab && <div className="tab-indicator" />}
            </button>
          ))}
        </div>
        {viewMode === 'all' && (
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
              <option value="amount_desc">Amount High–Low</option>
              <option value="amount_asc">Amount Low–High</option>
              <option value="unit_asc">Unit / Bed</option>
            </select>
          </div>
        )}

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-container-low)', borderRadius: '0.875rem', padding: '0.25rem', flexShrink: 0 }}>
          <button
            onClick={() => setViewMode('all')}
            title="All Transactions"
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', background: viewMode === 'all' ? 'var(--surface-container-highest)' : 'transparent', color: viewMode === 'all' ? 'var(--on-surface)' : 'var(--on-surface-variant)', transition: 'all 0.15s' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>list</span>
          </button>
          <button
            onClick={() => setViewMode('property')}
            title="Property Ledger"
            style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', background: viewMode === 'property' ? 'var(--surface-container-highest)' : 'transparent', color: viewMode === 'property' ? 'var(--primary)' : 'var(--on-surface-variant)', transition: 'all 0.15s' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>table_chart</span>
          </button>
        </div>
      </div>

      <div className="payments-content-area">
        {filtered.length === 0 ? (
          <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>receipt_long</span>
            </div>
            <h2>Clear Ledger</h2>
            <p className="text-on-surface-variant mb-10 max-w-md mx-auto">No transaction records found for this selection. Adjust your parameters or generate the next billing cycle.</p>
          </div>
        ) : viewMode === 'property' ? (
          /* ── Property Ledger view ─────────────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {propertyLedger.map(group => {
              const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', padding: '0.875rem 1rem' };
              const sortIcon = (col: typeof propSort.col) => {
                const active = propSort.col === col;
                return (
                  <span className="material-symbols-outlined" style={{ fontSize: '0.8rem', marginLeft: '0.3rem', verticalAlign: 'middle', opacity: active ? 0.9 : 0.25, color: active ? 'var(--primary)' : undefined }}>
                    {active && propSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                );
              };
              const cycleSort = (col: typeof propSort.col) =>
                setPropSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));

              return (
                <div key={group.name} style={{ background: 'var(--surface-container-lowest)', borderRadius: '1.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-ambient)' }}>
                  {/* Property header */}
                  <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', opacity: 0.5 }}>apartment</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{group.name}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: 600, marginTop: '0.1rem' }}>
                          {group.items.length} record{group.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                      {group.collected > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, opacity: 0.4 }}>Collected</div>
                          <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#22c55e' }}>{currencySymbol}{group.collected.toLocaleString()}</div>
                        </div>
                      )}
                      {group.outstanding > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, opacity: 0.4 }}>Outstanding</div>
                          <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--error)' }}>{currencySymbol}{group.outstanding.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sortable table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="modern-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={thStyle} onClick={() => cycleSort('date')}>
                            Date {sortIcon('date')}
                          </th>
                          <th style={thStyle} onClick={() => cycleSort('property')}>
                            Property {sortIcon('property')}
                          </th>
                          <th style={thStyle} onClick={() => cycleSort('tenant')}>
                            Tenant {sortIcon('tenant')}
                          </th>
                          <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => cycleSort('amount')}>
                            Amount Paid {sortIcon('amount')}
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                          {!isStaff && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(p => {
                          const overdue = isOverdue(p);
                          return (
                            <tr key={p.id} onClick={() => setSelectedId(p.id)} style={{ cursor: 'pointer', ...(overdue ? { borderLeft: '3px solid var(--error)' } : {}) }}>
                              <td style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : <span style={{ opacity: 0.35 }}>—</span>}
                                {overdue && (
                                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--error)' }}>
                                    {monthsOverdue(p.month_for)}mo overdue
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.property_name || p.hostel_name || '—'}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.45, fontWeight: 500 }}>
                                  {p.unit_number ? `Unit ${p.unit_number}` : p.bed_number ? `Bed ${p.bed_number}` : '—'}
                                  {p.room_number ? ` · Room ${p.room_number}` : ''}
                                </div>
                              </td>
                              <td style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.tenant_name}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
                                  {currencySymbol}{p.amount.toLocaleString()}
                                </span>
                                {p.status === 'Partial' && (
                                  <div style={{ fontSize: '0.65rem', color: '#fb923c', fontWeight: 700 }}>
                                    of {currencySymbol}{p.rent_amount.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-partial' : 'badge-warning'}`}>{p.status}</span>
                              </td>
                              {!isStaff && (
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {(p.status === 'Pending' || p.status === 'Partial') && (
                                      <button className="btn-icon" onClick={e => { e.stopPropagation(); openReceiveModal(p); }} title="Receive Payment" style={{ color: 'var(--primary)' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>payments</span>
                                      </button>
                                    )}
                                    <button className="btn-icon danger" onClick={e => handleDelete(e, p.id)} style={{ color: 'var(--error)' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── All Transactions view (existing) ─────────────────────────── */
          <>
            {/* Desktop table */}
            <div className="modern-table-wrap desktop-only" style={{ background: 'var(--surface-container-lowest)', borderRadius: '2rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    {!isStaff && <th style={{ width: '2.5rem' }}></th>}
                    <th>Payee Entity</th>
                    <th>Asset Inventory</th>
                    <th>Service Period</th>
                    <th>Value</th>
                    <th>Settlement</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const isHostel  = !!p.bed_number;
                    const overdue   = isOverdue(p);
                    const months    = overdue ? monthsOverdue(p.month_for) : 0;
                    const isChecked = selectedIds.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        style={{ cursor: 'pointer', ...(overdue ? { borderLeft: '3px solid var(--error)' } : {}), ...(kbSelectedId === p.id ? { outline: '2px solid var(--primary)', outlineOffset: '-2px' } : {}) }}
                        className={overdue ? 'row-overdue' : ''}
                      >
                        {!isStaff && (
                          <td onClick={e => toggleSelect(e, p.id)} style={{ width: '2.5rem', padding: '0 0.75rem' }}>
                            <div style={{
                              width: '1.125rem', height: '1.125rem', borderRadius: '0.375rem', border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--outline-variant)'}`,
                              background: isChecked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                            }}>
                              {isChecked && <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', color: 'var(--on-primary)', fontVariationSettings: '"wght" 700' }}>check</span>}
                            </div>
                          </td>
                        )}
                        <td><span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.tenant_name}</span></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.property_name || p.hostel_name}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>{isHostel ? `Shared · Bed ${p.bed_number}` : `Private · Unit ${p.unit_number}`}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.month_for}</span>
                          {overdue && (
                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--error)', marginTop: '0.15rem' }}>
                              {months}mo overdue
                            </span>
                          )}
                        </td>
                        <td>
                          <div>
                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{currencySymbol}{p.amount.toLocaleString()}</span>
                            {p.status === 'Partial' && (
                              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#fb923c', marginTop: '0.1rem' }}>
                                of {currencySymbol}{p.rent_amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.payment_method || '—'}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: 500 }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'Unsettled'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-partial' : 'badge-warning'}`}>{p.status}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!isStaff && (p.status === 'Pending' || p.status === 'Partial') && (
                              <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openReceiveModal(p); }} title="Receive Payment" style={{ color: 'var(--primary)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>payments</span>
                              </button>
                            )}
                            {!isStaff && (
                              <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)} title="Delete Record" style={{ color: 'var(--error)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                              </button>
                            )}
                            <span className="material-symbols-outlined opacity-20" style={{ fontSize: '1.25rem' }}>arrow_forward_ios</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-only flex flex-col gap-5">
              {filtered.map(p => {
                const overdue = isOverdue(p);
                const months  = overdue ? monthsOverdue(p.month_for) : 0;
                return (
                  <div key={p.id} className="modern-card glass-panel" style={{ padding: '1.5rem', cursor: 'pointer', ...(overdue ? { borderLeft: '3px solid var(--error)' } : {}) }} onClick={() => setSelectedId(p.id)}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{p.tenant_name}</h3>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: overdue ? 'var(--error)' : 'var(--primary)', opacity: overdue ? 1 : 0.6 }}>
                          {p.month_for}{overdue ? ` · ${months}mo overdue` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {!isStaff && (p.status === 'Pending' || p.status === 'Partial') && (
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openReceiveModal(p); }} style={{ padding: '0.4rem', color: 'var(--primary)' }} title="Receive Payment">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>payments</span>
                          </button>
                        )}
                        {!isStaff && (
                          <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)} style={{ padding: '0.4rem', color: 'var(--error)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                          </button>
                        )}
                        <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-partial' : 'badge-warning'}`}>{p.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, opacity: 0.4, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Received</div>
                        <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>{currencySymbol}{p.amount.toLocaleString()}</div>
                        {p.status === 'Partial' && <div style={{ fontSize: '0.65rem', color: '#fb923c', fontWeight: 700 }}>of {currencySymbol}{p.rent_amount.toLocaleString()}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, opacity: 0.4, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Channel</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.payment_method || 'Unset'}</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipted: {p.payment_date || 'N/A'}</span>
                      <span className="material-symbols-outlined opacity-40" style={{ fontSize: '1.125rem' }}>arrow_forward_ios</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Payments;

