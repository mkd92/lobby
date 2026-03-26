import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useDialog } from '../hooks/useDialog';
import '../styles/Units.css';
import '../styles/Leases.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Tenant    { id: string; full_name: string; email: string; phone: string; }
interface Property  { id: string; name: string; }
interface Unit      { id: string; unit_number: string; type: string; base_rent: number; }
interface Hostel    { id: string; name: string; }
interface Room      { id: string; room_number: string; floor: number; }
interface Bed       { id: string; bed_number: string; price: number; }

interface Lease {
  id: string;
  unit_id: string | null;
  bed_id: string | null;
  tenant_id: string;
  rent_amount: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  status: 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
  tenants: Tenant;
  units: { unit_number: string; type: string; properties: { name: string } } | null;
  beds: { bed_number: string; price: number; rooms: { room_number: string; hostels: { name: string } } } | null;
}

type LeaseType = 'property' | 'hostel';
type FilterTab  = 'All' | 'Active' | 'Expired' | 'Terminated';

interface SelectOption {
  value: string;
  label: string;
  sub?: string;
}

const EMPTY_FORM = {
  tenant_id: '',
  unit_id: '',
  bed_id: '',
  rent_amount: '',
  first_month_rent: '',
  security_deposit: '',
  start_date: '',
  end_date: '',
  status: 'Active' as Lease['status'],
  notes: '',
};

// ── Proration helpers ──────────────────────────────────────────────────
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const calcFirstMonthRent = (rentAmount: string, startDate: string): { value: string; breakdown: string } | null => {
  const rent = parseFloat(rentAmount);
  if (!rent || !startDate) return null;
  const d   = new Date(startDate);
  const day = d.getDate();
  const dim = daysInMonth(d.getFullYear(), d.getMonth());
  const remaining = dim - day + 1;
  if (remaining === dim) return null; // starts on 1st — full month, no proration needed
  const prorated = Math.round((rent / dim) * remaining * 100) / 100;
  return {
    value:     String(prorated),
    breakdown: `${remaining} of ${dim} days`,
  };
};

// ── CustomSelect ───────────────────────────────────────────────────────
const CustomSelect: React.FC<{
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  prefilled?: boolean;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled = false, prefilled = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const triggerClass = [
    'custom-select-trigger',
    open     ? 'open'      : '',
    disabled ? 'disabled'  : '',
    prefilled && !open ? 'prefilled' : '',
  ].filter(Boolean).join(' ');

  const toggle = () => { if (!disabled) setOpen(o => !o); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    if (e.key === 'Escape') setOpen(false);
    if (open) {
      const idx = options.findIndex(o => o.value === value);
      if (e.key === 'ArrowDown') { e.preventDefault(); onChange(options[(idx + 1) % options.length]?.value ?? value); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(options[(idx - 1 + options.length) % options.length]?.value ?? value); }
    }
  };

  return (
    <div className="custom-select-container" ref={ref}>
      <div className={triggerClass} onClick={toggle} tabIndex={disabled ? -1 : 0} onKeyDown={handleKey}>
        <span style={{ color: selected ? 'var(--on-surface)' : 'var(--on-surface-variant)', opacity: selected ? 1 : 0.5 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="material-symbols-outlined" style={{
          fontSize: '1.1rem',
          transition: '0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>
          keyboard_arrow_down
        </span>
      </div>

      {open && !disabled && (
        <div className="custom-options">
          {options.length === 0 ? (
            <div className="custom-option-empty">No options available</div>
          ) : (
            options.map(opt => (
              <div
                key={opt.value}
                className={`custom-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <div>
                  <div className="custom-option-label">{opt.label}</div>
                  {opt.sub && <div className="custom-option-sub">{opt.sub}</div>}
                </div>
                {value === opt.value && (
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', flexShrink: 0 }}>check</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────
const Leases: React.FC = () => {
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const [leases, setLeases]       = useState<Lease[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterTab>('All');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Modal
  const [showModal, setShowModal]       = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [saving, setSaving]             = useState(false);

  // Form
  const [leaseType, setLeaseType] = useState<LeaseType>('property');
  const [form, setForm]           = useState({ ...EMPTY_FORM });

  // Cascade data
  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units,      setUnits]      = useState<Unit[]>([]);
  const [hostels,    setHostels]    = useState<Hostel[]>([]);
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [beds,       setBeds]       = useState<Bed[]>([]);

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedHostelId,   setSelectedHostelId]   = useState('');
  const [selectedRoomId,     setSelectedRoomId]     = useState('');
  const [rentPrefilled,          setRentPrefilled]          = useState(false);
  const [firstMonthPrefilled,    setFirstMonthPrefilled]    = useState(false);
  const [firstMonthBreakdown,    setFirstMonthBreakdown]    = useState('');
  const firstMonthUserEdited = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchLeases = useCallback(async () => {
    setLoading(true);
    try {
      // Auto-expire any active leases whose end_date has passed
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('leases')
        .update({ status: 'Expired' })
        .eq('status', 'Active')
        .lt('end_date', today)
        .not('end_date', 'is', null);

      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          tenants (id, full_name, email, phone),
          units (unit_number, type, base_rent, properties (name)),
          beds (bed_number, price, rooms (room_number, hostels (name)))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeases((data as unknown as Lease[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrency = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('owners').select('currency').eq('id', user.id).single();
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
    setCurrencySymbol(symbols[data?.currency || 'USD'] || '$');
  }, []);

  useEffect(() => { fetchLeases(); fetchCurrency(); }, [fetchLeases, fetchCurrency]);

  // Auto-calculate first month rent whenever rent or start date changes
  useEffect(() => {
    if (firstMonthUserEdited.current) return;
    if (!showModal) return;
    const result = calcFirstMonthRent(form.rent_amount, form.start_date);
    if (result) {
      setForm(f => ({ ...f, first_month_rent: result.value }));
      setFirstMonthBreakdown(result.breakdown);
      setFirstMonthPrefilled(true);
    } else {
      // Starts on 1st or no data — mirror full rent
      if (form.rent_amount) {
        setForm(f => ({ ...f, first_month_rent: form.rent_amount }));
        setFirstMonthBreakdown('');
      }
      setFirstMonthPrefilled(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rent_amount, form.start_date, showModal]);

  // ── Form reference data ────────────────────────────────────────────
  const loadFormData = async () => {
    const [{ data: t }, { data: p }, { data: h }] = await Promise.all([
      supabase.from('tenants').select('id, full_name, email, phone').order('full_name'),
      supabase.from('properties').select('id, name').order('name'),
      supabase.from('hostels').select('id, name').order('name'),
    ]);
    setTenants((t as Tenant[]) || []);
    setProperties((p as Property[]) || []);
    setHostels((h as Hostel[]) || []);
  };

  const loadUnits = async (propertyId: string) => {
    const { data } = await supabase.from('units').select('id, unit_number, type, base_rent').eq('property_id', propertyId).order('unit_number');
    setUnits((data as Unit[]) || []);
  };

  const loadRooms = async (hostelId: string) => {
    const { data } = await supabase.from('rooms').select('id, room_number, floor').eq('hostel_id', hostelId).order('room_number');
    setRooms((data as Room[]) || []);
  };

  const loadBeds = async (roomId: string) => {
    const { data } = await supabase.from('beds').select('id, bed_number, price').eq('room_id', roomId).order('bed_number');
    setBeds((data as Bed[]) || []);
  };

  // ── Open modal ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingLease(null);
    setForm({ ...EMPTY_FORM });
    setLeaseType('property');
    setSelectedPropertyId(''); setSelectedHostelId(''); setSelectedRoomId('');
    setUnits([]); setRooms([]); setBeds([]);
    setRentPrefilled(false);
    setFirstMonthPrefilled(false);
    setFirstMonthBreakdown('');
    firstMonthUserEdited.current = false;
    setShowModal(true);
    loadFormData();
  };

  const openEdit = (lease: Lease) => {
    setEditingLease(lease);
    setLeaseType(lease.bed_id ? 'hostel' : 'property');
    setForm({
      tenant_id:        lease.tenant_id,
      unit_id:          lease.unit_id || '',
      bed_id:           lease.bed_id  || '',
      rent_amount:      String(lease.rent_amount),
      first_month_rent: '',
      security_deposit: String(lease.security_deposit ?? ''),
      start_date:       lease.start_date,
      end_date:         lease.end_date || '',
      status:           lease.status,
      notes:            lease.notes || '',
    });
    setSelectedPropertyId(''); setSelectedHostelId(''); setSelectedRoomId('');
    setUnits([]); setRooms([]); setBeds([]);
    setRentPrefilled(false);
    setFirstMonthPrefilled(false);
    setFirstMonthBreakdown('');
    firstMonthUserEdited.current = false; // allow recalc from existing rent + start_date
    setShowModal(true);
    loadFormData();
  };

  const closeModal = () => { setShowModal(false); setEditingLease(null); };

  // ── Cascade handlers ───────────────────────────────────────────────
  const onPropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setForm(f => ({ ...f, unit_id: '' }));
    setUnits([]); setRentPrefilled(false);
    if (propertyId) loadUnits(propertyId);
  };

  const onUnitChange = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    setForm(f => ({ ...f, unit_id: unitId, rent_amount: unit ? String(unit.base_rent) : f.rent_amount }));
    setRentPrefilled(!!unit);
  };

  const onHostelChange = (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setSelectedRoomId('');
    setForm(f => ({ ...f, bed_id: '' }));
    setRooms([]); setBeds([]); setRentPrefilled(false);
    if (hostelId) loadRooms(hostelId);
  };

  const onRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setForm(f => ({ ...f, bed_id: '' }));
    setBeds([]); setRentPrefilled(false);
    if (roomId) loadBeds(roomId);
  };

  const onBedChange = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    setForm(f => ({ ...f, bed_id: bedId, rent_amount: bed ? String(bed.price) : f.rent_amount }));
    setRentPrefilled(!!bed);
  };

  const onTypeSwitch = (t: LeaseType) => {
    setLeaseType(t);
    setForm(f => ({ ...f, unit_id: '', bed_id: '', rent_amount: '' }));
    setSelectedPropertyId(''); setSelectedHostelId(''); setSelectedRoomId('');
    setUnits([]); setRooms([]); setBeds([]);
    setRentPrefilled(false);
  };

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_id) { showAlert('Please select a tenant.'); return; }
    if (leaseType === 'property' && !form.unit_id) { showAlert('Please select a unit.'); return; }
    if (leaseType === 'hostel'   && !form.bed_id)  { showAlert('Please select a bed.'); return; }
    if (!form.rent_amount) { showAlert('Please enter rent amount.'); return; }
    if (!form.start_date)  { showAlert('Please enter a start date.'); return; }

    setSaving(true);
    try {
      const payload = {
        tenant_id:        form.tenant_id,
        unit_id:          leaseType === 'property' ? form.unit_id : null,
        bed_id:           leaseType === 'hostel'   ? form.bed_id  : null,
        rent_amount:      parseFloat(form.rent_amount)      || 0,
        security_deposit: parseFloat(form.security_deposit) || null,
        start_date:       form.start_date,
        end_date:         form.end_date || null,
        status:           form.status,
        notes:            form.notes || null,
      };

      if (editingLease) {
        const { error } = await supabase.from('leases').update(payload).eq('id', editingLease.id);
        if (error) throw error;
      } else {
        // Insert lease and get the new id back
        const { data: newLease, error } = await supabase
          .from('leases')
          .insert([payload])
          .select('id')
          .single();
        if (error) throw error;

        // Build pending payment records
        const d = new Date(form.start_date);
        const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const pendingPayments: object[] = [];

        const firstRent = parseFloat(form.first_month_rent);
        if (firstRent > 0) {
          pendingPayments.push({
            lease_id:       newLease.id,
            amount:         firstRent,
            payment_date:   form.start_date,
            month_for:      monthLabel,
            status:         'Pending',
          });
        }

        const deposit = parseFloat(form.security_deposit);
        if (deposit > 0) {
          pendingPayments.push({
            lease_id:       newLease.id,
            amount:         deposit,
            payment_date:   form.start_date,
            month_for:      'Security Deposit',
            status:         'Pending',
          });
        }

        if (pendingPayments.length > 0) {
          const { error: pErr } = await supabase.from('payments').insert(pendingPayments);
          if (pErr) throw pErr;
        }
      }

      closeModal(); fetchLeases();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this lease? This cannot be undone.', { danger: true });
    if (!ok) return;
    const { error } = await supabase.from('leases').delete().eq('id', id);
    if (error) return showAlert(error.message);
    fetchLeases();
  };

  // ── Derived ────────────────────────────────────────────────────────
  const filtered = leases.filter(l => filter === 'All' || l.status === filter);
  const stats = {
    total:      leases.length,
    active:     leases.filter(l => l.status === 'Active').length,
    expired:    leases.filter(l => l.status === 'Expired').length,
    terminated: leases.filter(l => l.status === 'Terminated').length,
  };
  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Option builders ────────────────────────────────────────────────
  const tenantOptions:   SelectOption[] = tenants.map(t => ({ value: t.id, label: t.full_name, sub: t.phone || t.email }));
  const propertyOptions: SelectOption[] = properties.map(p => ({ value: p.id, label: p.name }));
  const unitOptions:     SelectOption[] = units.map(u => ({ value: u.id, label: u.unit_number, sub: u.type }));
  const hostelOptions:   SelectOption[] = hostels.map(h => ({ value: h.id, label: h.name }));
  const roomOptions:     SelectOption[] = rooms.map(r => ({ value: r.id, label: `Room ${r.room_number}`, sub: `Floor ${r.floor}` }));
  const bedOptions:      SelectOption[] = beds.map(b => ({ value: b.id, label: b.bed_number, sub: `${currencySymbol}${b.price.toLocaleString()}` }));
  const statusOptions:   SelectOption[] = [
    { value: 'Active',     label: 'Active' },
    { value: 'Expired',    label: 'Expired' },
    { value: 'Terminated', label: 'Terminated' },
  ];

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="leases-container">
      {DialogMount}
      {/* Header */}
      <div className="leases-header-row flex justify-between items-center mb-10">
        <div>
          <h1 className="display-medium mb-2">Leases</h1>
          <p className="text-on-surface-variant">Manage property and hostel lease agreements</p>
        </div>
        <button className="primary-button" onClick={openCreate}>
          + New Lease
        </button>
      </div>

      {/* Stats */}
      <div className="lease-stats-row">
        <div className="lease-stat-card"><div className="stat-label">Total Leases</div><div className="stat-value">{stats.total}</div></div>
        <div className="lease-stat-card"><div className="stat-label">Active</div><div className="stat-value green">{stats.active}</div></div>
        <div className="lease-stat-card"><div className="stat-label">Expired</div><div className="stat-value amber">{stats.expired}</div></div>
        <div className="lease-stat-card"><div className="stat-label">Terminated</div><div className="stat-value red">{stats.terminated}</div></div>
      </div>

      {/* Filter */}
      <div className="lease-filter-bar">
        <div className="filter-tabs">
          {(['All', 'Active', 'Expired', 'Terminated'] as FilterTab[]).map(tab => (
            <button key={tab} className={`filter-tab ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>{tab}</button>
          ))}
        </div>
        <span className="label-small opacity-50">{filtered.length} lease{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table & Cards */}
      <div className="leases-content-area">
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Loading leases…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.4 }}>
            No {filter !== 'All' ? filter.toLowerCase() + ' ' : ''}leases found.
            {filter === 'All' && <button style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={openCreate}> Create the first one.</button>}
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="leases-table-wrap desktop-only">
              <table className="leases-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property / Hostel</th>
                    <th>Unit / Bed</th>
                    <th>Rent</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lease => {
                    const isHostel  = !!lease.bed_id;
                    const propName  = isHostel ? lease.beds?.rooms?.hostels?.name : lease.units?.properties?.name;
                    const unitLabel = isHostel
                      ? `Room ${lease.beds?.rooms?.room_number} · ${lease.beds?.bed_number}`
                      : `${lease.units?.unit_number} · ${lease.units?.type}`;
                    return (
                      <tr key={lease.id}>
                        <td>
                          <div className="tenant-cell">
                            <div className="tenant-avatar">{initials(lease.tenants?.full_name || '?')}</div>
                            <div>
                              <div className="tenant-name">{lease.tenants?.full_name}</div>
                              <div className="tenant-email">{lease.tenants?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={`location-type-chip ${isHostel ? 'hostel' : 'property'}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>{isHostel ? 'hotel' : 'domain'}</span>
                            {isHostel ? 'Hostel' : 'Property'}
                          </div>
                          <div className="location-name">{propName || '—'}</div>
                        </td>
                        <td><div className="location-unit">{unitLabel}</div></td>
                        <td>
                          <div className="rent-amount">{currencySymbol}{Number(lease.rent_amount).toLocaleString()}</div>
                          {lease.security_deposit ? <div className="deposit-amount">Dep: {currencySymbol}{Number(lease.security_deposit).toLocaleString()}</div> : null}
                        </td>
                        <td>
                          <div className="date-range">
                            <div className="date-start">{fmt(lease.start_date)}</div>
                            <div className="date-end">{lease.end_date ? fmt(lease.end_date) : 'Open-ended'}</div>
                          </div>
                        </td>
                        <td><span className={`status-badge status-${lease.status.toLowerCase()}`}>{lease.status}</span></td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-action-btn" title="Edit" onClick={() => openEdit(lease)}>
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(lease.id)}>
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobile-only lease-cards-list">
              {filtered.map(lease => {
                const isHostel  = !!lease.bed_id;
                const propName  = isHostel ? lease.beds?.rooms?.hostels?.name : lease.units?.properties?.name;
                const unitLabel = isHostel
                  ? `Room ${lease.beds?.rooms?.room_number} · ${lease.beds?.bed_number}`
                  : `${lease.units?.unit_number} · ${lease.units?.type}`;
                return (
                  <div key={lease.id} className="lease-mobile-card">
                    <div className="lease-card-header">
                      <div className="tenant-info">
                        <div className="tenant-avatar">{initials(lease.tenants?.full_name || '?')}</div>
                        <div>
                          <div className="tenant-name">{lease.tenants?.full_name}</div>
                          <span className={`status-badge status-${lease.status.toLowerCase()}`} style={{ fontSize: '0.6rem' }}>{lease.status}</span>
                        </div>
                      </div>
                      <div className="lease-card-actions">
                        <button className="icon-action-btn" onClick={() => openEdit(lease)}>
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button className="icon-action-btn danger" onClick={() => handleDelete(lease.id)}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="lease-card-details">
                      <div className="detail-item">
                        <span className="material-symbols-outlined">{isHostel ? 'hotel' : 'domain'}</span>
                        <div>
                          <div className="detail-label">{isHostel ? 'Hostel' : 'Property'}</div>
                          <div className="detail-value">{propName || '—'}</div>
                        </div>
                      </div>
                      <div className="detail-item">
                        <span className="material-symbols-outlined">meeting_room</span>
                        <div>
                          <div className="detail-label">{isHostel ? 'Bed' : 'Unit'}</div>
                          <div className="detail-value">{unitLabel}</div>
                        </div>
                      </div>
                      <div className="detail-item">
                        <span className="material-symbols-outlined">payments</span>
                        <div>
                          <div className="detail-label">Monthly Rent</div>
                          <div className="detail-value">{currencySymbol}{Number(lease.rent_amount).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="detail-item">
                        <span className="material-symbols-outlined">calendar_today</span>
                        <div>
                          <div className="detail-label">Period</div>
                          <div className="detail-value">{fmt(lease.start_date)} - {lease.end_date ? fmt(lease.end_date) : 'Open'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="lease-modal">
            <div className="lease-modal-header">
              <div>
                <h2>{editingLease ? 'Edit Lease' : 'New Lease'}</h2>
                <p>{editingLease ? 'Update the lease details below' : 'Fill in the details to create an agreement'}</p>
              </div>
              <button className="icon-action-btn" onClick={closeModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="lease-modal-body">

                {/* Lease type toggle */}
                {!editingLease && (
                  <div className="form-group">
                    <label>Lease Type</label>
                    <div className="type-toggle">
                      <button type="button" className={`type-toggle-btn ${leaseType === 'property' ? 'active' : ''}`} onClick={() => onTypeSwitch('property')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>domain</span>
                        Property Unit
                      </button>
                      <button type="button" className={`type-toggle-btn ${leaseType === 'hostel' ? 'active' : ''}`} onClick={() => onTypeSwitch('hostel')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>hotel</span>
                        Hostel Bed
                      </button>
                    </div>
                  </div>
                )}

                {/* Tenant */}
                <div className="form-group">
                  <label>Tenant *</label>
                  <CustomSelect
                    options={tenantOptions}
                    value={form.tenant_id}
                    onChange={v => setForm(f => ({ ...f, tenant_id: v }))}
                    placeholder="Select tenant…"
                  />
                </div>

                {/* Property cascade */}
                {leaseType === 'property' && (
                  <div className="form-row cols-2">
                    <div className="form-group">
                      <label>Property *</label>
                      <CustomSelect
                        options={propertyOptions}
                        value={selectedPropertyId}
                        onChange={onPropertyChange}
                        placeholder="Select property…"
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit *</label>
                      <CustomSelect
                        options={unitOptions}
                        value={form.unit_id}
                        onChange={onUnitChange}
                        placeholder={selectedPropertyId ? 'Select unit…' : 'Select property first'}
                        disabled={!selectedPropertyId}
                      />
                    </div>
                  </div>
                )}

                {/* Hostel cascade */}
                {leaseType === 'hostel' && (
                  <div className="form-row cols-3">
                    <div className="form-group">
                      <label>Hostel *</label>
                      <CustomSelect
                        options={hostelOptions}
                        value={selectedHostelId}
                        onChange={onHostelChange}
                        placeholder="Select hostel…"
                      />
                    </div>
                    <div className="form-group">
                      <label>Room *</label>
                      <CustomSelect
                        options={roomOptions}
                        value={selectedRoomId}
                        onChange={onRoomChange}
                        placeholder={selectedHostelId ? 'Select room…' : 'Select hostel first'}
                        disabled={!selectedHostelId}
                      />
                    </div>
                    <div className="form-group">
                      <label>Bed *</label>
                      <CustomSelect
                        options={bedOptions}
                        value={form.bed_id}
                        onChange={onBedChange}
                        placeholder={selectedRoomId ? 'Select bed…' : 'Select room first'}
                        disabled={!selectedRoomId}
                      />
                    </div>
                  </div>
                )}

                <div className="section-divider">Financials</div>

                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Monthly Rent ({currencySymbol}) *</label>
                    <input
                      type="number"
                      className={`form-input ${rentPrefilled ? 'prefilled' : ''}`}
                      placeholder="0.00"
                      value={form.rent_amount}
                      onChange={e => {
                        setForm(f => ({ ...f, rent_amount: e.target.value }));
                        setRentPrefilled(false);
                        firstMonthUserEdited.current = false;
                      }}
                      min={0}
                      step="0.01"
                    />
                    {rentPrefilled && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 }}>✦ Auto-filled from unit price</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Security Deposit ({currencySymbol})</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={form.security_deposit}
                      onChange={e => setForm(f => ({ ...f, security_deposit: e.target.value }))}
                      min={0}
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>First Month Rent ({currencySymbol})</label>
                  <input
                    type="number"
                    className={`form-input ${firstMonthPrefilled ? 'prefilled' : ''}`}
                    placeholder="0.00"
                    value={form.first_month_rent}
                    onChange={e => {
                      setForm(f => ({ ...f, first_month_rent: e.target.value }));
                      setFirstMonthPrefilled(false);
                      firstMonthUserEdited.current = true;
                    }}
                    min={0}
                    step="0.01"
                  />
                  {firstMonthPrefilled && firstMonthBreakdown && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700 }}>
                      ✦ Prorated: {firstMonthBreakdown} × {currencySymbol}{(parseFloat(form.rent_amount) / (() => { const d = new Date(form.start_date); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); })()).toFixed(2)}/day
                    </span>
                  )}
                  {firstMonthPrefilled && !firstMonthBreakdown && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', fontWeight: 700, opacity: 0.6 }}>
                      ✦ Full month — lease starts on the 1st
                    </span>
                  )}
                  {!firstMonthPrefilled && !form.first_month_rent && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)', opacity: 0.5 }}>
                      Set monthly rent and start date to auto-calculate
                    </span>
                  )}
                </div>

                <div className="section-divider">Lease Period & Status</div>

                <div className="form-row cols-3">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.start_date}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.end_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Status *</label>
                    <CustomSelect
                      options={statusOptions}
                      value={form.status}
                      onChange={v => setForm(f => ({ ...f, status: v as Lease['status'] }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Any additional terms or notes…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>

              </div>

              <div className="lease-modal-footer">
                <button type="button" className="primary-button glass" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving…' : editingLease ? 'Save Changes' : 'Create Lease'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leases;
