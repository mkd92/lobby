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
import '../styles/Leases.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Tenant { id: string; full_name: string; email: string; phone: string; }
interface Hostel { id: string; name: string; }
interface Room   { id: string; room_number: string; }
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

  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', form.unit_id],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', form.unit_id)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: !!form.unit_id,
  });

  const { data: vacantRoomIds = [] } = useQuery({
    queryKey: ['vacant-room-ids', form.unit_id],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'beds'),
        where('hostel_id', '==', form.unit_id),
        where('status', '==', 'Vacant'),
      ));
      return [...new Set(snap.docs.map(d => d.data().room_id as string))];
    },
    enabled: !!form.unit_id,
  });

  const rooms = allRooms.filter(r => vacantRoomIds.includes(r.id));

  const { data: beds = [] } = useQuery({
    queryKey: ['beds-vacant', roomId],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'beds'),
        where('room_id', '==', roomId),
        where('status', '==', 'Vacant'),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: !!roomId,
  });

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
        // Hostel fields
        bed_id:      form.bed_id,
        bed_number:  bed?.bed_number || '',
        room_number: room?.room_number || '',
        hostel_id:   form.unit_id,
        hostel_name: hostels.find(h => h.id === form.unit_id)?.name || '',
        // Null out property fields
        unit_id: null, unit_number: null, property_name: null,
      };

      batch.set(doc(collection(db, 'leases')), payload);
      batch.update(doc(db, 'beds', form.bed_id), { status: 'Occupied' });

      // Move-in pending payment
      const firstRent  = form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount);
      const depositAmt = form.security_deposit  ? parseFloat(form.security_deposit) : 0;
      const totalDue   = firstRent + depositAmt;
      const startDate  = new Date(form.start_date);
      const baseLabel  = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthFor   = depositAmt > 0 ? `${baseLabel} + Deposit` : baseLabel;

      batch.set(doc(collection(db, 'payments')), {
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

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });
      navigate('/leases');
    } catch (err) {
      showAlert((err as Error).message);
      setSaving(false);
    }
  };

  const SelectWrap: React.FC<{ children: React.ReactNode; disabled?: boolean }> = ({ children, disabled }) => (
    <div style={{ position: 'relative', opacity: disabled ? 0.45 : 1 }}>
      {children}
      <span
        className="material-symbols-outlined"
        style={{
          position: 'absolute', right: '1.125rem', top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none',
          fontSize: '1.25rem', color: 'var(--on-surface-variant)', opacity: 0.55,
        }}
      >
        keyboard_arrow_down
      </span>
    </div>
  );

  const sectionDivider = (label: string) => (
    <div style={{
      fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.16em', color: 'var(--on-surface-variant)', opacity: 0.5,
      paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
      marginBottom: '1.5rem', marginTop: '1rem',
    }}>
      {label}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {DialogMount}

      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back
          </div>
          <h1 className="view-title">New Agreement</h1>
          <p className="text-on-surface-variant mt-2">Set up a new lease — tenant, bed, financials and dates.</p>
        </div>
      </header>

      <div className="modern-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} className="modal-form-modern" style={{ padding: 0 }}>

          {/* ── Tenant ── */}
          <div>
            {sectionDivider('Tenant')}
            <div className="form-group-modern">
              <label>Select Tenant *</label>
              <SelectWrap>
                <select
                  required
                  value={form.tenant_id}
                  onChange={e => set('tenant_id', e.target.value)}
                  style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.75rem' }}
                >
                  <option value="">— choose tenant —</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}{t.phone ? ` · ${t.phone}` : ''}</option>
                  ))}
                </select>
              </SelectWrap>
            </div>
          </div>

          {/* ── Hostel · Room · Bed ── */}
          <div>
            {sectionDivider('Hostel · Room · Bed')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group-modern">
                <label>Hostel *</label>
                <SelectWrap>
                  <select
                    required
                    value={form.unit_id}
                    onChange={e => { set('unit_id', e.target.value); set('bed_id', ''); set('rent_amount', ''); setRoomId(''); }}
                    style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.75rem' }}
                  >
                    <option value="">— choose hostel —</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </SelectWrap>
              </div>
              <div className="form-group-modern">
                <label>Room (vacant beds) *</label>
                <SelectWrap disabled={!form.unit_id}>
                  <select
                    required
                    value={roomId}
                    disabled={!form.unit_id}
                    onChange={e => { setRoomId(e.target.value); set('bed_id', ''); }}
                    style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.75rem' }}
                  >
                    <option value="">{form.unit_id ? '— choose room —' : 'Select hostel first'}</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                  </select>
                </SelectWrap>
              </div>
              <div className="form-group-modern">
                <label>Vacant Bed *</label>
                <SelectWrap disabled={!roomId}>
                  <select
                    required
                    value={form.bed_id}
                    disabled={!roomId}
                    onChange={e => {
                      const b = beds.find(b => b.id === e.target.value);
                      set('bed_id', e.target.value);
                      if (b?.price) set('rent_amount', String(b.price));
                    }}
                    style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.75rem' }}
                  >
                    <option value="">{roomId ? '— choose bed —' : 'Select room first'}</option>
                    {beds.map(b => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bed_number}{b.price ? ` — ${sym}${b.price.toLocaleString()}/mo` : ''}
                      </option>
                    ))}
                  </select>
                </SelectWrap>
              </div>
            </div>
          </div>

          {/* ── Financials ── */}
          <div>
            {sectionDivider('Financial Terms')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group-modern">
                <label>Monthly Rent ({sym}) *</label>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00" required
                  value={form.rent_amount}
                  onChange={e => set('rent_amount', e.target.value)}
                />
              </div>
              <div className="form-group-modern">
                <label>First Month ({sym})</label>
                <input
                  type="number" step="0.01" min="0" placeholder="same as monthly"
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
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(var(--primary-rgb, 100,180,120), 0.08)', borderRadius: '0.875rem', fontSize: '0.8125rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>payments</span>
                Move-in amount pending: <strong style={{ color: 'var(--on-surface)', marginLeft: '0.25rem', fontSize: '0.9375rem' }}>
                  {sym}{(
                    (form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount)) +
                    (form.security_deposit  ? parseFloat(form.security_deposit) : 0)
                  ).toLocaleString()}
                </strong>
              </div>
            )}
          </div>

          {/* ── Dates ── */}
          <div>
            {sectionDivider('Contract Duration')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group-modern">
                <label>Start Date *</label>
                <input
                  type="date" required
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                />
              </div>
              <div className="form-group-modern">
                <label>End Date <span style={{ opacity: 0.45, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(leave blank for rolling)</span></label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            {sectionDivider('Notes')}
            <div className="form-group-modern">
              <label>Special Terms <span style={{ opacity: 0.45, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
              <textarea
                placeholder="Any special conditions, clauses, or remarks..."
                rows={3}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="modal-footer-modern" style={{ padding: '2rem 0 0', marginTop: '1rem' }}>
            <button type="button" className="modal-discard-btn" onClick={() => navigate(-1)}>Discard</button>
            <button type="submit" className="primary-button flex-1" disabled={saving}>{saving ? 'Creating...' : 'Confirm Agreement'}</button>
          </footer>

        </form>
      </div>
    </div>
  );
};

export default AddLease;
