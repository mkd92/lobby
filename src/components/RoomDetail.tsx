import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Leases.css';

interface Bed {
  id: string;
  bed_number: string;
  price: number;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
}

interface Room {
  id: string;
  room_number: string;
  floor: number;
  hostel_id: string;
}

const RoomDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isStaff = userRole !== 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [form, setForm] = useState({
    room_number: '',
    floor: '',
  });
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const { data: room, isLoading: isRoomLoading } = useQuery({
    queryKey: ['room', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'rooms', id!));
      if (!snap.exists()) throw new Error('Room record not found');
      return { id: snap.id, ...snap.data() } as Room;
    },
    enabled: !!id,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds', id],
    queryFn: async () => {
      const q = query(collection(db, 'beds'), where('room_id', '==', id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Bed));
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (room) {
      setForm({
        room_number: room.room_number,
        floor: String(room.floor),
      });
    }
  }, [room]);

  useEffect(() => {
    const fetchCurrency = async () => {
      if (ownerId) {
        const ownerSnap = await getDoc(doc(db, 'owners', ownerId));
        const curr = ownerSnap.data()?.currency || 'USD';
        const symbols: any = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };
        setCurrencySymbol(symbols[curr] || '$');
      }
    };
    fetchCurrency();
  }, [ownerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'rooms', id!), {
        room_number: form.room_number,
        floor: parseInt(form.floor),
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['room', id] });
      queryClient.invalidateQueries({ queryKey: ['hostel', room?.hostel_id] });
      showAlert('Room configuration synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!room) return;
    const occupiedBeds = beds.filter(b => b.status === 'Occupied');
    if (occupiedBeds.length > 0) {
      showAlert('Operation Restricted: Cannot terminate a room with active bed leases. Terminate all active leases first.');
      return;
    }
    const ok = await showConfirm(`Are you sure you want to remove Room ${room.room_number} and all its bed inventory?`, { danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      beds.forEach(b => batch.delete(doc(db, 'beds', b.id)));
      batch.delete(doc(db, 'rooms', room.id));
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['hostel', room.hostel_id] });
      navigate(`/hostels/${room.hostel_id}`);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isRoomLoading) return <LoadingScreen message="Accessing Spatial Configuration" />;
  if (!room) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate(`/hostels/${room.hostel_id}`)}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Facility Registry
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Room Detail
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">fingerprint</span>
            ID: {room.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="badge-modern bg-primary/10 text-primary border border-white/5 px-4 py-2 rounded-xl text-xs font-bold uppercase">
            Shared Room
          </span>
          <span className={`badge-modern border border-white/5 px-4 py-2 rounded-xl text-xs font-bold bg-primary-container/20 text-primary-container uppercase`}>
            {beds.length} Total Beds
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Asset Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">bedroom_parent</span>
            </div>
            
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Room Profile</h3>
            <div className="flex flex-col gap-8">
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Room Designation</label>
                <div className="text-white font-display font-bold text-2xl tracking-tight">Room {room.room_number}</div>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Floor Level</label>
                <div className="text-white/80 font-medium text-lg">Level {room.floor}</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Inventory Summary</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Available Beds</span>
                <span className="text-success font-bold">{beds.filter(b => b.status === 'Vacant').length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Occupied Slots</span>
                <span className="text-primary font-bold">{beds.filter(b => b.status === 'Occupied').length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Maintenance</span>
                <span className="text-error font-bold">{beds.filter(b => b.status === 'Maintenance').length}</span>
              </div>
            </div>
          </div>

          {!isStaff && (
            <button className="btn-icon danger w-full glass-panel py-4 rounded-2xl flex items-center justify-center gap-2 text-error font-bold" onClick={handleDelete}>
              <span className="material-symbols-outlined">delete</span>
              Terminate Room Entry
            </button>
          )}
        </div>

        {/* Right Column: Record Management (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-white font-display font-bold text-3xl tracking-tight">Modify Parameters</h2>
              {!isStaff && (
                <div className="flex items-center gap-2 text-primary-container/60 text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                  Ready for Sync
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Room Number</label>
                  <input 
                    type="text" 
                    value={form.room_number} 
                    onChange={e => setForm({...form, room_number: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Floor Level</label>
                  <input 
                    type="number" 
                    value={form.floor} 
                    onChange={e => setForm({...form, floor: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                    disabled={isStaff} 
                  />
                </div>
              </div>

              {!isStaff && (
                <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-6 pt-10 border-t border-white/5">
                  <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors" onClick={() => navigate(`/hostels/${room.hostel_id}`)}>
                    Discard Changes
                  </button>
                  <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[220px]" disabled={saving}>
                    {saving ? 'Synchronizing...' : 'Finalize Record'}
                  </button>
                </footer>
              )}
            </form>
          </div>

          <div className="glass-panel p-10 md:p-16 rounded-[48px]">
            <h2 className="text-white font-display font-bold text-3xl tracking-tight mb-12">Bed Inventory</h2>
            <div className="flex flex-col gap-4">
              {beds.length === 0 ? (
                <div className="text-center py-10 opacity-40 italic">No bed inventory records identified.</div>
              ) : (
                beds.map(bed => (
                  <div key={bed.id} className="flex justify-between items-center p-6 rounded-3xl bg-surface-container-low border border-white/5">
                    <div className="flex items-center gap-6">
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: bed.status === 'Vacant' ? 'var(--color-success)' : bed.status === 'Occupied' ? 'var(--primary)' : 'var(--error)' }} />
                      <div>
                        <div className="text-white font-bold text-lg">{bed.bed_number}</div>
                        <div className="text-secondary/40 text-xs font-black uppercase tracking-widest mt-1">Base Price: {currencySymbol}{bed.price.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`badge-modern ${bed.status === 'Vacant' ? 'badge-success' : bed.status === 'Occupied' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.55rem' }}>{bed.status}</span>
                      {!isStaff && (
                        <button className="btn-icon danger" onClick={async () => {
                          if (bed.status === 'Occupied') {
                            showAlert('Operation Restricted: Cannot delete an occupied bed.');
                            return;
                          }
                          const ok = await showConfirm(`Delete ${bed.bed_number}?`);
                          if (!ok) return;
                          await deleteDoc(doc(db, 'beds', bed.id));
                          queryClient.invalidateQueries({ queryKey: ['beds', id] });
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetail;
