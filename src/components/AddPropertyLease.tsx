import React, { useState } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ── Types ──────────────────────────────────────────────────────────────
interface Tenant { id: string; full_name: string; email: string; phone: string; }
interface Property { id: string; name: string; }
interface Unit { id: string; unit_number: string; price: number; status: string; property_id: string; }

const EMPTY_FORM = {
  tenant_id: '',
  property_id: '',
  unit_id: '',
  rent_amount: '',
  first_month_rent: '',
  security_deposit: '',
  start_date: '',
  end_date: '',
  notes: '',
};

// ── Component ───────────────────────────────────────────────────────────
const AddPropertyLease: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  // ── Currency ────────────────────────────────────────────────────────
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const sym = SYMBOLS[ownerProfile?.currency] || '₹';

  // ── Lookup Queries ───────────────────────────────────────────────────
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!ownerId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
    },
    enabled: !!ownerId,
  });

  const { data: allUnits = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['all-units', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
    },
    enabled: !!ownerId,
  });

  // Derived filtered units
  const units = React.useMemo(() => {
    if (!form.property_id) return [];
    return allUnits.filter(u => u.property_id === form.property_id && u.status === 'Vacant');
  }, [allUnits, form.property_id]);

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_id || !form.start_date || !form.rent_amount) return;
    if (!form.unit_id) { showAlert('Please select a unit.'); return; }

    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === form.tenant_id);
      const unit   = units.find(u => u.id === form.unit_id);
      const property = properties.find(p => p.id === form.property_id);
      const batch  = writeBatch(db);

      const payload: Record<string, unknown> = {
        owner_id:         ownerId,
        tenant_id:        form.tenant_id,
        tenant_name:      tenant?.full_name || '',
        rent_amount:      parseFloat(form.rent_amount),
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        start_date:       form.start_date,
        end_date:         form.end_date || null,
        status:           'Active',
        notes:            form.notes || null,
        created_at:       serverTimestamp(),
        updated_at:       serverTimestamp(),
        unit_id:     form.unit_id,
        unit_number: unit?.unit_number || '',
        property_id:   form.property_id,
        property_name: property?.name || '',
        // Nullify hostel fields to maintain common schema if needed, but primary focus is property fields
        bed_id: null, bed_number: null, room_number: null, hostel_id: null, hostel_name: null,
      };

      const newLeaseRef = doc(collection(db, 'property_leases'));
      batch.set(newLeaseRef, payload);
      batch.update(doc(db, 'units', form.unit_id), { status: 'Occupied' });

      const firstRent  = form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount);
      const depositAmt = form.security_deposit  ? parseFloat(form.security_deposit) : 0;
      const totalDue   = firstRent + depositAmt;
      const startDate  = new Date(form.start_date);
      const baseLabel  = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthFor   = depositAmt > 0 ? `${baseLabel} + Deposit` : baseLabel;

      const newPaymentRef = doc(collection(db, 'payments'));
      batch.set(newPaymentRef, {
        owner_id:       ownerId,
        tenant_name:    payload.tenant_name,
        unit_number:    payload.unit_number,
        property_id:    payload.property_id,
        property_name:  payload.property_name,
        bed_number:     null,
        room_number:    null,
        hostel_id:      null,
        hostel_name:    null,
        rent_amount:    totalDue,
        amount:         0,
        payment_date:   form.start_date,
        month_for:      monthFor,
        payment_method: null,
        status:         'Pending',
        created_at:     serverTimestamp(),
      });

      const invoiceRef = doc(db, 'invoices', newPaymentRef.id);
      batch.set(invoiceRef, {
        owner_id: ownerId,
        lease_id: newLeaseRef.id,
        tenant_name: payload.tenant_name,
        property_id: payload.property_id,
        property_name: payload.property_name,
        month_for: monthFor,
        amount: totalDue,
        due_date: form.start_date,
        status: 'Pending',
        legacy_payment_id: newPaymentRef.id,
        created_at: serverTimestamp(),
      });

      const invJeRef = doc(collection(db, 'journal_entries'));
      batch.set(invJeRef, {
        owner_id: ownerId,
        date: form.start_date,
        description: `Initial Rent Billed - ${payload.tenant_name}`,
        reference_type: 'Invoice',
        reference_id: invoiceRef.id,
        debit_account_code: '1200',
        credit_account_code: '4000',
        amount: totalDue,
        created_at: serverTimestamp(),
      });

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['property-leases', ownerId] });
      queryClient.invalidateQueries({ queryKey: ['property'] });
      queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
      navigate('/property-leases');
    } catch (err) {
      showAlert((err as Error).message);
      setSaving(false);
    }
  };

  const sectionDivider = (label: string) => (
    <div className="view-eyebrow" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--outline-variant)', marginBottom: '2rem', marginTop: '1.5rem', opacity: 0.4 }}>
      {label}
    </div>
  );

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '900px' }}>
      {DialogMount}

      <header className="view-header">
        <button 
          onClick={() => navigate(-1)} 
          className="view-eyebrow flex items-center gap-2 hover:text-on-surface transition-colors mb-10"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>arrow_back</span>
          Back to Property Agreements
        </button>
        <h1 className="view-title text-4xl md:text-6xl">Establish Property Lease</h1>
        <p className="text-on-surface-variant mt-4 font-medium opacity-70">Initialize a new property rental agreement including unit allocation and financial terms.</p>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit}>

          {/* ── Tenant ── */}
          {sectionDivider('Legal Entity')}
          <div className="form-group-modern">
            <label>Select Tenant *</label>
            <select
              required
              value={form.tenant_id}
              onChange={e => set('tenant_id', e.target.value)}
              style={{ fontWeight: 600 }}
            >
              <option value="">— choose from registry —</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}{t.phone ? ` · ${t.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* ── Inventory ── */}
          {sectionDivider('Asset Allocation')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group-modern">
              <label>Property *</label>
              <select
                required
                value={form.property_id}
                onChange={e => { set('property_id', e.target.value); set('unit_id', ''); set('rent_amount', ''); }}
              >
                <option value="">— choose property —</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group-modern">
              <label>Unit *</label>
              <select
                required
                value={form.unit_id}
                disabled={!form.property_id || unitsLoading}
                onChange={e => {
                  const u = units.find(u => u.id === e.target.value);
                  set('unit_id', e.target.value);
                  if (u?.price) set('rent_amount', String(u.price));
                }}
              >
                <option value="">
                  {unitsLoading ? 'Loading available units...' : (form.property_id ? '— choose unit —' : 'Select property')}
                </option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number}{u.price ? ` — ${sym}${u.price.toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Financials ── */}
          {sectionDivider('Contractual Value')}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="form-group-modern">
              <label>Monthly Rent ({sym}) *</label>
              <input
                type="number" step="0.01" min="0" placeholder="0.00" required
                value={form.rent_amount}
                onChange={e => set('rent_amount', e.target.value)}
                style={{ fontWeight: 700 }}
              />
            </div>
            <div className="form-group-modern">
              <label>First Month Rent ({sym})</label>
              <input
                type="number" step="0.01" min="0" placeholder="Monthly rent"
                value={form.first_month_rent}
                onChange={e => set('first_month_rent', e.target.value)}
              />
            </div>
            <div className="form-group-modern">
              <label>Security Deposit ({sym})</label>
              <input
                type="number" step="0.01" min="0" placeholder="0.00"
                value={form.security_deposit}
                onChange={e => set('security_deposit', e.target.value)}
              />
            </div>
          </div>

          {form.rent_amount && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4 mt-2">
              <span className="material-symbols-outlined text-primary">payments</span>
              <div className="text-sm font-medium">
                <span className="opacity-60">Initial Capital Commitment: </span>
                <span className="font-bold text-on-surface">
                  {sym}{(
                    (form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount)) +
                    (form.security_deposit  ? parseFloat(form.security_deposit) : 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* ── Duration ── */}
          {sectionDivider('Agreement Timeline')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group-modern">
              <label>Commencement Date *</label>
              <input
                type="date" required
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>
            <div className="form-group-modern">
              <label>Expiry Date (Optional)</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* ── Notes ── */}
          {sectionDivider('Executive Remarks')}
          <div className="form-group-modern">
            <label>Contractual Stipulations</label>
            <textarea
              placeholder="Any special clauses or remarks regarding this agreement..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{ resize: 'none', lineHeight: 1.6 }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-12 pt-8 border-t border-white/5">
            <button 
              type="button" 
              className="primary-button flex-1" 
              onClick={() => navigate(-1)}
              style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
            >
              Discard
            </button>
            <button 
              type="submit" 
              className="primary-button flex-[2]" 
              disabled={saving}
            >
              <span className="font-black text-xs uppercase tracking-widest">
                {saving ? 'Synchronizing...' : 'Finalize Agreement'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyLease;
