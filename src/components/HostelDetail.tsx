import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { LoadingScreen } from './layout/LoadingScreen';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/Units.css';
import '../styles/HostelDetail.css';
import '../styles/Properties.css';
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
  beds: Bed[];
}

interface Hostel {
  id: string;
  name: string;
  address: string;
}

const HostelDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();

  const [hostelForm, setHostelForm] = useState({ name: '', address: '' });
  const [savingHostel, setSavingHostel] = useState(false);

  const [newRoom, setNewRoom] = useState({ room_number: '', floor: 0 });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newBed, setNewBed] = useState({ count: 1, price: 0 });

  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [isAddBedModalOpen, setIsAddBedModalOpen] = useState(false);

  const [vacancyFilter, setVacancyFilter] = useState<'All' | 'Vacant' | 'Full'>('All');

  useEscapeKey(() => {
    setIsAddRoomModalOpen(false);
    setIsAddBedModalOpen(false);
  }, isAddRoomModalOpen || isAddBedModalOpen);

  const { data, isLoading } = useQuery({
    queryKey: ['hostel', id, ownerId],
    queryFn: async () => {
      if (!id) throw new Error('No hostel id');
      const symbols: { [key: string]: string } = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

      const [hostelSnap, roomsSnap, bedsSnap, ownerSnap] = await Promise.all([
        getDoc(doc(db, 'hostels', id)),
        getDocs(query(collection(db, 'rooms'), where('hostel_id', '==', id))),
        getDocs(query(collection(db, 'beds'), where('hostel_id', '==', id))),
        ownerId ? getDoc(doc(db, 'owners', ownerId)) : Promise.resolve(null),
      ]);

      if (!hostelSnap.exists()) {
        navigate('/hostels');
        throw new Error('Hostel not found');
      }

      const hostel = { id: hostelSnap.id, ...hostelSnap.data() } as Hostel;
      setHostelForm({ name: hostel.name, address: hostel.address });

      const allBeds = bedsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as (Bed & { room_id: string })[];
      const roomsList = roomsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Room & { room_id?: string }))
        .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));

      const rooms: Room[] = roomsList.map(r => ({
        ...r,
        beds: allBeds.filter(b => b.room_id === r.id),
      }));

      let currencySymbol = '$';
      if (ownerSnap && ownerSnap.exists()) {
        const currency = (ownerSnap.data() as any)?.currency || 'USD';
        currencySymbol = symbols[currency] || '$';
      }

      return { hostel, rooms, currencySymbol };
    },
    enabled: !!id && !!ownerId,
  });

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    return data.rooms.filter(room => {
      if (vacancyFilter === 'Vacant') return room.beds.some(b => b.status === 'Vacant');
      if (vacancyFilter === 'Full') return room.beds.every(b => b.status === 'Occupied');
      return true;
    });
  }, [data, vacancyFilter]);

  const stats = useMemo(() => {
    if (!data) return { totalRooms: 0, totalBeds: 0, vacantBeds: 0 };
    const totalRooms = data.rooms.length;
    const totalBeds = data.rooms.reduce((acc, r) => acc + r.beds.length, 0);
    const vacantBeds = data.rooms.reduce((acc, r) => acc + r.beds.filter(b => b.status === 'Vacant').length, 0);
    return { totalRooms, totalBeds, vacantBeds };
  }, [data]);

  const handleHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    setSavingHostel(true);
    try {
      await updateDoc(doc(db, 'hostels', id!), {
        ...hostelForm,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
      showAlert('Facility profile synchronized successfully.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSavingHostel(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) return;
    try {
      await addDoc(collection(db, 'rooms'), {
        ...newRoom,
        hostel_id: id,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      setNewRoom({ room_number: '', floor: 0 });
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      setIsAddRoomModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const handleAddBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || isStaff) return;
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < newBed.count; i++) {
        const bedRef = doc(collection(db, 'beds'));
        batch.set(bedRef, {
          bed_number: `Bed ${i + 1}`,
          price: newBed.price,
          status: 'Vacant',
          room_id: selectedRoomId,
          hostel_id: id,
          owner_id: ownerId,
          created_at: serverTimestamp(),
        });
      }
      await batch.commit();
      setSelectedRoomId(null);
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      setIsAddBedModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Facility Vault" />;
  if (!data) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      {/* Editorial Header */}
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/hostels')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Facility Registry
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Facility Detail
          </h1>
          <p className="text-secondary/60 font-medium mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">location_on</span>
            {data.hostel.address}
          </p>
        </div>
        {!isStaff && (
          <button className="primary-button min-w-[200px]" onClick={() => setIsAddRoomModalOpen(true)}>
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>add_circle</span>
            Add Room
          </button>
        )}
      </header>

      {/* Metrics Bar */}
      <div className="properties-metrics-bar custom-scrollbar">
        <div className="prop-metric">
          <span className="prop-metric-label">Room Inventory</span>
          <span className="prop-metric-value">{stats.totalRooms}</span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Bed Capacity</span>
          <span className="prop-metric-value">{stats.totalBeds}</span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Occupancy Rate</span>
          <span className="prop-metric-value" style={{ color: 'var(--primary)' }}>
            {stats.totalBeds > 0 ? Math.round(((stats.totalBeds - stats.vacantBeds) / stats.totalBeds) * 100) : 0}%
          </span>
        </div>
        <div className="prop-metric">
          <span className="prop-metric-label">Available Beds</span>
          <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{stats.vacantBeds}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Facility Intelligence (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="material-symbols-outlined text-[120px]">hotel</span>
            </div>
            
            <h2 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Facility Profile</h2>
            <form onSubmit={handleHostelSubmit} className="flex flex-col gap-8">
              <div className="form-group-modern">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Legal Facility Name</label>
                <input 
                  type="text" 
                  value={hostelForm.name} 
                  onChange={e => setHostelForm({...hostelForm, name: e.target.value})}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-xl p-3 font-display font-bold text-lg text-white"
                  required
                  disabled={isStaff}
                />
              </div>
              <div className="form-group-modern">
                <label className="text-[0.6rem] uppercase tracking-[0.2em] font-black text-secondary/40 block mb-2">Operating Address</label>
                <input 
                  type="text" 
                  value={hostelForm.address} 
                  onChange={e => setHostelForm({...hostelForm, address: e.target.value})}
                  className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-xl p-3 font-medium text-white/80"
                  required
                  disabled={isStaff}
                />
              </div>
              {!isStaff && (
                <button type="submit" className="primary-button text-[0.7rem] py-3" disabled={savingHostel}>
                  {savingHostel ? 'Syncing...' : 'Update Facility'}
                </button>
              )}
            </form>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Facility Insights</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Active Beds</span>
                <span className="text-white font-bold">{stats.totalBeds - stats.vacantBeds}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Vacant Slots</span>
                <span className="text-white font-bold">{stats.vacantBeds}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Efficiency</span>
                <span className="text-success font-bold">Optimal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Room Registry (8 cols) */}
        <div className="lg:col-span-8">
          <div className="view-toolbar mb-8">
            <div className="filter-tabs-modern">
              {(['All', 'Vacant', 'Full'] as const).map(tab => (
                <button key={tab} className={`tab-btn ${vacancyFilter === tab ? 'active' : ''}`} onClick={() => setVacancyFilter(tab)}>
                  {tab}
                  {vacancyFilter === tab && <div className="tab-indicator" />}
                </button>
              ))}
            </div>
            <div className="prop-filter-count">
              Showing {filteredRooms.length} of {data.rooms.length} room configurations
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRooms.map(room => (
              <div key={room.id} className="modern-card glass-panel group cursor-pointer" style={{ padding: '2rem' }} onClick={() => navigate(`/rooms/${room.id}`)}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-white font-display font-bold text-2xl tracking-tight">Room {room.room_number}</h3>
                    <div className="text-secondary/40 text-[0.6rem] uppercase tracking-widest font-black mt-1">Level {room.floor}</div>
                  </div>
                  <span className="material-symbols-outlined text-secondary/20 group-hover:text-primary transition-colors">arrow_forward_ios</span>
                </div>

                <div className="flex flex-col gap-3">
                  {room.beds.length === 0 ? (
                    <div className="text-xs text-secondary/40 italic py-2">No inventory allocated.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {room.beds.map(bed => (
                        <div key={bed.id} className={`w-3 h-3 rounded-full ${bed.status === 'Occupied' ? 'bg-primary' : bed.status === 'Maintenance' ? 'bg-error' : ''}`} style={bed.status === 'Vacant' ? { background: '#f4a4a4' } : undefined} title={`${bed.bed_number}: ${bed.status}`} />
                      ))}
                    </div>
                  )}
                  <div className="pt-4 border-t border-white/5 mt-2 flex justify-between items-center">
                    <span className="text-[0.6rem] font-bold text-secondary/60 uppercase tracking-widest">{room.beds.length} Total Inventory</span>
                    {!isStaff && (
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setSelectedRoomId(room.id); setIsAddBedModalOpen(true); }} title="Allocate Beds">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>add_circle</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Redesigned Modals */}
      {isAddRoomModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsAddRoomModalOpen(false)}>
          <div className="modal-content-modern" style={{ maxWidth: '560px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">New Room</h2>
              <p className="modal-subtitle">Define spatial parameters for the shared facility</p>
            </header>
            <form onSubmit={handleAddRoom} className="modal-form-modern">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Room Number</label>
                  <input 
                    type="text" 
                    value={newRoom.room_number} 
                    onChange={e => setNewRoom({...newRoom, room_number: e.target.value})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    placeholder="e.g. 101"
                    required 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Floor Level</label>
                  <input 
                    type="number" 
                    value={newRoom.floor} 
                    onChange={e => setNewRoom({...newRoom, floor: parseInt(e.target.value)})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
              </div>
              <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-8 pt-6 border-t border-white/5">
                <button type="button" className="primary-button glass-panel w-full sm:w-auto" onClick={() => setIsAddRoomModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)' }}>Discard</button>
                <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[200px]">Finalize Room</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {isAddBedModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsAddBedModalOpen(false)}>
          <div className="modal-content-modern" style={{ maxWidth: '560px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">Allocate Beds</h2>
              <p className="modal-subtitle">Define quantity and yield for the room inventory</p>
            </header>
            <form onSubmit={handleAddBeds} className="modal-form-modern">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Quantity of Units</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={newBed.count} 
                    onChange={e => setNewBed({...newBed, count: parseInt(e.target.value)})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Base Price per Bed ({data.currencySymbol})</label>
                  <input 
                    type="number" 
                    value={newBed.price} 
                    onChange={e => setNewBed({...newBed, price: parseFloat(e.target.value)})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
              </div>
              <footer className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-8 mt-8 pt-6 border-t border-white/5">
                <button type="button" className="primary-button glass-panel w-full sm:w-auto" onClick={() => setIsAddBedModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)' }}>Discard</button>
                <button type="submit" className="primary-button w-full sm:w-auto sm:min-w-[200px]">Sync Inventory</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelDetail;
