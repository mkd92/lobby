import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, getDoc, deleteDoc,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { prefetchMap } from '../App';
import PaymentSlideOver from './PaymentSlideOver';
import { PageSkeleton } from './layout/PageSkeleton';
import { useListKeyNav } from '../hooks/useListKeyNav';

import '../styles/Payments.css';
import '../styles/Leases.css';

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
  hostel_id: string | null;
  hostel_name: string | null;
  rent_amount: number;
  amount: number;
  payment_date: string;
  month_for: string;
  payment_method: string | null;
  status: 'Paid' | 'Partial' | 'Pending';
}

type FilterTab = 'All' | 'Outstanding' | 'Paid' | 'Partial' | 'Pending';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc' | 'amount_asc' | 'unit_asc';
type MetricPeriod = 'month' | 'quarter' | 'all';

// ── Overdue helpers ────────────────────────────────────────────────────
const now = new Date();
const isPastMonth = (monthFor: string) => {
  const d = new Date(monthFor);
  return d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth());
};
const isOverdue = (p: Payment) => (p.status === 'Pending' || p.status === 'Partial') && isPastMonth(p.month_for);
const monthsOverdue = (monthFor: string) => {
  const d = new Date(monthFor);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
};

// ── Main Component ─────────────────────────────────────────────────────
const Payments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const { ownerId, userRole } = useOwner();
  const isOwner = userRole === 'owner';
  const canWrite = userRole === 'owner' || userRole === 'manager';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [filter, setFilter] = useState<FilterTab>('All');
  const [sort,   setSort]   = useState<SortOption>('date_desc');
  const [search, setSearch] = useState('');
  const [metricPeriod, setMetricPeriod] = useState<MetricPeriod>('month');

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [receiveModal, setReceiveModal] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null });
  const [receiveForm, setReceiveForm]   = useState({ amount: '', payment_date: localStorage.getItem('lastPaymentDate') || new Date().toISOString().split('T')[0], payment_method: 'Cash' });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Data Fetching ──────────────────────────────────────────────────
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });

  const { data: tenants = [] } = useQuery<any[]>({
    queryKey: ['tenants', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!ownerId,
  });

  const { data: leases = [] } = useQuery<any[]>({
    queryKey: ['leases', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    enabled: !!ownerId,
  });

  const sendWhatsAppReminder = (p: Payment) => {
    const lease = leases.find(l => l.id === p.lease_id);
    const tenant = tenants.find(t => t.id === lease?.tenant_id || t.full_name === p.tenant_name);
    
    if (!tenant?.phone) {
      showAlert(`Contact number not found for ${p.tenant_name}`);
      return;
    }

    const pending = p.rent_amount - p.amount;
    const cleanPhone = tenant.phone.replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const message = `Dear *${p.tenant_name}*,

Friendly reminder from *${p.hostel_name || p.property_name || 'Management'}* regarding your rent for *${p.month_for}*.

Invoice Amount: *${currencySymbol}${p.rent_amount.toLocaleString()}*
Outstanding Balance: *${currencySymbol}${pending.toLocaleString()}*

Please settle the outstanding amount at your earliest convenience. If you have already initiated the transfer, please share the transaction reference.

Thank you!`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const currencySymbol = SYMBOLS[ownerProfile?.currency] || '$';

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', ownerId],
    queryFn: async () => {
      const [invoicesSnap, legacySnap, receiptsSnap, hostelsSnap] = await Promise.all([
        getDocs(query(collection(db, 'invoices'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'receipts'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId))),
      ]);

      const hostelsData = hostelsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
      const hostelMap = new Map(hostelsData.map(h => [h.id, h.name]));

      const resolveHostel = (data: any) => {
        let hId = data.hostel_id;
        if (!hId) {
          if (hostelsData.length === 1) hId = hostelsData[0].id;
          else if (data.hostel_name) {
            const storedName = data.hostel_name.toLowerCase();
            const match = hostelsData.find(h => 
              h.name.toLowerCase().includes(storedName) || 
              storedName.includes(h.name.toLowerCase())
            );
            if (match) hId = match.id;
          }
        }
        return { hId, hName: hId ? hostelMap.get(hId) : data.hostel_name };
      };

      const receipts = receiptsSnap.docs.map(d => d.data());
      const legacyMap = new Map(legacySnap.docs.map(d => [d.id, d.data()]));
      
      // Process Invoices
      const invoicePayments = invoicesSnap.docs.map(d => {
        const data = d.data();
        const legacyData = legacyMap.get(d.id);
        
        const paidAmount = receipts
          .filter(r => r.invoice_id === d.id)
          .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
        
        // Merge: prefer legacy data for descriptive fields as they are more likely to be populated
        const merged = {
          ...data,
          tenant_name:  legacyData?.tenant_name || data.tenant_name || '',
          hostel_id:    legacyData?.hostel_id || data.hostel_id || null,
          hostel_name:  legacyData?.hostel_name || data.hostel_name || null,
          month_for:    legacyData?.month_for || data.month_for || '',
          rent_amount:  legacyData?.rent_amount || data.amount || 0,
          room_number:  legacyData?.room_number || null,
          bed_number:   legacyData?.bed_number || null,
          unit_number:  legacyData?.unit_number || null,
          property_name: legacyData?.property_name || null,
          payment_date: legacyData?.payment_date || null,
        };

        const { hId, hName } = resolveHostel(merged);

        return {
          id: d.id,
          ...merged,
          amount: paidAmount,
          payment_date: data.due_date || merged.payment_date || '',
          hostel_id: hId || null,
          hostel_name: hName || null,
        } as Payment;
      });

      const invoiceIds = new Set(invoicePayments.map(p => p.id));

      // Process Legacy Payments (only those not already represented by an invoice)
      const legacyPayments = legacySnap.docs
        .filter(d => !invoiceIds.has(d.id))
        .map(d => {
          const data = d.data();
          const { hId, hName } = resolveHostel(data);
          return { 
            id: d.id, 
            ...data, 
            hostel_id: hId || null,
            hostel_name: hName || null
          } as Payment;
        });

      return [...invoicePayments, ...legacyPayments].sort((a, b) => 
        (b.month_for || '').localeCompare(a.month_for || '') || 
        (b.payment_date || '').localeCompare(a.payment_date || '')
      );
    },
    enabled: !!ownerId,
  });

  useListKeyNav(payments, (p) => setSelectedId(p.id));

  // ── Handlers ───────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await showConfirm('Delete this billing record? All associated receipts will be lost.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'payments', id));
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      showAlert('Ledger entry purged.');
    } catch (err) { showAlert((err as Error).message); }
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
      const batch = writeBatch(db);
      
      toUpdate.forEach(p => {
        const paymentRef = doc(db, 'payments', p.id);
        const remainingAmount = p.rent_amount - p.amount;
        
        batch.set(paymentRef, {
          owner_id: ownerId!,
          status: 'Paid',
          amount: p.rent_amount,
          payment_date: p.payment_date || today,
          updated_at: serverTimestamp(),
        }, { merge: true });

        const invoiceRef = doc(db, 'invoices', p.id);
        batch.set(invoiceRef, {
          owner_id: ownerId!,
          lease_id: p.lease_id || '',
          tenant_name: p.tenant_name || '',
          hostel_id: p.hostel_id || null,
          hostel_name: p.hostel_name || null,
          month_for: p.month_for || '',
          amount: p.rent_amount || 0,
          due_date: p.payment_date || today,
          status: 'Paid',
          updated_at: serverTimestamp(),
          legacy_payment_id: p.id,
        }, { merge: true });

        if (remainingAmount > 0) {
          const receiptRef = doc(collection(db, 'receipts'));
          batch.set(receiptRef, {
            owner_id: ownerId!,
            invoice_id: p.id,
            tenant_name: p.tenant_name,
            amount: remainingAmount,
            payment_date: p.payment_date || today,
            payment_method: 'Unknown',
            legacy_transaction_id: 'bulk_paid',
            created_at: serverTimestamp(),
          });

          const jeRef = doc(collection(db, 'journal_entries'));
          batch.set(jeRef, {
            owner_id: ownerId!,
            date: p.payment_date || today,
            description: `Payment Received (Bulk) - ${p.tenant_name}`,
            reference_type: 'Receipt',
            reference_id: receiptRef.id,
            debit_account_code: '1000',
            credit_account_code: '1200',
            amount: remainingAmount,
            created_at: serverTimestamp(),
          });
        }
      });
      
      await batch.commit();
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
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const openReceiveModal = (p: Payment) => {
    setReceiveModal({ open: true, payment: p });
    setReceiveForm({ 
      amount: String(p.rent_amount - p.amount), 
      payment_date: localStorage.getItem('lastPaymentDate') || new Date().toISOString().split('T')[0], 
      payment_method: 'Cash' 
    });
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = receiveModal.payment;
    if (!p) return;
    const newAmount = parseFloat(receiveForm.amount);
    if (isNaN(newAmount) || newAmount <= 0) return;

    setSaving(true);
    const totalReceived = p.amount + newAmount;
    const newStatus: Payment['status'] = totalReceived >= p.rent_amount ? 'Paid' : 'Partial';

    try {
      if (receiveForm.payment_date) localStorage.setItem('lastPaymentDate', receiveForm.payment_date);
      const storedAmount = newStatus === 'Paid' ? p.rent_amount : totalReceived;
      
      const batch = writeBatch(db);
      
      const paymentRef = doc(db, 'payments', p.id);
      batch.set(paymentRef, {
        owner_id: ownerId!,
        amount: storedAmount,
        payment_date: receiveForm.payment_date,
        payment_method: receiveForm.payment_method,
        status: newStatus,
        updated_at: serverTimestamp(),
      }, { merge: true });
      
      const txRef = doc(collection(db, 'payments', p.id, 'transactions'));
      batch.set(txRef, {
        owner_id:         ownerId!,
        amount:           newAmount,
        payment_date:     receiveForm.payment_date,
        payment_method:   receiveForm.payment_method,
        cumulative_total: storedAmount,
        recorded_at:      serverTimestamp(),
      });

      const invoiceRef = doc(db, 'invoices', p.id);
      batch.set(invoiceRef, {
        owner_id: ownerId!,
        lease_id: p.lease_id || '',
        tenant_name: p.tenant_name || '',
        hostel_id: p.hostel_id || null,
        hostel_name: p.hostel_name || null,
        month_for: p.month_for || '',
        amount: p.rent_amount || 0,
        due_date: p.payment_date || receiveForm.payment_date,
        status: newStatus,
        updated_at: serverTimestamp(),
        legacy_payment_id: p.id,
      }, { merge: true });

      const receiptRef = doc(collection(db, 'receipts'));
      batch.set(receiptRef, {
        owner_id: ownerId!,
        invoice_id: p.id,
        tenant_name: p.tenant_name,
        amount: newAmount,
        payment_date: receiveForm.payment_date,
        payment_method: receiveForm.payment_method,
        legacy_transaction_id: txRef.id,
        created_at: serverTimestamp(),
      });

      const jeRef = doc(collection(db, 'journal_entries'));
      batch.set(jeRef, {
        owner_id: ownerId!,
        date: receiveForm.payment_date,
        description: `Payment Received - ${p.tenant_name}`,
        reference_type: 'Receipt',
        reference_id: receiptRef.id,
        debit_account_code: '1000',
        credit_account_code: '1200',
        amount: newAmount,
        created_at: serverTimestamp(),
      });

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      setReceiveModal({ open: false, payment: null });
      showAlert(newStatus === 'Paid' ? 'Payment received in full.' : 'Partial payment recorded.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered / Sorted Data ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = payments.filter(p => {
      if (filter === 'All') return true;
      if (filter === 'Outstanding') return p.status === 'Pending' || p.status === 'Partial';
      return p.status === filter;
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.tenant_name || '').toLowerCase().includes(q) || 
        (p.hostel_name || '').toLowerCase().includes(q) || 
        (p.property_name || '').toLowerCase().includes(q) ||
        (p.month_for || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'date_asc':    return a.month_for.localeCompare(b.month_for) || a.payment_date.localeCompare(b.payment_date);
        case 'name_asc':    return a.tenant_name.localeCompare(b.tenant_name);
        case 'name_desc':   return b.tenant_name.localeCompare(a.tenant_name);
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc':  return a.amount - b.amount;
        case 'unit_asc':    return (a.bed_number || '').localeCompare(b.bed_number || '');
        default:            return b.month_for.localeCompare(a.month_for) || b.payment_date.localeCompare(a.payment_date);
      }
    });
  }, [payments, filter, sort, search]);

  const metrics = useMemo(() => {
    let totalCollected = 0;
    let settledCount = 0;
    let outstanding = 0;
    let overdue = 0;

    const today = new Date();
    const currentMonth = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const currentYear = today.getFullYear();

    payments.forEach(p => {
      const isInScope = metricPeriod === 'all' || 
        (metricPeriod === 'month' && p.month_for === currentMonth) ||
        (metricPeriod === 'quarter' && new Date(p.month_for).getFullYear() === currentYear);

      if (isInScope) {
        totalCollected += p.amount;
        if (p.status === 'Paid') settledCount++;
        outstanding += (p.rent_amount - p.amount);
        if (isOverdue(p)) overdue += (p.rent_amount - p.amount);
      }
    });

    return { totalCollected, settledCount, outstanding, overdue };
  }, [payments, metricPeriod]);

  if (isLoading) return <div className="view-container"><PageSkeleton hasMetrics cols={[3, 3, 2, 2, 2]} rows={8} /></div>;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      {selectedId && (
        <PaymentSlideOver
          id={selectedId}
          currencySymbol={currencySymbol}
          onClose={() => setSelectedId(null)}
          onUpdated={() => {}}
        />
      )}

      {/* Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Financial Ledger</p>
          <h1 className="view-title text-4xl md:text-6xl">Revenue & Receipts</h1>
        </div>
        {canWrite && (
          <div className="flex gap-4">
            <button 
              onClick={() => prefetchMap.lobby?.()} 
              onMouseEnter={() => prefetchMap.lobby?.()}
              className="primary-button"
            >
              Generate Cycle
            </button>
          </div>
        )}
      </header>

      {/* Metrics Bar */}
      <div className="properties-metrics-bar mb-12">
        <div className="prop-metric">
          <div className="flex items-center gap-2 mb-2">
            <span className="prop-metric-label">Period</span>
            <div className="flex bg-surface-container-high p-0.5 rounded-lg border border-outline-variant">
              {(['month', 'quarter', 'all'] as MetricPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setMetricPeriod(p)}
                  className={`px-2 py-0.5 rounded-md text-[0.55rem] font-black uppercase tracking-wider transition-all ${metricPeriod === p ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-metric-value">{currencySymbol}{metrics.totalCollected.toLocaleString()}</div>
          <div className="view-eyebrow" style={{ fontSize: '0.55rem', opacity: 0.4, margin: '0.25rem 0 0' }}>Realized Capital</div>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Settled</span>
          <span className="prop-metric-value">{metrics.settledCount}</span>
          <div className="view-eyebrow" style={{ fontSize: '0.55rem', opacity: 0.4, margin: '0.25rem 0 0' }}>Verified Records</div>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Outstanding</span>
          <span className="prop-metric-value">{currencySymbol}{metrics.outstanding.toLocaleString()}</span>
          <div className="view-eyebrow" style={{ fontSize: '0.55rem', opacity: 0.4, margin: '0.25rem 0 0' }}>Receivable Debt</div>
        </div>
        <div className="prop-metric" style={metrics.overdue > 0 ? { background: 'rgba(239, 68, 68, 0.05)' } : undefined}>
          <span className="prop-metric-label" style={metrics.overdue > 0 ? { color: 'var(--error)' } : undefined}>Overdue</span>
          <span className="prop-metric-value" style={metrics.overdue > 0 ? { color: 'var(--error)' } : undefined}>{currencySymbol}{metrics.overdue.toLocaleString()}</span>
          <div className="view-eyebrow" style={{ fontSize: '0.55rem', opacity: 0.4, margin: '0.25rem 0 0' }}>High Urgency</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', opacity: 0.3 }}>search</span>
          <input
            type="text"
            placeholder="Search by payee, facility, or period..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.75rem 1.25rem 0.75rem 3rem', color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600 }}
          />
        </div>

        <div className="filter-tabs-modern" style={{ margin: 0 }}>
          {(['All', 'Outstanding', 'Paid', 'Partial', 'Pending'] as FilterTab[]).map(tab => (
            <button key={tab} className={`tab-btn ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>
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
              <option value="amount_desc">High Value</option>
              <option value="amount_asc">Low Value</option>
              <option value="unit_asc">Room Number</option>
            </select>
          </div>
          {canWrite && selectedIds.size > 0 && (
            <button className="primary-button" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem' }} onClick={handleBulkPaid} disabled={saving}>
              {saving ? 'Processing...' : `Settle ${selectedIds.size}`}
            </button>
          )}
        </div>
      </div>

      <div className="payments-content-area">
        {filtered.length === 0 ? (
          <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
            <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>receipt_long</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Ledger Is Clear</h2>
            <p className="text-on-surface-variant max-w-md mx-auto">No transaction records match your current view filters.</p>
          </div>
        ) : (
          <div className="modern-table-wrap" style={{ borderRadius: '1.5rem' }}>
            <table className="modern-table responsive-payments-table">
              <thead>
                <tr>
                  {canWrite && <th className="col-check" style={{ width: '3rem' }}></th>}
                  <th className="col-payee">Payee Entity</th>
                  <th className="col-inventory">Asset Inventory</th>
                  <th className="col-period">Service Period</th>
                  <th className="col-value">Settlement Value</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isHostel  = !!p.bed_number;
                  const overdue   = isOverdue(p);
                  const months    = overdue ? monthsOverdue(p.month_for) : 0;
                  const isChecked = selectedIds.has(p.id);
                  return (
                    <tr key={p.id} onClick={() => setSelectedId(p.id)} style={{ cursor: 'pointer', opacity: isChecked ? 0.7 : 1 }}>
                      {canWrite && (
                        <td className="col-check" onClick={e => toggleSelect(e, p.id)}>
                          <div style={{ width: '1.125rem', height: '1.125rem', borderRadius: '0.375rem', border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--outline-variant)'}`, background: isChecked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isChecked && <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', color: 'var(--on-primary)', fontWeight: 900 }}>check</span>}
                          </div>
                        </td>
                      )}
                      <td className="col-payee">
                        <span className="payee-name">{p.tenant_name}</span>
                        <div className="mobile-period-value">
                          <div className="flex items-center gap-2">
                            <span className="mobile-period">{p.month_for}</span>
                            {(p.status === 'Pending' || p.status === 'Partial') && (
                              <span className="mobile-pending-tag">
                                {currencySymbol}{(p.rent_amount - p.amount).toLocaleString()} due
                              </span>
                            )}
                          </div>
                          <span className="mobile-value">{currencySymbol}{p.rent_amount.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="col-inventory">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.property_name || p.hostel_name || 'Facility'}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>
                            {isHostel 
                              ? (p.room_number ? `Rm ${p.room_number} · Bed ${p.bed_number || '?'}` : (p.bed_number ? `Bed ${p.bed_number}` : 'No unit assigned'))
                              : `Unit ${p.unit_number || '—'}`}
                          </span>
                        </div>
                      </td>
                      <td className="col-period">
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.month_for}</span>
                        {overdue && <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 800, color: 'var(--error)', textTransform: 'uppercase', marginTop: '0.15rem' }}>{months}mo overdue</span>}
                      </td>
                      <td className="col-value">
                        <span style={{ fontWeight: 800, color: 'var(--on-surface)', fontSize: '1rem' }}>{currencySymbol}{p.rent_amount.toLocaleString()}</span>
                        {(p.status === 'Pending' || p.status === 'Partial') && (
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--error)', marginTop: '0.15rem' }}>
                            {currencySymbol}{(p.rent_amount - p.amount).toLocaleString()} Pending
                          </span>
                        )}
                        {p.status === 'Paid' && (
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.15rem' }}>
                            Fully Settled
                          </span>
                        )}
                      </td>
                      <td className="col-status">
                        <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : p.status === 'Partial' ? 'badge-partial' : 'badge-warning'}`}>{p.status}</span>
                      </td>
                      <td className="col-actions" style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {canWrite && (p.status === 'Pending' || p.status === 'Partial') && (
                            <>
                              <button className="btn-icon" onClick={(e) => { e.stopPropagation(); sendWhatsAppReminder(p); }} style={{ color: '#25D366' }} title="Send WhatsApp Reminder">
                                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>chat</span>
                              </button>
                              <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openReceiveModal(p); }} style={{ color: 'var(--primary)' }} title="Receive Payment">
                                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>payments</span>
                              </button>
                            </>
                          )}
                          {isOwner && (
                            <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(e, p.id); }} title="Delete Record">
                              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                            </button>
                          )}
                          <span className="material-symbols-outlined opacity-20" style={{ marginLeft: '0.5rem' }}>arrow_forward_ios</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Modal */}
      {receiveModal.open && receiveModal.payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="modern-card w-full max-w-md page-fade-in" style={{ padding: '2.5rem' }}>
            <h2 className="text-2xl font-bold mb-2">Settle Balance</h2>
            <p className="text-on-surface-variant text-sm mb-8">Recording payment for {receiveModal.payment.tenant_name}</p>
            <form onSubmit={handleReceiveSubmit}>
              <div className="form-group-modern">
                <label>Amount to Receive ({currencySymbol})</label>
                <input type="number" step="0.01" value={receiveForm.amount} onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })} required autoFocus />
              </div>
              <div className="form-group-modern">
                <label>Method</label>
                <select value={receiveForm.payment_method} onChange={e => setReceiveForm({ ...receiveForm, payment_method: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="Online">Digital Transfer</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="Bank">Bank Deposit</option>
                </select>
              </div>
              <div className="form-group-modern">
                <label>Settlement Date</label>
                <input type="date" value={receiveForm.payment_date} onChange={e => setReceiveForm({ ...receiveForm, payment_date: e.target.value })} required />
              </div>
              <div className="flex gap-4 mt-10">
                <button type="button" className="modal-discard-btn flex-1" onClick={() => setReceiveModal({ open: false, payment: null })}>Discard</button>
                <button type="submit" className="primary-button flex-1" disabled={saving}>{saving ? 'Processing...' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
