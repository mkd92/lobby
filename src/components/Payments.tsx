import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { generateMonthlyPayments } from '../utils/generateMonthlyPayments';
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

const METHODS = ['Cash', 'Bank Transfer', 'Online', 'Check'];
const STATUSES = ['Paid', 'Pending'];

// ── CustomSelect ───────────────────────────────────────────────────────
interface SelectOpt { value: string; label: string; sub?: string; }

const CustomSelect: React.FC<{
  options: SelectOpt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open) {
      const currentIdx = options.findIndex(o => o.value === value);
      setHighlightedIdx(currentIdx >= 0 ? currentIdx : 0);
    } else {
      setHighlightedIdx(-1);
    }
  }, [open]);

  useEffect(() => {
    if (optionsRef.current && highlightedIdx >= 0) {
      const el = optionsRef.current.querySelectorAll<HTMLElement>('.custom-option')[highlightedIdx];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx]);

  const selected = options.find(o => o.value === value);

  const selectHighlighted = () => {
    if (highlightedIdx >= 0 && options[highlightedIdx]) {
      onChange(options[highlightedIdx].value);
      setOpen(false);
    }
  };

  return (
    <div className="custom-select-container" ref={ref}>
      <div
        className={`custom-select-trigger ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); !disabled && setOpen(true); }
            return;
          }
          if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, options.length - 1)); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
          if (e.key === 'Enter')     { e.preventDefault(); selectHighlighted(); }
        }}
      >
        <span style={{ color: selected ? 'var(--on-surface)' : 'var(--on-surface-variant)', opacity: selected ? 1 : 0.5 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', transition: '0.2s', transform: open ? 'rotate(180deg)' : '', flexShrink: 0 }}>
          keyboard_arrow_down
        </span>
      </div>
      {open && !disabled && (
        <div className="custom-options" ref={optionsRef}>
          {options.length === 0
            ? <div className="custom-option-empty">No options available</div>
            : options.map((opt, idx) => (
              <div key={opt.value} className={`custom-option ${value === opt.value ? 'selected' : ''} ${idx === highlightedIdx ? 'highlighted' : ''}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
                <div>
                  <div className="custom-option-label">{opt.label}</div>
                  {opt.sub && <div className="custom-option-sub">{opt.sub}</div>}
                </div>
                {value === opt.value && <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', flexShrink: 0 }}>check</span>}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────
const Payments: React.FC = () => {
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();

  const [filter, setFilter]       = useState<FilterTab>('All');
  const [search, setSearch]       = useState('');

  // Modal state
  const [showModal, setShowModal]           = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [modalMode, setModalMode]           = useState<'log' | 'edit'>('log');
  const [saving, setSaving]                 = useState(false);
  const [form, setForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    month_for: '',
    payment_method: 'Cash',
    status: 'Paid' as 'Paid' | 'Pending',
  });


  // ── Queries ────────────────────────────────────────────────────────
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      // Fire-and-forget monthly generation — don't block data loading
      void generateMonthlyPayments(ownerId);

      const snap = await getDocs(query(
        collection(db, 'payments'),
        where('owner_id', '==', ownerId)
      ));

      const data: Payment[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
      // Sort by payment_date descending
      data.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
      return data;
    },
    enabled: !!ownerId,
  });

  const { data: currencySymbol = '₹' } = useQuery({
    queryKey: ['currency', ownerId],
    queryFn: async () => {
      if (!ownerId) return '₹';
      const ownerDoc = await getDoc(doc(db, 'owners', ownerId));
      const data = ownerDoc.data();
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
      return symbols[data?.currency || 'USD'] || '$';
    },
    enabled: !!ownerId,
  });

  const invalidatePayments = () => queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });

  // ── Open modals ────────────────────────────────────────────────────
  const openLogPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setModalMode('log');
    setForm({
      amount:         String(payment.amount),
      payment_date:   new Date().toISOString().split('T')[0],
      month_for:      payment.month_for,
      payment_method: 'Cash',
      status:         'Paid',
    });
    setShowModal(true);
  };

  const openEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setModalMode('edit');
    setForm({
      amount:         String(payment.amount),
      payment_date:   payment.payment_date,
      month_for:      payment.month_for,
      payment_method: payment.payment_method || 'Cash',
      status:         payment.status,
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingPayment(null); };

  useEscapeKey(closeModal, showModal);

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const paidAmount = parseFloat(form.amount) || 0;
    if (paidAmount <= 0) { showAlert('Please enter a valid amount.'); return; }

    setSaving(true);
    try {
      if (modalMode === 'log') {
        const remainder = Math.round((editingPayment.amount - paidAmount) * 100) / 100;

        // Mark this payment as Paid with the amount entered
        await updateDoc(doc(db, 'payments', editingPayment.id), {
          amount:         paidAmount,
          payment_date:   form.payment_date,
          payment_method: form.payment_method || null,
          status:         'Paid',
        });

        // If partial, create a new Pending for the remainder
        if (remainder > 0) {
          await addDoc(collection(db, 'payments'), {
            owner_id:       editingPayment.owner_id,
            lease_id:       editingPayment.lease_id,
            tenant_name:    editingPayment.tenant_name,
            unit_number:    editingPayment.unit_number || null,
            property_name:  editingPayment.property_name || null,
            bed_number:     editingPayment.bed_number || null,
            room_number:    editingPayment.room_number || null,
            hostel_name:    editingPayment.hostel_name || null,
            rent_amount:    editingPayment.rent_amount,
            amount:         remainder,
            payment_date:   editingPayment.payment_date,
            month_for:      editingPayment.month_for,
            payment_method: null,
            status:         'Pending',
            created_at:     serverTimestamp(),
          });
        }
      } else {
        await updateDoc(doc(db, 'payments', editingPayment.id), {
          amount:         paidAmount,
          payment_date:   form.payment_date,
          month_for:      form.month_for,
          payment_method: form.payment_method || null,
          status:         form.status,
        });
      }

      closeModal();
      invalidatePayments();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this payment record?', { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'payments', id));
      invalidatePayments();
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────
  const totalCollected = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const totalPending   = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);

  const fmt      = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const locationLabel = (p: Payment) => {
    if (p.property_name && p.unit_number) return `${p.property_name} · Unit ${p.unit_number}`;
    if (p.hostel_name && p.bed_number)    return `${p.hostel_name} · ${p.bed_number}`;
    return '—';
  };

  const filtered = payments
    .filter(p => filter === 'All' || p.status === filter)
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.tenant_name?.toLowerCase().includes(q) ||
        locationLabel(p).toLowerCase().includes(q) ||
        p.month_for?.toLowerCase().includes(q) ||
        (p.payment_method || '').toLowerCase().includes(q)
      );
    });

  const methodOptions: SelectOpt[] = METHODS.map(m => ({ value: m, label: m }));
  const statusOptions: SelectOpt[] = STATUSES.map(s => ({ value: s, label: s }));

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="payments-page">
      {DialogMount}

      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="display-medium mb-2">Payments</h1>
          <p className="text-on-surface-variant">Track rent collection and outstanding balances</p>
        </div>
      </div>

      {/* Stats */}
      <div className="lease-stats-row" style={{ marginBottom: '2.5rem' }}>
        <div className="lease-stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{payments.length}</div>
        </div>
        <div className="lease-stat-card">
          <div className="stat-label">Collected</div>
          <div className="stat-value green">{currencySymbol}{totalCollected.toLocaleString()}</div>
        </div>
        <div className="lease-stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value amber">{currencySymbol}{totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Search */}
      <div className="payments-search-wrap">
        <span className="material-symbols-outlined payments-search-icon">search</span>
        <input
          className="payments-search-input"
          type="text"
          placeholder="Search by tenant, property, month…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="payments-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="lease-filter-bar">
        <div className="filter-tabs">
          {(['All', 'Paid', 'Pending'] as FilterTab[]).map(tab => (
            <button key={tab} className={`filter-tab ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>{tab}</button>
          ))}
        </div>
        <span className="label-small opacity-50">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Loading payments…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>
          {search ? `No results for "${search}"` : `No ${filter !== 'All' ? filter.toLowerCase() + ' ' : ''}payments found.`}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="leases-table-wrap payments-desktop-table">
            <table className="leases-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property / Hostel</th>
                  <th>Month For</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="tenant-cell">
                        <div className="tenant-avatar">{initials(p.tenant_name || '?')}</div>
                        <div className="tenant-name">{p.tenant_name || '—'}</div>
                      </div>
                    </td>
                    <td>
                      <div className="location-name" style={{ fontSize: '0.875rem' }}>{locationLabel(p)}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.month_for}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>{fmt(p.payment_date)}</td>
                    <td className="rent-amount">{currencySymbol}{Number(p.amount).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8rem' }}>{p.payment_method || '—'}</td>
                    <td>
                      <span className={`status-badge payment-status-${p.status.toLowerCase()}`}>{p.status}</span>
                    </td>
                    <td>
                      {!isStaff && (
                        <div className="row-actions">
                          {p.status === 'Pending' && (
                            <button className="log-payment-btn" title="Mark as Paid" onClick={() => openLogPayment(p)}>
                              <span className="material-symbols-outlined">payments</span>
                              Mark as Paid
                            </button>
                          )}
                          <button className="icon-action-btn" title="Edit" onClick={() => openEdit(p)}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(p.id)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="payment-cards-list payments-mobile-cards">
            {filtered.map(p => (
              <div key={p.id} className="payment-mobile-card">
                {/* Card Header: avatar + name + status */}
                <div className="payment-card-header">
                  <div className="tenant-cell">
                    <div className="tenant-avatar">{initials(p.tenant_name || '?')}</div>
                    <div>
                      <div className="tenant-name">{p.tenant_name || '—'}</div>
                      <div className="payment-card-location">{locationLabel(p)}</div>
                    </div>
                  </div>
                  <span className={`status-badge payment-status-${p.status.toLowerCase()}`}>{p.status}</span>
                </div>

                {/* Card Body: month, amount, date, method */}
                <div className="payment-card-body">
                  <div className="payment-card-row">
                    <div className="payment-card-field">
                      <span className="payment-card-label">Month</span>
                      <span className="payment-card-value">{p.month_for}</span>
                    </div>
                    <div className="payment-card-field">
                      <span className="payment-card-label">Amount</span>
                      <span className="payment-card-value payment-card-amount">{currencySymbol}{Number(p.amount).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="payment-card-row">
                    <div className="payment-card-field">
                      <span className="payment-card-label">Date</span>
                      <span className="payment-card-value">{fmt(p.payment_date)}</span>
                    </div>
                    <div className="payment-card-field">
                      <span className="payment-card-label">Method</span>
                      <span className="payment-card-value">{p.payment_method || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: actions */}
                {!isStaff && (
                  <div className="payment-card-footer">
                    {p.status === 'Pending' && (
                      <button className="log-payment-btn payment-card-mark-paid" onClick={() => openLogPayment(p)}>
                        <span className="material-symbols-outlined">payments</span>
                        Mark as Paid
                      </button>
                    )}
                    <div className="payment-card-icon-actions">
                      <button className="icon-action-btn" title="Edit" onClick={() => openEdit(p)}>
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(p.id)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal ── */}
      {showModal && editingPayment && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="lease-modal" style={{ maxWidth: '480px' }}>
            <div className="lease-modal-header">
              <div>
                <h2>{modalMode === 'log' ? 'Log Payment' : 'Edit Payment'}</h2>
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
                  {editingPayment.tenant_name} · {locationLabel(editingPayment)} · {editingPayment.month_for}
                </p>
              </div>
              <button className="icon-action-btn" onClick={closeModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="lease-modal-body">

                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Amount Paid ({currencySymbol}) *</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      min={0} step="0.01"
                    />
                    {modalMode === 'log' && (() => {
                      const paid = parseFloat(form.amount) || 0;
                      const remainder = Math.round((editingPayment.amount - paid) * 100) / 100;
                      if (remainder > 0 && paid > 0) return (
                        <span className="payment-partial-hint">
                          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>info</span>
                          {currencySymbol}{remainder.toLocaleString()} remaining — a new pending payment will be created
                        </span>
                      );
                      return null;
                    })()}
                  </div>
                  <div className="form-group">
                    <label>Payment Date *</label>
                    <input type="date" className="form-input" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                  </div>
                </div>

                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Payment Method</label>
                    <CustomSelect options={methodOptions} value={form.payment_method} onChange={v => setForm(f => ({ ...f, payment_method: v }))} />
                  </div>
                  {modalMode === 'edit' && (
                    <div className="form-group">
                      <label>Status *</label>
                      <CustomSelect options={statusOptions} value={form.status} onChange={v => setForm(f => ({ ...f, status: v as 'Paid' | 'Pending' }))} />
                    </div>
                  )}
                </div>

                {modalMode === 'edit' && (
                  <div className="form-group">
                    <label>Month For</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. March 2026"
                      value={form.month_for}
                      onChange={e => setForm(f => ({ ...f, month_for: e.target.value }))}
                    />
                  </div>
                )}

              </div>

              <div className="lease-modal-footer">
                <button type="button" className="primary-button glass" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving…' : modalMode === 'log' ? 'Mark as Paid' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
