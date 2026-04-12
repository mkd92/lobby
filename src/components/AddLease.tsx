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
interface Hostel { id: string; name: string; }
interface Room   { id: string; room_number: string; hostel_id: string; }
interface Bed    { id: string; bed_number: string; price: number; status: string; room_id: string; hostel_id: string; }

const EMPTY_FORM = {
  tenant_id: '',
  unit_id: '',   // hostel id
  bed_id: '',
  rent_amount: '',
  first_month_rent: '',
  security_deposit: '',
  start_date: '',
  end_date: '',
  notes: '',
};

// ── Component ───────────────────────────────────────────────────────────
const AddLease: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [roomId, setRoomId] = useState('');

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

  const { data: hostels = [] } = useQuery({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel));
    },
    enabled: !!ownerId,
  });

  // Fetch all inventory for the owner and filter client-side to avoid index issues
  const { data: allRooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['all-rooms', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: !!ownerId,
  });

  const { data: allBeds = [], isLoading: bedsLoading } = useQuery({
    queryKey: ['all-beds', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: !!ownerId,
  });

  // Derived filtered state
  const rooms = React.useMemo(() => {
    if (!form.unit_id) return [];
    const hostelBeds = allBeds.filter(b => b.hostel_id === form.unit_id && b.status === 'Vacant');
    const vacantRoomIds = [...new Set(hostelBeds.map(b => b.room_id))];
    return allRooms.filter(r => r.hostel_id === form.unit_id && vacantRoomIds.includes(r.id));
  }, [allRooms, allBeds, form.unit_id]);

  const beds = React.useMemo(() => {
    if (!roomId) return [];
    return allBeds.filter(b => b.room_id === roomId && b.status === 'Vacant');
  }, [allBeds, roomId]);

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_id || !form.start_date || !form.rent_amount) return;
    if (!form.bed_id) { showAlert('Please select a bed.'); return; }

    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === form.tenant_id);
      const bed    = beds.find(b => b.id === form.bed_id);
      const room   = rooms.find(r => r.id === roomId);
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
        bed_id:      form.bed_id,
        bed_number:  bed?.bed_number || '',
        room_number: room?.room_number || '',
        hostel_id:   form.unit_id,
        hostel_name: hostels.find(h => h.id === form.unit_id)?.name || '',
        unit_id: null, unit_number: null, property_name: null,
      };

      const newLeaseRef = doc(collection(db, 'leases'));
      batch.set(newLeaseRef, payload);
      batch.update(doc(db, 'beds', form.bed_id), { status: 'Occupied' });

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
        bed_number:     payload.bed_number,
        room_number:    payload.room_number,
        hostel_id:      payload.hostel_id,
        hostel_name:    payload.hostel_name,
        unit_number:    null,
        property_name:  null,
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
        hostel_id: payload.hostel_id,
        hostel_name: payload.hostel_name,
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
      queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });
      navigate('/leases');
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
          Back to Agreement Vault
        </button>
        <h1 className="view-title text-4xl md:text-6xl">Establish Agreement</h1>
        <p className="text-on-surface-variant mt-4 font-medium opacity-70">Initialize a new contractual relationship including unit allocation and financial terms.</p>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit}>

          {/* ── Tenant ── */}
          {sectionDivider('Legal Entity')}
          <div className="form-group-modern">
            <label>Select Stakeholder *</label>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="form-group-modern">
              <label>Hostel Facility *</label>
              <select
                required
                value={form.unit_id}
                onChange={e => { set('unit_id', e.target.value); set('bed_id', ''); set('rent_amount', ''); setRoomId(''); }}
              >
                <option value="">— choose facility —</option>
                {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="form-group-modern">
              <label>Internal ID (Room) *</label>
              <select
                required
                value={roomId}
                disabled={!form.unit_id || roomsLoading || bedsLoading}
                onChange={e => { setRoomId(e.target.value); set('bed_id', ''); }}
              >
                <option value="">
                  {roomsLoading || bedsLoading ? 'Loading available inventory...' : (form.unit_id ? '— choose room —' : 'Select facility')}
                </option>
                {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </div>
            <div className="form-group-modern">
              <label>Inventory Unit (Bed) *</label>
              <select
                required
                value={form.bed_id}
                disabled={!roomId}
                onChange={e => {
                  const b = beds.find(b => b.id === e.target.value);
                  set('bed_id', e.target.value);
                  if (b?.price) set('rent_amount', String(b.price));
                }}
              >
                <option value="">
                  {roomId ? '— choose bed —' : 'Select room'}
                </option>
                {beds.map(b => (
                  <option key={b.id} value={b.id}>
                    Bed {b.bed_number}{b.price ? ` — ${sym}${b.price.toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Financials ── */}
          {sectionDivider('Contractual Value')}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="form-group-modern">
              <label>Monthly Yield ({sym}) *</label>
              <input
                type="number" step="0.01" min="0" placeholder="0.00" required
                value={form.rent_amount}
                onChange={e => set('rent_amount', e.target.value)}
                style={{ fontWeight: 700 }}
              />
            </div>
            <div className="form-group-modern">
              <label>Initial Term ({sym})</label>
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
              <label>Maturity Date (Optional)</label>
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

export default AddLease;
