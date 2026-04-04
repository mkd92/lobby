import React, { useState, useEffect, useRef } from 'react';
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
interface Unit     { id: string; unit_number: string; type: string; base_rent: number; status: string; property_id: string; }
interface Hostel   { id: string; name: string; }
interface Room     { id: string; room_number: string; floor: number; }
interface Bed      { id: string; bed_number: string; price: number; status: string; room_id: string; hostel_id: string; }

type LeaseType = 'property' | 'hostel';

interface SelectOption { value: string; label: string; sub?: string; }

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

// ── CustomSelect ────────────────────────────────────────────────────────
const CustomSelect: React.FC<{
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled = false, searchable = false }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const filtered = searchable
    ? options.filter(o =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(searchTerm.toLowerCase())))
    : options;

  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchTerm('');
    }
    setHighlightedIdx(-1);
  }, [open, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlightedIdx(p => Math.min(p + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx(p => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlightedIdx >= 0) { onChange(filtered[highlightedIdx].value); setOpen(false); }
      else setOpen(!open);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      className={`custom-select-container${disabled ? ' disabled' : ''}`}
      ref={ref}
      onKeyDown={handleKeyDown}
      style={{ position: 'relative' }}
    >
      <div
        className={`custom-select-trigger${open ? ' open' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        tabIndex={disabled ? -1 : 0}
        style={{
          background: 'var(--surface-container-high)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '0.875rem 1.125rem',
          borderRadius: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <div style={{ overflow: 'hidden', flex: 1 }}>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
              <span style={{ color: 'var(--on-surface)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.label}</span>
              {selected.sub && <span style={{ opacity: 0.45, fontSize: '0.75rem', flexShrink: 0 }}>{selected.sub}</span>}
            </div>
          ) : (
            <span style={{ color: 'var(--on-surface-variant)', opacity: 0.45, fontSize: '0.9375rem' }}>{placeholder}</span>
          )}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', opacity: 0.5, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0, marginLeft: '0.5rem' }}>
          keyboard_arrow_down
        </span>
      </div>

      {open && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            left: 0, right: 0,
            background: 'var(--surface-container-highest)',
            borderRadius: '1rem',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {searchable && (
            <div style={{ padding: '0.625rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type to filter..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.75rem', width: '100%', color: 'var(--on-surface)', fontSize: '0.875rem' }}
              />
            </div>
          )}
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.4, fontSize: '0.875rem' }}>No matches</div>
            ) : filtered.map((o, i) => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: '0.875rem 1.125rem',
                  cursor: 'pointer',
                  background: o.value === value ? 'rgba(255,255,255,0.06)' : highlightedIdx === i ? 'rgba(255,255,255,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={() => setHighlightedIdx(i)}
              >
                <div style={{ fontWeight: o.value === value ? 800 : 600, color: o.value === value ? 'var(--primary)' : 'var(--on-surface)', fontSize: '0.9375rem' }}>{o.label}</div>
                {o.sub && <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.125rem' }}>{o.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────
const AddLease: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [leaseType, setLeaseType] = useState<LeaseType>('property');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');

  // ── Currency ────────────────────────────────────────────────────────
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
  const currencySymbol = SYMBOLS[ownerProfile?.currency] || '$';

  // ── Queries ─────────────────────────────────────────────────────────
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)).sort((a, b) => a.full_name.localeCompare(b.full_name));
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
    queryKey: ['units', ownerId, propertyId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'units'), where('property_id', '==', propertyId), where('status', '==', 'Vacant')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
    },
    enabled: !!ownerId && leaseType === 'property' && !!propertyId,
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
    queryKey: ['rooms', ownerId, form.unit_id],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', form.unit_id)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: !!ownerId && leaseType === 'hostel' && !!form.unit_id,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds', ownerId, roomId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('room_id', '==', roomId), where('status', '==', 'Vacant')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: !!ownerId && leaseType === 'hostel' && !!roomId,
  });

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tenant = tenants.find(t => t.id === form.tenant_id);
      let payload: any = {
        owner_id: ownerId,
        tenant_id: form.tenant_id,
        tenant_name: tenant?.full_name || '',
        rent_amount: parseFloat(form.rent_amount),
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: 'Active',
        notes: form.notes || null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const batch = writeBatch(db);

      if (leaseType === 'property') {
        const unit = units.find(u => u.id === form.unit_id);
        const prop = properties.find(p => p.id === unit?.property_id);
        payload.unit_id = form.unit_id;
        payload.unit_number = unit?.unit_number || '';
        payload.property_name = prop?.name || '';
        payload.bed_id = null;
        payload.bed_number = null;
        payload.room_number = null;
        payload.hostel_name = null;
        batch.update(doc(db, 'units', form.unit_id), { status: 'Occupied' });
      } else {
        const bed = beds.find(b => b.id === form.bed_id);
        const room = rooms.find(r => r.id === roomId);
        payload.bed_id = form.bed_id;
        payload.bed_number = bed?.bed_number || '';
        payload.room_number = room?.room_number || '';
        payload.hostel_name = hostels.find(h => h.id === form.unit_id)?.name || '';
        payload.unit_id = null;
        payload.unit_number = null;
        payload.property_name = null;
        batch.update(doc(db, 'beds', form.bed_id), { status: 'Occupied' });
      }

      const leaseRef = doc(collection(db, 'leases'));
      batch.set(leaseRef, payload);

      // Always create a move-in pending payment: first month rent + security deposit
      const firstRent      = form.first_month_rent ? parseFloat(form.first_month_rent) : payload.rent_amount;
      const depositAmount  = form.security_deposit  ? parseFloat(form.security_deposit) : 0;
      const totalDue       = firstRent + depositAmount;
      const firstMonthDate = new Date(form.start_date);
      const baseLabel      = firstMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthFor       = depositAmount > 0 ? `${baseLabel} + Deposit` : baseLabel;

      batch.set(doc(collection(db, 'payments')), {
        owner_id: ownerId,
        lease_id: leaseRef.id,
        tenant_name: payload.tenant_name,
        unit_number: payload.unit_number || null,
        property_name: payload.property_name || null,
        bed_number: payload.bed_number || null,
        room_number: payload.room_number || null,
        hostel_name: payload.hostel_name || null,
        rent_amount: totalDue,
        amount: 0,
        payment_date: form.start_date,
        month_for: monthFor,
        payment_method: null,
        status: 'Pending',
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

  const section = (label: string) => (
    <div style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--on-surface-variant)', opacity: 0.4, paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.25rem' }}>
      {label}
    </div>
  );

  return (
    <div className="view-container page-fade-in">
      {DialogMount}

      <header className="view-header">
        <div>
          <div
            className="view-eyebrow flex items-center gap-2 cursor-pointer group"
            onClick={() => navigate('/leases')}
          >
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Lease Portfolio
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            New Agreement
          </h1>
          <p className="text-secondary/60 font-medium mt-4">
            Establish legal terms and financial obligations for this entity
          </p>
        </div>
      </header>

      <div className="glass-panel rounded-[2.5rem] overflow-hidden">

        {/* Lease Type Toggle */}
        <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '0.375rem', borderRadius: '1.25rem', width: 'fit-content' }}>
            {(['property', 'hostel'] as LeaseType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setLeaseType(t); setForm(EMPTY_FORM); setPropertyId(''); setRoomId(''); }}
                style={{
                  padding: '0.75rem 2rem',
                  borderRadius: '1rem',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  background: leaseType === t ? 'var(--surface-container-highest)' : 'transparent',
                  color: leaseType === t ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                  transition: 'all 0.25s ease',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'property' ? 'Private Asset' : 'Shared Facility'}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Tenant */}
            <div>
              {section('Primary Legal Entity')}
              <div className="form-group-modern" style={{ marginBottom: 0 }}>
                <label>Tenant</label>
                <CustomSelect
                  options={tenants.map(t => ({ value: t.id, label: t.full_name, sub: t.phone || t.email }))}
                  value={form.tenant_id}
                  onChange={v => setForm({ ...form, tenant_id: v })}
                  placeholder="Search or select tenant..."
                  searchable
                />
              </div>
            </div>

            {/* Asset */}
            <div>
              {section(leaseType === 'property' ? 'Property & Unit' : 'Hostel, Room & Bed')}
              {leaseType === 'property' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group-modern" style={{ marginBottom: 0 }}>
                    <label>Property</label>
                    <CustomSelect
                      options={properties.map(p => ({ value: p.id, label: p.name }))}
                      value={propertyId}
                      onChange={v => { setPropertyId(v); setForm({ ...form, unit_id: '', rent_amount: '' }); }}
                      placeholder="Select property..."
                    />
                  </div>
                  <div className="form-group-modern" style={{ marginBottom: 0 }}>
                    <label>Vacant Unit</label>
                    <CustomSelect
                      options={units.map(u => ({ value: u.id, label: `Unit ${u.unit_number}`, sub: u.base_rent ? `${currencySymbol}${u.base_rent.toLocaleString()}/mo` : undefined }))}
                      value={form.unit_id}
                      onChange={v => {
                        const u = units.find(u => u.id === v);
                        setForm({ ...form, unit_id: v, rent_amount: u?.base_rent ? String(u.base_rent) : form.rent_amount });
                      }}
                      placeholder={propertyId ? 'Select unit...' : 'Select property first'}
                      disabled={!propertyId}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group-modern" style={{ marginBottom: 0 }}>
                    <label>Hostel</label>
                    <CustomSelect
                      options={hostels.map(h => ({ value: h.id, label: h.name }))}
                      value={form.unit_id}
                      onChange={v => { setForm({ ...form, unit_id: v, bed_id: '', rent_amount: '' }); setRoomId(''); }}
                      placeholder="Select hostel..."
                    />
                  </div>
                  <div className="form-group-modern" style={{ marginBottom: 0 }}>
                    <label>Room</label>
                    <CustomSelect
                      options={rooms.map(r => ({ value: r.id, label: `Room ${r.room_number}` }))}
                      value={roomId}
                      onChange={v => { setRoomId(v); setForm({ ...form, bed_id: '' }); }}
                      placeholder={form.unit_id ? 'Select room...' : 'Select hostel first'}
                      disabled={!form.unit_id}
                    />
                  </div>
                  <div className="form-group-modern" style={{ marginBottom: 0 }}>
                    <label>Vacant Bed</label>
                    <CustomSelect
                      options={beds.map(b => ({ value: b.id, label: `Bed ${b.bed_number}`, sub: b.price ? `${currencySymbol}${b.price.toLocaleString()}/mo` : undefined }))}
                      value={form.bed_id}
                      onChange={v => {
                        const b = beds.find(b => b.id === v);
                        setForm({ ...form, bed_id: v, rent_amount: b?.price ? String(b.price) : form.rent_amount });
                      }}
                      placeholder={roomId ? 'Select bed...' : 'Select room first'}
                      disabled={!roomId}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Financials */}
            <div>
              {section('Financial Terms')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group-modern" style={{ marginBottom: 0 }}>
                  <label>Monthly Rent ({currencySymbol})</label>
                  <input type="number" step="0.01" placeholder="0.00" value={form.rent_amount} onChange={e => setForm({ ...form, rent_amount: e.target.value })} required />
                </div>
                <div className="form-group-modern" style={{ marginBottom: 0 }}>
                  <label>First Month Rent ({currencySymbol})</label>
                  <input type="number" step="0.01" placeholder="Optional" value={form.first_month_rent} onChange={e => setForm({ ...form, first_month_rent: e.target.value })} />
                </div>
                <div className="form-group-modern" style={{ marginBottom: 0 }}>
                  <label>Security Deposit ({currencySymbol})</label>
                  <input type="number" step="0.01" placeholder="Optional" value={form.security_deposit} onChange={e => setForm({ ...form, security_deposit: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              {section('Contract Duration')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group-modern" style={{ marginBottom: 0 }}>
                  <label>Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div className="form-group-modern" style={{ marginBottom: 0 }}>
                  <label>End Date <span style={{ opacity: 0.35, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              {section('Additional Terms')}
              <div className="form-group-modern" style={{ marginBottom: 0 }}>
                <label>Notes <span style={{ opacity: 0.35, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input type="text" placeholder="Special conditions, clauses..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

          </div>

          {/* Sticky Footer */}
          <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)' }}>
            <button type="button" className="modal-discard-btn" onClick={() => navigate('/leases')}>
              Discard
            </button>
            <button type="submit" className="primary-button" disabled={saving} style={{ minWidth: '180px' }}>
              {saving ? 'Processing...' : 'Finalize Agreement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLease;
