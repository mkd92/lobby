import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/HostelDetail.css';

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
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

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

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['hostel', id, ownerId],
    queryFn: async () => {
      if (!id) throw new Error('No hostel id');
      const symbols: { [key: string]: string } = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

      const [hostelSnap, allRoomsSnap, allBedsSnap, ownerSnap, allLeasesSnap] = await Promise.all([
        getDoc(doc(db, 'hostels', id)),
        getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId))),
        ownerId ? getDoc(doc(db, 'owners', ownerId)) : Promise.resolve(null),
        getDocs(query(collection(db, 'leases'), where('owner_id', '==', ownerId))),
      ]);

      if (!hostelSnap.exists()) {
        navigate('/hostels');
        throw new Error('Hostel not found');
      }

      const hostel = { id: hostelSnap.id, ...hostelSnap.data() } as Hostel;
      
      const hostelBedsRaw = allBedsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(b => b.hostel_id === id);

      const hostelBedIds = new Set(hostelBedsRaw.map(b => b.id));
      const allLeases = allLeasesSnap.docs.map(d => d.data());
      const activeLeases = allLeases.filter(l => l.bed_id && hostelBedIds.has(l.bed_id) && l.status === 'Active');
      const occupiedBedIds = new Set(activeLeases.map(l => l.bed_id));

      const allBeds = hostelBedsRaw.map(bedData => {
        // SOURCE OF TRUTH REBUILD: Derive status from active leases
        const isOccupied = occupiedBedIds.has(bedData.id);
        return { 
          id: bedData.id,
          bed_number: bedData.bed_number,
          price: bedData.price,
          status: isOccupied ? 'Occupied' : (bedData.status === 'Maintenance' ? 'Maintenance' : 'Vacant'),
          room_id: bedData.room_id 
        } as Bed & { room_id: string };
      });

      const roomsList = allRoomsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(r => r.hostel_id === id)
        .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));

      const rooms: Room[] = roomsList.map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
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

  useEffect(() => {
    if (data?.hostel) {
      setHostelForm({ name: data.hostel.name, address: data.hostel.address });
    }
  }, [data?.hostel]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    return data.rooms.filter(room => {
      if (vacancyFilter === 'Vacant') return room.beds.some(b => b.status === 'Vacant');
      if (vacancyFilter === 'Full') return room.beds.length > 0 && room.beds.every(b => b.status === 'Occupied');
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
    if (!isOwner || !id) return;
    setSavingHostel(true);
    try {
      await updateDoc(doc(db, 'hostels', id), {
        ...hostelForm,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
      showAlert('Facility registry updated.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSavingHostel(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !id) return;
    try {
      await addDoc(collection(db, 'rooms'), {
        ...newRoom,
        hostel_id: id,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      setNewRoom({ room_number: '', floor: 0 });
      setIsAddRoomModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !id || !selectedRoomId) return;
    try {
      for (let i = 0; i < newBed.count; i++) {
        const room = data?.rooms.find(r => r.id === selectedRoomId);
        const nextNum = (room?.beds.length || 0) + i + 1;
        const bed_number = `${room?.room_number || ''}${String.fromCharCode(64 + nextNum)}`;
        
        await addDoc(collection(db, 'beds'), {
          bed_number,
          price: newBed.price,
          status: 'Vacant',
          room_id: selectedRoomId,
          hostel_id: id,
          owner_id: ownerId,
          created_at: serverTimestamp(),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });
      setIsAddBedModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Facility Vault" />;
  if (isError) {
    return (
      <div className="view-container flex flex-col items-center justify-center min-h-[60vh]">
        <div className="modern-card p-12 text-center max-w-lg">
          <span className="material-symbols-outlined text-error text-5xl mb-6">error_outline</span>
          <h2 className="text-2xl font-bold mb-4">Vault Access Failure</h2>
          <p className="text-on-surface-variant mb-8">{(error as any)?.message || 'Missing or insufficient permissions.'}</p>
          <button onClick={() => navigate('/hostels')} className="primary-button w-full">Return to Registry</button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/hostels')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Facility Registry
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Facility Profile
          </h1>
        </div>
        {canCreate && (
          <button onClick={() => setIsAddRoomModalOpen(true)} className="primary-button">
            <span className="material-symbols-outlined mr-2">add_home</span>
            Add Room Configuration
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px]">
            <div className="view-eyebrow mb-10">Registry Parameters</div>
            <form onSubmit={handleHostelSubmit} className="flex flex-col gap-6">
              <div className="form-group-modern">
                <label>Facility Designation</label>
                <input 
                  type="text" 
                  value={hostelForm.name} 
                  onChange={e => setHostelForm({...hostelForm, name: e.target.value})} 
                  placeholder="Official Name"
                  required 
                  disabled={!isOwner}
                />
              </div>
              <div className="form-group-modern">
                <label>Geographic Identification</label>
                <textarea 
                  value={hostelForm.address} 
                  onChange={e => setHostelForm({...hostelForm, address: e.target.value})} 
                  placeholder="Complete Registry Address"
                  required 
                  disabled={!isOwner}
                  style={{ minHeight: '100px' }}
                />
              </div>
              {isOwner && (
                <div className="pt-4 border-t border-white/5">
                  <button type="submit" className="primary-button w-full" disabled={savingHostel}>
                    {savingHostel ? 'Synchronizing...' : 'Finalize Profile'}
                  </button>
                </div>
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
                        <div 
                          key={bed.id} 
                          className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            bed.status === 'Occupied' ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' : 
                            bed.status === 'Maintenance' ? 'bg-error' : 
                            'border-2 border-white/20'
                          }`} 
                          title={`${bed.bed_number}: ${bed.status}`} 
                        />
                      ))}
                    </div>
                  )}
                  <div className="pt-4 border-t border-white/5 mt-2 flex justify-between items-center">
                    <span className="text-[0.6rem] font-bold text-secondary/60 uppercase tracking-widest">{room.beds.length} Total Inventory</span>
                    {canCreate && (
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
              <footer className="modal-footer-modern">
                <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs px-6" onClick={() => setIsAddRoomModalOpen(false)}>Discard</button>
                <button type="submit" className="primary-button px-10">Register Room</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {isAddBedModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsAddBedModalOpen(false)}>
          <div className="modal-content-modern" style={{ maxWidth: '560px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">Allocate Inventory</h2>
              <p className="modal-subtitle">Register new sleeping units for this configuration</p>
            </header>
            <form onSubmit={handleAddBed} className="modal-form-modern">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Bed Count</label>
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
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Unit Price ({data.currencySymbol})</label>
                  <input 
                    type="number" 
                    value={newBed.price} 
                    onChange={e => setNewBed({...newBed, price: parseFloat(e.target.value)})} 
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required 
                  />
                </div>
              </div>
              <footer className="modal-footer-modern">
                <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs px-6" onClick={() => setIsAddBedModalOpen(false)}>Discard</button>
                <button type="submit" className="primary-button px-10">Initialize Units</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelDetail;
