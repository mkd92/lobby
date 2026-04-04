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
interface Tenant   { id: string; full_name: string; email: string; phone: string; }
interface Property { id: string; name: string; }
interface Unit     { id: string; unit_number: string; base_rent: number; status: string; property_id: string; }
interface Hostel   { id: string; name: string; }
interface Room     { id: string; room_number: string; }
interface Bed      { id: string; bed_number: string; price: number; status: string; room_id: string; hostel_id: string; }

type LeaseType = 'property' | 'hostel';

const EMPTY_FORM = {
  tenant_id: '',
  unit_id: '',
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

  const [leaseType, setLeaseType] = useState<LeaseType>('property');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Cascade state (not stored in lease doc)
  const [propertyId, setPropertyId] = useState('');
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

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
    },
    enabled: !!ownerId && leaseType === 'property',
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-vacant', propertyId],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'units'),
        where('property_id', '==', propertyId),
        where('status', '==', 'Vacant'),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
    },
    enabled: !!propertyId,
  });

  const { data: hostels = [] } = useQuery({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel));
    },
    enabled: !!ownerId && leaseType === 'hostel',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', form.unit_id],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', form.unit_id)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: !!form.unit_id && leaseType === 'hostel',
  });

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
    if (leaseType === 'property' && !form.unit_id) { showAlert('Please select a unit.'); return; }
    if (leaseType === 'hostel' && !form.bed_id) { showAlert('Please select a bed.'); return; }

    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === form.tenant_id);
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
      };

      if (leaseType === 'property') {
        const unit = units.find(u => u.id === form.unit_id);
        const prop = properties.find(p => p.id === unit?.property_id);
        Object.assign(payload, {
          unit_id:      form.unit_id,
          unit_number:  unit?.unit_number || '',
          property_name: prop?.name || '',
          bed_id: null, bed_number: null, room_number: null, hostel_name: null,
        });
        batch.update(doc(db, 'units', form.unit_id), { status: 'Occupied' });
      } else {
        const bed  = beds.find(b => b.id === form.bed_id);
        const room = rooms.find(r => r.id === roomId);
        Object.assign(payload, {
          bed_id:      form.bed_id,
          bed_number:  bed?.bed_number || '',
          room_number: room?.room_number || '',
          hostel_name: hostels.find(h => h.id === form.unit_id)?.name || '',
          unit_id: null, unit_number: null, property_name: null,
        });
        batch.update(doc(db, 'beds', form.bed_id), { status: 'Occupied' });
      }

      const leaseRef = doc(collection(db, 'leases'));
      batch.set(leaseRef, payload);

      // Move-in pending payment: first month + deposit
      const firstRent     = form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount);
      const depositAmt    = form.security_deposit  ? parseFloat(form.security_deposit) : 0;
      const totalDue      = firstRent + depositAmt;
      const startDate     = new Date(form.start_date);
      const baseLabel     = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthFor      = depositAmt > 0 ? `${baseLabel} + Deposit` : baseLabel;

      batch.set(doc(collection(db, 'payments')), {
        owner_id:      ownerId,
        lease_id:      leaseRef.id,
        tenant_name:   payload.tenant_name,
        unit_number:   payload.unit_number   ?? null,
        property_name: payload.property_name ?? null,
        bed_number:    payload.bed_number    ?? null,
        room_number:   payload.room_number   ?? null,
        hostel_name:   payload.hostel_name   ?? null,
        rent_amount:   totalDue,
        amount:        0,
        payment_date:  form.start_date,
        month_for:     monthFor,
        payment_method: null,
        status:        'Pending',
        created_at:    serverTimestamp(),
      });

      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });
      navigate('/leases');
    } catch (err) {
      showAlert((err as Error).message);
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const labelCls: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: 'var(--on-surface-variant)',
    marginBottom: '0.625rem', display: 'block', opacity: 0.6,
  };

  const inputCls: React.CSSProperties = {
    background: 'var(--surface-container-high)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '0.875rem 1.125rem',
    borderRadius: '0.875rem',
    fontFamily: 'var(--font-main)',
    fontSize: '0.9375rem',
    color: 'var(--on-surface)',
    width: '100%',
    outline: 'none',
    transition: 'background 0.2s',
  };

  const selectCls: React.CSSProperties = {
    ...inputCls,
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 1rem center',
    paddingRight: '2.75rem',
  };

  const sectionDivider = (label: string) => (
    <div style={{
      fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: '0.16em', color: 'var(--on-surface-variant)', opacity: 0.35,
      paddingBottom: '0.875rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
      marginBottom: '1.25rem',
    }}>
      {label}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="view-container page-fade-in">
      {DialogMount}

      {/* Page Header */}
      <header className="view-header">
        <div>
          <div
            onClick={() => navigate('/leases')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
            Lease Portfolio
          </div>
          <h1 className="view-title">New Agreement</h1>
          <p style={{ color: 'var(--on-surface-variant)', opacity: 0.6, marginTop: '0.5rem', fontWeight: 500 }}>
            Set up a new lease — tenant, unit, financials and dates.
          </p>
        </div>
      </header>

      {/* Card */}
      <div className="modern-card" style={{ padding: '2.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>

          {/* ── Lease Type ── */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '0.375rem', borderRadius: '1rem', width: 'fit-content' }}>
            {(['property', 'hostel'] as LeaseType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setLeaseType(t); setForm(EMPTY_FORM); setPropertyId(''); setRoomId(''); }}
                style={{
                  padding: '0.625rem 1.75rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  background: leaseType === t ? 'var(--surface-container-highest)' : 'transparent',
                  color: leaseType === t ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                  transition: 'all 0.2s ease',
                }}
              >
                {t === 'property' ? '🏠 Private Asset' : '🏨 Shared Facility'}
              </button>
            ))}
          </div>

          {/* ── Tenant ── */}
          <div>
            {sectionDivider('Tenant')}
            <label style={labelCls}>Select Tenant *</label>
            <select
              required
              value={form.tenant_id}
              onChange={e => set('tenant_id', e.target.value)}
              style={selectCls}
            >
              <option value="">— choose tenant —</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}{t.phone ? ` · ${t.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* ── Asset ── */}
          {leaseType === 'property' ? (
            <div>
              {sectionDivider('Property & Unit')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelCls}>Property *</label>
                  <select
                    required
                    value={propertyId}
                    onChange={e => { setPropertyId(e.target.value); set('unit_id', ''); set('rent_amount', ''); }}
                    style={selectCls}
                  >
                    <option value="">— choose property —</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelCls}>Vacant Unit *</label>
                  <select
                    required
                    value={form.unit_id}
                    disabled={!propertyId}
                    onChange={e => {
                      const u = units.find(u => u.id === e.target.value);
                      set('unit_id', e.target.value);
                      if (u?.base_rent) set('rent_amount', String(u.base_rent));
                    }}
                    style={{ ...selectCls, opacity: !propertyId ? 0.4 : 1 }}
                  >
                    <option value="">{propertyId ? '— choose unit —' : 'Select property first'}</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number}{u.base_rent ? ` — ${sym}${u.base_rent.toLocaleString()}/mo` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {sectionDivider('Hostel · Room · Bed')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelCls}>Hostel *</label>
                  <select
                    required
                    value={form.unit_id}
                    onChange={e => { set('unit_id', e.target.value); set('bed_id', ''); set('rent_amount', ''); setRoomId(''); }}
                    style={selectCls}
                  >
                    <option value="">— choose hostel —</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelCls}>Room *</label>
                  <select
                    required
                    value={roomId}
                    disabled={!form.unit_id}
                    onChange={e => { setRoomId(e.target.value); set('bed_id', ''); }}
                    style={{ ...selectCls, opacity: !form.unit_id ? 0.4 : 1 }}
                  >
                    <option value="">{form.unit_id ? '— choose room —' : 'Select hostel first'}</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelCls}>Vacant Bed *</label>
                  <select
                    required
                    value={form.bed_id}
                    disabled={!roomId}
                    onChange={e => {
                      const b = beds.find(b => b.id === e.target.value);
                      set('bed_id', e.target.value);
                      if (b?.price) set('rent_amount', String(b.price));
                    }}
                    style={{ ...selectCls, opacity: !roomId ? 0.4 : 1 }}
                  >
                    <option value="">{roomId ? '— choose bed —' : 'Select room first'}</option>
                    {beds.map(b => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bed_number}{b.price ? ` — ${sym}${b.price.toLocaleString()}/mo` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Financials ── */}
          <div>
            {sectionDivider('Financial Terms')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={labelCls}>Monthly Rent ({sym}) *</label>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00" required
                  value={form.rent_amount}
                  onChange={e => set('rent_amount', e.target.value)}
                  style={inputCls}
                />
              </div>
              <div>
                <label style={labelCls}>First Month ({sym})</label>
                <input
                  type="number" step="0.01" min="0" placeholder="same as monthly"
                  value={form.first_month_rent}
                  onChange={e => set('first_month_rent', e.target.value)}
                  style={inputCls}
                />
              </div>
              <div>
                <label style={labelCls}>Security Deposit ({sym})</label>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={form.security_deposit}
                  onChange={e => set('security_deposit', e.target.value)}
                  style={inputCls}
                />
              </div>
            </div>

            {/* Live move-in total hint */}
            {form.rent_amount && (
              <div style={{ marginTop: '0.875rem', padding: '0.75rem 1rem', background: 'rgba(var(--primary-rgb, 100,180,120), 0.08)', borderRadius: '0.75rem', fontSize: '0.8125rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary)' }}>payments</span>
                Move-in amount pending: <strong style={{ color: 'var(--on-surface)', marginLeft: '0.25rem' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={labelCls}>Start Date *</label>
                <input
                  type="date" required
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  style={inputCls}
                />
              </div>
              <div>
                <label style={labelCls}>End Date <span style={{ opacity: 0.45, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(leave blank for rolling)</span></label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  style={inputCls}
                />
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            {sectionDivider('Notes')}
            <label style={labelCls}>Special Terms <span style={{ opacity: 0.45, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
            <textarea
              placeholder="Any special conditions, clauses, or remarks..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              style={{ ...inputCls, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* ── Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              type="button"
              onClick={() => navigate('/leases')}
              style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-variant)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', padding: '0.75rem 1.25rem', borderRadius: '0.75rem' }}
            >
              Discard
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
              style={{ minWidth: '180px' }}
            >
              {saving ? 'Creating...' : 'Create Lease'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AddLease;
