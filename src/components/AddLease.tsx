import React, { useState, useEffect } from 'react';
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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [occupiedBedIds, setOccupiedBedIds] = useState<Set<string>>(new Set());

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  // ── Auto-prorate first month rent ───────────────────────────────────
  useEffect(() => {
    if (!form.start_date || !form.rent_amount) return;
    const [year, month, day] = form.start_date.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    const daysOccupied = daysInMonth - day + 1;
    const monthly = parseFloat(form.rent_amount);
    if (isNaN(monthly) || monthly <= 0) return;
    const prorated = Math.round((monthly / daysInMonth) * daysOccupied * 100) / 100;
    set('first_month_rent', String(prorated));
  }, [form.start_date, form.rent_amount]);

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
    queryKey: ['all-rooms', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
    },
    enabled: !!ownerId,
  });

  const { data: allBeds = [] } = useQuery({
    queryKey: ['all-beds', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: !!ownerId,
  });

  // Derived filtered state — a bed is vacant only if it has no active lease
  const rooms = React.useMemo(() => {
    if (!form.unit_id) return [];
    const hostelBeds = allBeds.filter(b => b.hostel_id === form.unit_id && !occupiedBedIds.has(b.id) && b.status !== 'Maintenance');
    const vacantRoomIds = [...new Set(hostelBeds.map(b => b.room_id))];
    return allRooms.filter(r => r.hostel_id === form.unit_id && vacantRoomIds.includes(r.id));
  }, [allRooms, allBeds, occupiedBedIds, form.unit_id]);

  const beds = React.useMemo(() => {
    if (!roomId) return [];
    return allBeds.filter(b => b.room_id === roomId && !occupiedBedIds.has(b.id) && b.status !== 'Maintenance');
  }, [allBeds, occupiedBedIds, roomId]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 1 && !form.tenant_id) { showAlert('Please select a stakeholder.'); return; }
    if (step === 2 && !form.bed_id) { showAlert('Please select a room and bed.'); return; }
    if (step === 3 && (!form.rent_amount || !form.start_date)) { showAlert('Please specify rent amount and start date.'); return; }

    // Fetch live occupied bed IDs just before showing the bed picker
    if (step === 1) {
      const snap = await getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId), where('status', '==', 'Active')));
      setOccupiedBedIds(new Set(snap.docs.map(d => d.data().bed_id as string).filter(Boolean)));
    }

    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      queryClient.invalidateQueries({ queryKey: ['hostel'] });
      navigate('/agreements');
    } catch (err) {
      showAlert((err as Error).message);
      setSaving(false);
    }
  };

  const steps = [
    { n: 1, label: 'Tenant' },
    { n: 2, label: 'Asset' },
    { n: 3, label: 'Terms' },
    { n: 4, label: 'Review' },
  ];

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '800px' }}>
      {DialogMount}

      <header className="view-header text-center">
        <h1 className="view-title text-4xl md:text-5xl mb-4">New Hostel Agreement</h1>
        <div className="flex justify-center gap-4 mt-8">
          {steps.map(s => (
            <div key={s.n} className="flex flex-col items-center gap-2">
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 900,
                background: step >= s.n ? 'var(--primary)' : 'var(--surface-container-highest)',
                color: step >= s.n ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                transition: 'all 0.3s ease'
              }}>
                {step > s.n ? <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span> : s.n}
              </div>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: step >= s.n ? 1 : 0.3 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="modern-card" style={{ padding: '2.5rem' }}>
        <form onSubmit={handleSubmit}>
          
          {step === 1 && (
            <div className="page-fade-in">
              <div className="view-eyebrow mb-8">Identify Stakeholder</div>
              <div className="form-group-modern">
                <label>Select Tenant *</label>
                <select required value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)} style={{ fontWeight: 600 }}>
                  <option value="">— choose from registry —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}{t.phone ? ` · ${t.phone}` : ''}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="page-fade-in">
              <div className="view-eyebrow mb-8">Asset Allocation</div>
              <div className="grid grid-cols-1 gap-6">
                <div className="form-group-modern">
                  <label>Hostel Facility *</label>
                  <select required value={form.unit_id} onChange={e => { set('unit_id', e.target.value); set('bed_id', ''); set('rent_amount', ''); setRoomId(''); }}>
                    <option value="">— choose facility —</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label>Room Number *</label>
                  <select required value={roomId} disabled={!form.unit_id} onChange={e => { setRoomId(e.target.value); set('bed_id', ''); }}>
                    <option value="">— choose room —</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label>Bed Selection *</label>
                  <select required value={form.bed_id} disabled={!roomId} onChange={e => {
                    const b = beds.find(b => b.id === e.target.value);
                    set('bed_id', e.target.value);
                    if (b?.price) set('rent_amount', String(b.price));
                  }}>
                    <option value="">— choose bed —</option>
                    {beds.map(b => <option key={b.id} value={b.id}>Bed {b.bed_number} — {sym}{b.price?.toLocaleString()}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="page-fade-in">
              <div className="view-eyebrow mb-8">Contractual Terms</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group-modern">
                  <label>Monthly Rent ({sym}) *</label>
                  <input type="number" step="0.01" min="0" required value={form.rent_amount} onChange={e => set('rent_amount', e.target.value)} style={{ fontWeight: 700 }} />
                </div>
                <div className="form-group-modern">
                  <label>Commencement Date *</label>
                  <input type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div className="form-group-modern">
                  <label>First Month Rent ({sym})</label>
                  <input type="number" step="0.01" min="0" value={form.first_month_rent} onChange={e => set('first_month_rent', e.target.value)} placeholder={form.rent_amount || 'Defaults to monthly rent'} />
                  <span style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.25rem', display: 'block' }}>Leave blank to use monthly rent. Combined with advance to form the opening invoice.</span>
                </div>
                <div className="form-group-modern">
                  <label>Advance / Security Deposit ({sym})</label>
                  <input type="number" step="0.01" min="0" value={form.security_deposit} onChange={e => set('security_deposit', e.target.value)} />
                </div>
                <div className="form-group-modern">
                  <label>Expiry Date (Optional)</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="page-fade-in">
              <div className="view-eyebrow mb-8">Final Review</div>
              <div className="bg-surface-container-low p-6 rounded-2xl mb-8 border border-white/5">
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <span className="opacity-40 uppercase font-black text-[0.6rem] tracking-widest">Stakeholder</span>
                  <span className="font-bold">{tenants.find(t => t.id === form.tenant_id)?.full_name}</span>
                  <span className="opacity-40 uppercase font-black text-[0.6rem] tracking-widest">Facility</span>
                  <span className="font-bold">{hostels.find(h => h.id === form.unit_id)?.name}</span>
                  <span className="opacity-40 uppercase font-black text-[0.6rem] tracking-widest">Unit</span>
                  <span className="font-bold">Room {rooms.find(r => r.id === roomId)?.room_number} · Bed {beds.find(b => b.id === form.bed_id)?.bed_number}</span>
                  <span className="opacity-40 uppercase font-black text-[0.6rem] tracking-widest">Monthly Rent</span>
                  <span className="font-bold text-primary">{sym}{parseFloat(form.rent_amount || '0').toLocaleString()} / month</span>
                  <span className="opacity-40 uppercase font-black text-[0.6rem] tracking-widest">Opening Invoice</span>
                  <span className="font-bold text-primary">
                    {sym}{(
                      (form.first_month_rent ? parseFloat(form.first_month_rent) : parseFloat(form.rent_amount || '0')) +
                      (form.security_deposit ? parseFloat(form.security_deposit) : 0)
                    ).toLocaleString()}
                    <span style={{ fontWeight: 400, opacity: 0.5, fontSize: '0.75rem', marginLeft: '0.4rem' }}>
                      (1st month{form.security_deposit ? ' + advance' : ''})
                    </span>
                  </span>
                </div>
              </div>
              <div className="form-group-modern">
                <label>Addendum / Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional clauses..." style={{ resize: 'none' }} />
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-12 pt-8 border-t border-white/5">
            {step === 1 ? (
              <button type="button" className="primary-button flex-1" onClick={() => navigate(-1)} style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}>Discard</button>
            ) : (
              <button type="button" className="primary-button flex-1" onClick={handleBack} style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}>Back</button>
            )}
            
            {step < 4 ? (
              <button type="button" className="primary-button flex-[2]" onClick={handleNext}>Next Step</button>
            ) : (
              <button type="submit" className="primary-button flex-[2]" disabled={saving}>
                <span className="font-black text-xs uppercase tracking-widest">{saving ? 'Processing...' : 'Finalize Agreement'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLease;
