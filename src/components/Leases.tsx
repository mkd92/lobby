import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/Units.css';
import '../styles/Leases.css';

// ── Types ──────────────────────────────────────────────────────────────
interface Tenant    { id: string; full_name: string; email: string; phone: string; }
interface Property  { id: string; name: string; }
interface Unit      { id: string; unit_number: string; type: string; base_rent: number; status: string; property_id: string; }
interface Hostel    { id: string; name: string; }
interface Room      { id: string; room_number: string; floor: number; beds?: Bed[]; }
interface Bed       { id: string; bed_number: string; price: number; status: string; room_id: string; hostel_id: string; }

interface Lease {
  id: string;
  unit_id: string | null;
  bed_id: string | null;
  tenant_id: string;
  tenant_name: string;
  unit_number: string | null;
  property_name: string | null;
  bed_number: string | null;
  room_number: string | null;
  hostel_name: string | null;
  rent_amount: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string | null;
  status: 'Active' | 'Expired' | 'Terminated';
  notes: string | null;
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
  searchable?: boolean;
}> = ({ options, value, onChange, placeholder = 'Select…', disabled = false, prefilled = false, searchable = false }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      if (searchable) setTimeout(() => searchInputRef.current?.focus(), 50);
      const currentIdx = filteredOptions.findIndex(o => o.value === value);
      setHighlightedIdx(currentIdx >= 0 ? currentIdx : 0);
    } else {
      setSearchTerm('');
      setHighlightedIdx(-1);
    }
  }, [open]);

  // Reset highlight when search changes
  useEffect(() => { setHighlightedIdx(0); }, [searchTerm]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (optionsRef.current && highlightedIdx >= 0) {
      const el = optionsRef.current.querySelectorAll<HTMLElement>('.custom-option')[highlightedIdx];
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx]);

  const selected = options.find(o => o.value === value);
  const filteredOptions = options.filter(o =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.sub && o.sub.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const triggerClass = [
    'custom-select-trigger',
    open     ? 'open'      : '',
    disabled ? 'disabled'  : '',
    prefilled && !open ? 'prefilled' : '',
  ].filter(Boolean).join(' ');

  const toggle = () => { if (!disabled) setOpen(o => !o); };

  const selectHighlighted = () => {
    if (highlightedIdx >= 0 && filteredOptions[highlightedIdx]) {
      onChange(filteredOptions[highlightedIdx].value);
      setOpen(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, filteredOptions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); selectHighlighted(); }
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, filteredOptions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); selectHighlighted(); }
    if (e.key === 'Escape')    { setOpen(false); }
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
        <div className="custom-options" ref={optionsRef}>
          {searchable && (
            <div className="custom-select-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="custom-select-search"
                placeholder="Type to search…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={handleSearchKey}
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="custom-option-empty">No options found</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={opt.value}
                className={`custom-option ${value === opt.value ? 'selected' : ''} ${idx === highlightedIdx ? 'highlighted' : ''}`}
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
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const [filter, setFilter]       = useState<FilterTab>('All');

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

  // ── Queries ────────────────────────────────────────────────────────
  const { data: leases = [], isLoading } = useQuery({
    queryKey: ['leases', ownerId],
    queryFn: async () => {
      if (!ownerId) return [];
      // Fire-and-forget auto-expire — don't block data loading
      void (async () => {
        const today = new Date().toISOString().split('T')[0];
        const activeSnap = await getDocs(query(
          collection(db, 'leases'),
          where('owner_id', '==', ownerId),
          where('status', '==', 'Active')
        ));
        const batch = writeBatch(db);
        let hasExpired = false;
        for (const leaseDoc of activeSnap.docs) {
          const lease = leaseDoc.data();
          if (lease.end_date && lease.end_date < today) {
            batch.update(leaseDoc.ref, { status: 'Expired' });
            hasExpired = true;
          }
        }
        if (hasExpired) await batch.commit();
      })();

      const snap = await getDocs(query(
        collection(db, 'leases'),
        where('owner_id', '==', ownerId)
      ));

      const data: Lease[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lease));
      // Sort by created_at descending (newest first)
      data.sort((a: any, b: any) => {
        const ta = a.created_at?.seconds ?? 0;
        const tb = b.created_at?.seconds ?? 0;
        return tb - ta;
      });
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

  const invalidateLeases = () => queryClient.invalidateQueries({ queryKey: ['leases', ownerId] });

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
    if (!ownerId) return;
    const [tSnap, pSnap, hSnap] = await Promise.all([
      getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId))),
      getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId))),
      getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId))),
    ]);
    const tData = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property))
      .sort((a, b) => a.name.localeCompare(b.name));
    const hData = hSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hostel))
      .sort((a, b) => a.name.localeCompare(b.name));
    setTenants(tData);
    setProperties(pData);
    setHostels(hData);
  };

  const loadUnits = async (propertyId: string) => {
    const snap = await getDocs(query(
      collection(db, 'units'),
      where('property_id', '==', propertyId)
    ));
    let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit))
      .sort((a, b) => a.unit_number.localeCompare(b.unit_number));
    if (!editingLease) {
      data = data.filter(u => u.status === 'Vacant');
    } else {
      // In edit mode, show Vacant units PLUS the currently leased unit
      data = data.filter(u => u.status === 'Vacant' || u.id === editingLease.unit_id);
    }
    setUnits(data);
  };

  const loadRooms = async (hostelId: string) => {
    const [roomsSnap, bedsSnap] = await Promise.all([
      getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', hostelId))),
      getDocs(query(collection(db, 'beds'), where('hostel_id', '==', hostelId))),
    ]);

    const allBeds = bedsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    // Group beds by room_id
    const bedsByRoom: Record<string, Bed[]> = {};
    for (const bed of allBeds) {
      if (!bedsByRoom[bed.room_id]) bedsByRoom[bed.room_id] = [];
      bedsByRoom[bed.room_id].push(bed);
    }

    let data = roomsSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      beds: bedsByRoom[d.id] || [],
    } as Room)).sort((a, b) => String(a.room_number).localeCompare(String(b.room_number)));

    if (!editingLease) {
      // Show only rooms that have at least one vacant bed
      data = data.filter(r => r.beds?.some(b => b.status === 'Vacant'));
    } else {
      // In edit mode, show rooms with vacant beds PLUS the room that has the currently leased bed
      data = data.filter(r =>
        r.beds?.some(b => b.status === 'Vacant' || b.id === editingLease.bed_id)
      );
    }
    setRooms(data);
  };

  const loadBeds = async (roomId: string) => {
    const snap = await getDocs(query(
      collection(db, 'beds'),
      where('room_id', '==', roomId)
    ));
    let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed))
      .sort((a, b) => a.bed_number.localeCompare(b.bed_number));
    if (!editingLease) {
      data = data.filter(b => b.status === 'Vacant');
    } else {
      // In edit mode, show Vacant beds PLUS the currently leased bed
      data = data.filter(b => b.status === 'Vacant' || b.id === editingLease.bed_id);
    }
    setBeds(data);
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

  const openEdit = async (lease: Lease) => {
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

    // Set cascade selection IDs — fetch from Firestore since data is flat (no joins)
    if (lease.unit_id) {
      const unitDoc = await getDoc(doc(db, 'units', lease.unit_id));
      if (unitDoc.exists()) {
        const unitData = unitDoc.data();
        setSelectedPropertyId(unitData.property_id);
        loadUnits(unitData.property_id);
      }
    } else if (lease.bed_id) {
      const bedDoc = await getDoc(doc(db, 'beds', lease.bed_id));
      if (bedDoc.exists()) {
        const bedData = bedDoc.data() as Bed;
        const roomDoc = await getDoc(doc(db, 'rooms', bedData.room_id));
        if (roomDoc.exists()) {
          const roomData = roomDoc.data();
          setSelectedHostelId(roomData.hostel_id);
          setSelectedRoomId(bedData.room_id);
          loadRooms(roomData.hostel_id);
          loadBeds(bedData.room_id);
        }
      }
    }

    setRentPrefilled(false);
    setFirstMonthPrefilled(false);
    setFirstMonthBreakdown('');
    firstMonthUserEdited.current = false; // allow recalc from existing rent + start_date
    setShowModal(true);
    loadFormData();
  };

  const closeModal = () => { setShowModal(false); setEditingLease(null); };

  useEscapeKey(closeModal, showModal);

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
      const selectedTenant    = tenants.find(t => t.id === form.tenant_id);
      const selectedUnit      = units.find(u => u.id === form.unit_id);
      const selectedProperty  = properties.find(p => p.id === selectedPropertyId);
      const selectedBed       = beds.find(b => b.id === form.bed_id);
      const selectedRoom      = rooms.find(r => r.id === selectedRoomId);
      const selectedHostel    = hostels.find(h => h.id === selectedHostelId);

      if (editingLease) {
        // ── Update existing lease ──
        const updatedFields: Record<string, any> = {
          tenant_id:        form.tenant_id,
          tenant_name:      selectedTenant?.full_name || editingLease.tenant_name,
          rent_amount:      parseFloat(form.rent_amount) || 0,
          security_deposit: parseFloat(form.security_deposit) || null,
          start_date:       form.start_date,
          end_date:         form.end_date || null,
          status:           form.status,
          notes:            form.notes || null,
        };

        if (leaseType === 'property') {
          updatedFields.unit_id      = form.unit_id || null;
          updatedFields.unit_number  = selectedUnit?.unit_number || editingLease.unit_number || null;
          updatedFields.property_id  = selectedPropertyId || null;
          updatedFields.property_name = selectedProperty?.name || editingLease.property_name || null;
          updatedFields.bed_id       = null;
          updatedFields.bed_number   = null;
          updatedFields.room_id      = null;
          updatedFields.room_number  = null;
          updatedFields.hostel_id    = null;
          updatedFields.hostel_name  = null;
        } else {
          updatedFields.bed_id       = form.bed_id || null;
          updatedFields.bed_number   = selectedBed?.bed_number || editingLease.bed_number || null;
          updatedFields.room_id      = selectedRoomId || null;
          updatedFields.room_number  = selectedRoom?.room_number || editingLease.room_number || null;
          updatedFields.hostel_id    = selectedHostelId || null;
          updatedFields.hostel_name  = selectedHostel?.name || editingLease.hostel_name || null;
          updatedFields.unit_id      = null;
          updatedFields.unit_number  = null;
          updatedFields.property_id  = null;
          updatedFields.property_name = null;
        }

        await updateDoc(doc(db, 'leases', editingLease.id), updatedFields);
      } else {
        // ── Create new lease ──
        let leaseData: any = {
          owner_id:         ownerId,
          tenant_id:        form.tenant_id,
          tenant_name:      selectedTenant?.full_name || '',
          rent_amount:      parseFloat(form.rent_amount),
          security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
          start_date:       form.start_date,
          end_date:         form.end_date || null,
          status:           form.status,
          notes:            form.notes || null,
          created_at:       serverTimestamp(),
        };

        if (leaseType === 'property' && selectedUnit) {
          leaseData = {
            ...leaseData,
            unit_id:      selectedUnit.id,
            unit_number:  selectedUnit.unit_number,
            property_id:  selectedUnit.property_id,
            property_name: selectedProperty?.name || '',
            bed_id:       null,
            bed_number:   null,
            room_id:      null,
            room_number:  null,
            hostel_id:    null,
            hostel_name:  null,
          };
          // Mark unit as Occupied
          await updateDoc(doc(db, 'units', selectedUnit.id), { status: 'Occupied' });
        } else if (leaseType === 'hostel' && selectedBed) {
          leaseData = {
            ...leaseData,
            bed_id:       selectedBed.id,
            bed_number:   selectedBed.bed_number,
            room_id:      selectedRoom?.id || null,
            room_number:  selectedRoom?.room_number || null,
            hostel_id:    selectedHostel?.id || null,
            hostel_name:  selectedHostel?.name || null,
            unit_id:      null,
            unit_number:  null,
            property_id:  null,
            property_name: null,
          };
          // Mark bed as Occupied
          await updateDoc(doc(db, 'beds', selectedBed.id), { status: 'Occupied' });
        }

        const leaseRef = await addDoc(collection(db, 'leases'), leaseData);

        // ── Create initial payments ──
        // Parse date parts directly to avoid UTC-to-local timezone shift
        const [sy, sm] = form.start_date.split('-').map(Number);
        const monthLabel = new Date(sy, sm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const today = new Date().toISOString().split('T')[0];

        const firstRent = parseFloat(form.first_month_rent);
        if (firstRent > 0) {
          await addDoc(collection(db, 'payments'), {
            owner_id:       ownerId,
            lease_id:       leaseRef.id,
            tenant_name:    leaseData.tenant_name,
            unit_number:    leaseData.unit_number || null,
            property_name:  leaseData.property_name || null,
            bed_number:     leaseData.bed_number || null,
            room_number:    leaseData.room_number || null,
            hostel_name:    leaseData.hostel_name || null,
            rent_amount:    leaseData.rent_amount,
            amount:         firstRent,
            payment_date:   today,
            month_for:      monthLabel,
            payment_method: null,
            status:         'Pending',
            created_at:     serverTimestamp(),
          });
        }

        const deposit = parseFloat(form.security_deposit);
        if (deposit > 0) {
          await addDoc(collection(db, 'payments'), {
            owner_id:       ownerId,
            lease_id:       leaseRef.id,
            tenant_name:    leaseData.tenant_name,
            unit_number:    leaseData.unit_number || null,
            property_name:  leaseData.property_name || null,
            bed_number:     leaseData.bed_number || null,
            room_number:    leaseData.room_number || null,
            hostel_name:    leaseData.hostel_name || null,
            rent_amount:    leaseData.rent_amount,
            amount:         deposit,
            payment_date:   today,
            month_for:      'Security Deposit',
            payment_method: null,
            status:         'Pending',
            created_at:     serverTimestamp(),
          });
        }
      }

      closeModal(); invalidateLeases();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async (lease: Lease) => {
    const ok = await showConfirm('Delete this lease? This cannot be undone.', { danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'leases', lease.id));
      if (lease.status === 'Active') {
        if (lease.unit_id) batch.update(doc(db, 'units', lease.unit_id), { status: 'Vacant' });
        if (lease.bed_id)  batch.update(doc(db, 'beds',  lease.bed_id),  { status: 'Vacant' });
      }
      await batch.commit();
      invalidateLeases();
    } catch (err) {
      showAlert((err as Error).message);
    }
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
        {!isStaff && (
          <button className="primary-button" onClick={openCreate}>
            + New Lease
          </button>
        )}
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
        {isLoading ? (
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
                    const propName  = isHostel ? lease.hostel_name : lease.property_name;
                    const unitLabel = isHostel
                      ? `Room ${lease.room_number} · ${lease.bed_number}`
                      : `${lease.unit_number}`;
                    return (
                      <tr key={lease.id}>
                        <td>
                          <div className="tenant-cell">
                            <div className="tenant-avatar">{initials(lease.tenant_name || '?')}</div>
                            <div>
                              <div className="tenant-name">{lease.tenant_name}</div>
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
                          {!isStaff && (
                            <div className="row-actions">
                              <button className="icon-action-btn" title="Edit" onClick={() => openEdit(lease)}>
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(lease)}>
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          )}
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
                const propName  = isHostel ? lease.hostel_name : lease.property_name;
                const unitLabel = isHostel
                  ? `Room ${lease.room_number} · ${lease.bed_number}`
                  : `${lease.unit_number}`;
                return (
                  <div key={lease.id} className="lease-mobile-card">
                    <div className="lease-card-header">
                      <div className="tenant-info">
                        <div className="tenant-avatar">{initials(lease.tenant_name || '?')}</div>
                        <div>
                          <div className="tenant-name">{lease.tenant_name}</div>
                          <span className={`status-badge status-${lease.status.toLowerCase()}`} style={{ fontSize: '0.6rem' }}>{lease.status}</span>
                        </div>
                      </div>
                      {!isStaff && (
                        <div className="lease-card-actions">
                          <button className="icon-action-btn" onClick={() => openEdit(lease)}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="icon-action-btn danger" onClick={() => handleDelete(lease)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      )}
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
                    searchable={true}
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
