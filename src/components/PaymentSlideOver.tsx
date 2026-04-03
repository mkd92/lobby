import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, updateDoc, addDoc, collection, getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQueryClient } from '@tanstack/react-query';

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

interface Transaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  cumulative_total: number;
  recorded_at: any;
}

interface Props {
  id: string;
  currencySymbol: string;
  onClose: () => void;
  onUpdated: () => void;
}

const PaymentSlideOver: React.FC<Props> = ({ id, currencySymbol, onClose, onUpdated }) => {
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    amount: '',
    payment_date: '',
    payment_method: 'Cash',
    status: 'Paid' as Payment['status'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, 'payments', id));
      if (!snap.exists()) { setLoading(false); return; }
      const data = { id: snap.id, ...snap.data() } as Payment;
      setPayment(data);
      setForm({
        amount: String(data.amount),
        payment_date: data.payment_date || '',
        payment_method: data.payment_method || 'Cash',
        status: data.status,
      });
      try {
        const txSnap = await getDocs(query(
          collection(db, 'payments', id, 'transactions'),
          orderBy('recorded_at', 'asc')
        ));
        setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      } catch {
        // transactions subcollection may not exist yet — that's fine
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || isStaff) return;
    setSaving(true);
    setError('');
    try {
      if (form.payment_date) localStorage.setItem('lastPaymentDate', form.payment_date);
      await updateDoc(doc(db, 'payments', id), {
        amount: parseFloat(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        status: form.status,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['payments', ownerId] });
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = () => {
    if (!payment) return;
    const isHostel = !!payment.bed_number;
    const propName = payment.property_name || payment.hostel_name || '';
    const unitLabel = isHostel
      ? `Room ${payment.room_number} · Bed ${payment.bed_number}`
      : `Unit ${payment.unit_number}`;
    const paidColor = payment.status === 'Paid' ? '#16a34a' : payment.status === 'Partial' ? '#d97706' : '#b45309';
    const paidBg   = payment.status === 'Paid' ? '#dcfce7' : payment.status === 'Partial' ? '#fef3c7' : '#fef9c3';
    const txRows = transactions.map(tx =>
      `<tr><td>${tx.payment_date ? new Date(tx.payment_date + 'T00:00:00').toLocaleDateString() : '—'}</td><td>${tx.payment_method}</td><td style="text-align:right;font-weight:700">${currencySymbol}${tx.amount.toLocaleString()}</td></tr>`
    ).join('');

    const w = window.open('', '_blank', 'width=520,height=760');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${payment.tenant_name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;padding:2.5rem;color:#111;background:#fff;font-size:14px}
  h1{font-size:1.5rem;font-weight:900;letter-spacing:-0.02em}
  .sub{font-size:0.7rem;color:#999;margin-top:0.2rem}
  .divider{border:none;border-top:2px solid #111;margin:1.25rem 0}
  .thin{border:none;border-top:1px solid #eee;margin:1rem 0}
  .row{display:flex;justify-content:space-between;gap:1rem;margin-bottom:0.75rem;align-items:flex-start}
  .lbl{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:#999;font-weight:700;margin-bottom:0.2rem}
  .val{font-size:0.9375rem;font-weight:600}
  .badge{display:inline-block;padding:0.2rem 0.75rem;border-radius:99px;font-size:0.625rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;background:${paidBg};color:${paidColor}}
  .amount-big{font-size:2rem;font-weight:900;letter-spacing:-0.03em}
  table{width:100%;border-collapse:collapse;font-size:0.8125rem}
  th{text-align:left;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:#999;font-weight:700;padding-bottom:0.5rem;border-bottom:1px solid #eee}
  td{padding:0.5rem 0;border-bottom:1px solid #f5f5f5}
  .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #eee;text-align:center;font-size:0.65rem;color:#bbb}
  @media print{body{padding:1rem}}
</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem">
  <div><h1>PAYMENT RECEIPT</h1><div class="sub">No. ${payment.id.slice(0,12).toUpperCase()}</div><div class="sub">Issued ${new Date().toLocaleDateString()}</div></div>
  <span class="badge">${payment.status}</span>
</div>
<hr class="divider">
<div class="row"><div><div class="lbl">Tenant</div><div class="val">${payment.tenant_name}</div></div></div>
<div class="row">
  <div><div class="lbl">Property</div><div class="val">${propName}</div></div>
  <div style="text-align:right"><div class="lbl">Unit</div><div class="val">${unitLabel}</div></div>
</div>
<div class="row">
  <div><div class="lbl">Billing Period</div><div class="val">${payment.month_for}</div></div>
  <div style="text-align:right"><div class="lbl">Payment Date</div><div class="val">${payment.payment_date ? new Date(payment.payment_date + 'T00:00:00').toLocaleDateString() : 'Pending'}</div></div>
</div>
<div class="row"><div><div class="lbl">Payment Method</div><div class="val">${payment.payment_method || '—'}</div></div></div>
<hr class="divider">
<div class="row" style="align-items:center">
  <div><div class="lbl">Amount Received</div><div class="amount-big">${currencySymbol}${payment.amount.toLocaleString()}</div></div>
  <div style="text-align:right"><div class="lbl">Contracted Rent</div><div class="val">${currencySymbol}${payment.rent_amount.toLocaleString()}</div></div>
</div>
${payment.status === 'Partial' ? `<div class="row"><div><div class="lbl">Balance Due</div><div class="val" style="color:#d97706;font-size:1.125rem;font-weight:800">${currencySymbol}${(payment.rent_amount - payment.amount).toLocaleString()}</div></div></div>` : ''}
${txRows ? `<hr class="thin"><div class="lbl" style="margin-bottom:0.75rem">Payment History</div><table><thead><tr><th>Date</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead><tbody>${txRows}</tbody></table>` : ''}
<div class="footer">This is a computer-generated receipt and does not require a signature.</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em',
    fontWeight: 800, opacity: 0.4, display: 'block', marginBottom: '0.5rem',
  };
  const inputStyle: React.CSSProperties = {
    borderRadius: '1rem', padding: '0.75rem 1rem', fontWeight: 600,
    background: 'var(--surface-container-low)', border: 'none', width: '100%',
    boxSizing: 'border-box', color: 'var(--on-surface)', fontSize: '0.9375rem',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 499 }}
      />

      {/* Panel */}
      <div className="payment-slideover custom-scrollbar" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(540px, 100vw)', zIndex: 500,
        overflowY: 'auto', background: 'var(--surface-container-lowest)',
        borderLeft: '1px solid var(--outline-variant)',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.28s cubic-bezier(0.4,0,0.2,1)',
        padding: '0 0 6rem',
      }}>

        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--surface-container-lowest)',
          borderBottom: '1px solid var(--outline-variant)',
          padding: '1.25rem 1.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div>
            <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.4, marginBottom: '0.2rem' }}>Payment Detail</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.25rem', margin: 0 }}>
              {loading ? '...' : payment?.tenant_name}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {payment && (
              <button
                onClick={printReceipt}
                title="Print Receipt"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>receipt</span>
                Receipt
              </button>
            )}
            <button onClick={onClose} className="btn-icon" style={{ color: 'var(--on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>close</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>hourglass_empty</span>
          </div>
        ) : !payment ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>Record not found</div>
        ) : (
          <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Info card */}
            <div style={{ background: 'var(--surface-container-low)', borderRadius: '1.5rem', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600 }}>{payment.property_name || payment.hostel_name}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.15rem' }}>
                    {payment.bed_number ? `Room ${payment.room_number} · Bed ${payment.bed_number}` : `Unit ${payment.unit_number}`}
                  </div>
                </div>
                <span className={`badge-modern ${payment.status === 'Paid' ? 'badge-success' : payment.status === 'Partial' ? 'badge-partial' : 'badge-warning'}`}>
                  {payment.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--outline-variant)', paddingTop: '0.875rem' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800, opacity: 0.4, letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Period</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{payment.month_for}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800, opacity: 0.4, letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Received / Rent</div>
                  <div style={{ fontWeight: 900, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
                    {currencySymbol}{payment.amount.toLocaleString()}
                    <span style={{ opacity: 0.4, fontWeight: 600 }}> / {currencySymbol}{payment.rent_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {payment.status === 'Partial' && (
                <div style={{ background: 'rgba(251,146,60,0.1)', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fb923c' }}>Balance Due</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#fb923c', fontFamily: 'var(--font-display)' }}>{currencySymbol}{(payment.rent_amount - payment.amount).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Edit form */}
            {!isStaff && (
              <div style={{ background: 'var(--surface-container-low)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', marginBottom: '1.25rem', opacity: 0.8 }}>Edit Record</h3>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    <div>
                      <label style={labelStyle}>Amount ({currencySymbol})</label>
                      <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Date</label>
                      <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} style={{ ...inputStyle, colorScheme: 'dark' }} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Channel</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem' }}>
                      {['Cash', 'Bank Transfer', 'Online', 'Check'].map(m => (
                        <button key={m} type="button" onClick={() => setForm({ ...form, payment_method: m })}
                          style={{ padding: '0.5rem 0.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: form.payment_method === m ? 'var(--primary)' : 'var(--surface-container)', color: form.payment_method === m ? 'var(--on-primary)' : 'var(--on-surface-variant)' }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {(['Paid', 'Partial', 'Pending'] as Payment['status'][]).map(s => (
                        <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: form.status === s ? 'var(--primary)' : 'var(--surface-container)', color: form.status === s ? 'var(--on-primary)' : 'var(--on-surface-variant)' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {error && <p style={{ fontSize: '0.75rem', color: 'var(--error)', fontWeight: 600 }}>{error}</p>}
                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {/* Transaction history */}
            {transactions.length > 0 && (
              <div style={{ background: 'var(--surface-container-low)', borderRadius: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', marginBottom: '1rem', opacity: 0.8 }}>Payment History</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {transactions.map((tx, i) => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '0.75rem', background: 'var(--surface-container)' }}>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                          {tx.payment_date ? new Date(tx.payment_date + 'T00:00:00').toLocaleDateString() : '—'}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 600 }}>{tx.payment_method}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem' }}>
                          {currencySymbol}{tx.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.4, fontWeight: 600 }}>
                          #{i + 1} · total {currencySymbol}{tx.cumulative_total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
};

export default PaymentSlideOver;
