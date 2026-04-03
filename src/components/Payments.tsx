import React, { useState, useMemo } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc, deleteDoc,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { generateMonthlyPayments } from '../utils/generateMonthlyPayments';
import { LoadingScreen } from './layout/LoadingScreen';
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
  status: 'Paid' | 'Pending';
}

type FilterTab = 'All' | 'Paid' | 'Pending';
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'amount_desc' | 'amount_asc' | 'unit_asc';

const Payments: React.FC = () => {
  const { ownerId, isStaff } = useOwner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [filter, setFilter] = useState<FilterTab>('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('date_desc');
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', ownerId],
    queryFn: async () => {
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      const ownerData = ownerSnap.data();
      const curr = ownerData?.currency || 'USD';
      const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      setCurrencySymbol(symbols[curr] || '$');

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
        case 'date_asc':  return a.month_for.localeCompare(b.month_for) || a.payment_date.localeCompare(b.payment_date);
        case 'name_asc':  return a.tenant_name.localeCompare(b.tenant_name);
        case 'name_desc': return b.tenant_name.localeCompare(a.tenant_name);
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc':  return a.amount - b.amount;
        case 'unit_asc': return (a.unit_number || a.bed_number || '').localeCompare(b.unit_number || b.bed_number || '');
        default: return b.month_for.localeCompare(a.month_for) || b.payment_date.localeCompare(a.payment_date);
      }
    });
  }, [payments, filter, search, sort]);

  const stats = useMemo(() => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const thisMonth = payments.filter(p => p.month_for === currentMonth);
    return {
      totalPaid: payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0),
      thisMonthPending: thisMonth.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0),
      thisMonthPaid: thisMonth.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);

  const handleSync = async () => {
    const ok = await showConfirm('Sync will generate pending payments for all active leases for the current month. Proceed with batch generation?');
    if (!ok) return;
    try {
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

  if (isLoading) return <LoadingScreen message="Accessing Ledger Vault" />;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
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
        <div className="properties-metrics-bar custom-scrollbar">
          <div className="prop-metric">
            <span className="prop-metric-label">Gross Realized</span>
            <span className="prop-metric-value" style={{ color: 'var(--primary)' }}>{currencySymbol}{stats.totalPaid.toLocaleString()}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Settled (Cycle)</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{currencySymbol}{stats.thisMonthPaid.toLocaleString()}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Outstanding (Cycle)</span>
            <span className="prop-metric-value" style={{ color: 'var(--error)' }}>{currencySymbol}{stats.thisMonthPending.toLocaleString()}</span>
          </div>
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
          {(['All', 'Paid', 'Pending'] as FilterTab[]).map(tab => (
            <button key={tab} className={`tab-btn ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>
              {tab}
              {filter === tab && <div className="tab-indicator" />}
            </button>
          ))}
        </div>
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
        ) : (
          <>
            <div className="modern-table-wrap desktop-only" style={{ background: 'var(--surface-container-lowest)', borderRadius: '2rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
              <table className="modern-table">
                <thead>
                  <tr>
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
                    const isHostel = !!p.bed_number;
                    return (
                      <tr key={p.id} onClick={() => navigate(`/payments/${p.id}`)} style={{ cursor: 'pointer' }}>
                        <td><span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.tenant_name}</span></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.property_name || p.hostel_name}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>{isHostel ? `Shared · Bed ${p.bed_number}` : `Private · Unit ${p.unit_number}`}</span>
                          </div>
                        </td>
                        <td><span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.month_for}</span></td>
                        <td style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{currencySymbol}{p.amount.toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.payment_method || '—'}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: 500 }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'Unsettled'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.55rem' }}>{p.status}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!isStaff && (
                              <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)} title="Delete Record" style={{ color: 'var(--error)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                              </button>
                            )}
                            <span className="material-symbols-outlined opacity-20 group-hover:opacity-100 transition-opacity" style={{ fontSize: '1.25rem' }}>arrow_forward_ios</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only flex flex-col gap-5">
              {filtered.map(p => (
                <div key={p.id} className="modern-card glass-panel" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => navigate(`/payments/${p.id}`)}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{p.tenant_name}</h3>
                      <div style={{ fontSize: '0.8125rem', opacity: 0.6, fontWeight: 700, color: 'var(--primary)' }}>{p.month_for}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!isStaff && (
                        <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)} style={{ padding: '0.4rem', color: 'var(--error)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                        </button>
                      )}
                      <span className={`badge-modern ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.55rem' }}>{p.status}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 800, opacity: 0.4, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Value Received</div>
                      <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>{currencySymbol}{p.amount.toLocaleString()}</div>
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
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Payments;
