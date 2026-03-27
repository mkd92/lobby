import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import '../styles/Units.css';
import '../styles/Leases.css';
import '../styles/Payments.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Payment {
  id: string;
  lease_id: string;
  amount: number;
  payment_date: string;
  month_for: string;
  payment_method: string | null;
  status: 'Paid' | 'Pending';
  leases: {
    rent_amount: number;
    tenants: { full_name: string };
    units: { unit_number: string; properties: { name: string } } | null;
    beds: { bed_number: string; rooms: { room_number: string; hostels: { name: string } } } | null;
  };
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="custom-select-container" ref={ref}>
      <div
        className={`custom-select-trigger ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => {
          if (e.key === ' ') { e.preventDefault(); !disabled && setOpen(o => !o); }
          if (e.key === 'Enter') { if (open) { e.preventDefault(); setOpen(false); } }
          if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
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
        <div className="custom-options">
          {options.length === 0
            ? <div className="custom-option-empty">No options available</div>
            : options.map(opt => (
              <div key={opt.value} className={`custom-option ${value === opt.value ? 'selected' : ''}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
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
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterTab>('All');
  const [search, setSearch]       = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

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

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

      // RPC must run before SELECT so generated payments are included
      await supabase.rpc('generate_monthly_rent_payments');

      const [paymentsRes, ownerRes] = await Promise.all([
        supabase.from('payments').select(`*, leases (rent_amount, tenants (full_name), units (unit_number, properties (name)), beds (bed_number, rooms (room_number, hostels (name))))`).order('payment_date', { ascending: false }),
        ownerId ? supabase.from('owners').select('currency').eq('id', ownerId).single() : Promise.resolve(null),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      setPayments((paymentsRes.data as unknown as Payment[]) || []);
      if (ownerRes?.data) setCurrencySymbol(symbols[ownerRes.data.currency || 'USD'] || '$');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

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
        const { error } = await supabase.from('payments').update({
          amount:         paidAmount,
          payment_date:   form.payment_date,
          payment_method: form.payment_method || null,
          status:         'Paid',
        }).eq('id', editingPayment.id);
        if (error) throw error;

        // If partial, create a new Pending for the remainder
        if (remainder > 0) {
          const { error: err2 } = await supabase.from('payments').insert({
            lease_id:     editingPayment.lease_id,
            amount:       remainder,
            payment_date: editingPayment.payment_date,
            month_for:    editingPayment.month_for,
            status:       'Pending',
          });
          if (err2) throw err2;
        }
      } else {
        const { error } = await supabase.from('payments').update({
          amount:         paidAmount,
          payment_date:   form.payment_date,
          month_for:      form.month_for,
          payment_method: form.payment_method || null,
          status:         form.status,
        }).eq('id', editingPayment.id);
        if (error) throw error;
      }

      closeModal();
      fetchPayments();
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
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) return showAlert(error.message);
    fetchPayments();
  };

  // ── Derived ────────────────────────────────────────────────────────
  const totalCollected = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const totalPending   = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);

  const fmt      = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const locationLabel = (p: Payment) => {
    if (p.leases?.units) return `${p.leases.units.properties?.name} · Unit ${p.leases.units.unit_number}`;
    if (p.leases?.beds)  return `${p.leases.beds.rooms?.hostels?.name} · ${p.leases.beds.bed_number}`;
    return '—';
  };

  const filtered = payments
    .filter(p => filter === 'All' || p.status === filter)
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.leases?.tenants?.full_name?.toLowerCase().includes(q) ||
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

      {loading ? (
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
                        <div className="tenant-avatar">{initials(p.leases?.tenants?.full_name || '?')}</div>
                        <div className="tenant-name">{p.leases?.tenants?.full_name || '—'}</div>
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
                    <div className="tenant-avatar">{initials(p.leases?.tenants?.full_name || '?')}</div>
                    <div>
                      <div className="tenant-name">{p.leases?.tenants?.full_name || '—'}</div>
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
                  {editingPayment.leases?.tenants?.full_name} · {locationLabel(editingPayment)} · {editingPayment.month_for}
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
