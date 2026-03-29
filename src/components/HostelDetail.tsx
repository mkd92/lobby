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
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Units.css';
import '../styles/HostelDetail.css';
import '../styles/Properties.css';

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

  const [newRoom, setNewRoom] = useState({ room_number: '', floor: 0 });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newBed, setNewBed] = useState({ count: 1, price: 0 });

  const [vacancyFilter, setVacancyFilter] = useState<'All' | 'Vacant' | 'Full'>('All');

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
      (document.getElementById('add-room-dialog') as any)?.close();
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
      (document.getElementById('add-beds-dialog') as any)?.close();
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading hostel configuration" />;
  if (!data) return null;

  return (
    <div className="view-container">
      {DialogMount}
      
      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate('/hostels')}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back to Hostels
          </div>
          <h1 className="view-title">{data.hostel.name}</h1>
          <p className="text-on-surface-variant mt-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>location_on</span>
            {data.hostel.address}
          </p>
        </div>
        {!isStaff && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="primary-button glass" onClick={() => (document.getElementById('add-room-dialog') as any)?.showModal()}>
              <span className="material-symbols-outlined">add_circle</span>
              Add Room
            </button>
          </div>
        )}
      </header>

      {/* Hostel Metrics */}
      <div className="view-metrics-bar">
        <div className="metric-pill">
          <span className="metric-pill-label">Total Rooms</span>
          <span className="metric-pill-value">{stats.totalRooms}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Total Beds</span>
          <span className="metric-pill-value">{stats.totalBeds}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Available Beds</span>
          <span className="metric-pill-value" style={{ color: 'var(--color-success)' }}>{stats.vacantBeds}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-pill-label">Occupancy</span>
          <span className="metric-pill-value">{stats.totalBeds > 0 ? Math.round(((stats.totalBeds - stats.vacantBeds) / stats.totalBeds) * 100) : 0}%</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="view-toolbar">
        <div className="filter-tabs-modern">
          {(['All', 'Vacant', 'Full'] as const).map(tab => (
            <button key={tab} className={`tab-btn ${vacancyFilter === tab ? 'active' : ''}`} onClick={() => setVacancyFilter(tab)}>
              {tab}
              {vacancyFilter === tab && <div className="tab-indicator" />}
            </button>
          ))}
        </div>
        <div className="prop-filter-count">
          Showing {filteredRooms.length} of {data.rooms.length} rooms
        </div>
      </div>

      {/* Rooms Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredRooms.map(room => (
          <div key={room.id} className="modern-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Room {room.room_number}</h3>
                <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Floor {room.floor}</div>
              </div>
              {!isStaff && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-icon" onClick={() => { setSelectedRoomId(room.id); (document.getElementById('add-beds-dialog') as any)?.showModal(); }} title="Add Beds"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>bed</span></button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {room.beds.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--surface-container-low)', borderRadius: '1rem', opacity: 0.5, fontSize: '0.85rem' }}>No beds added yet</div>
              ) : room.beds.map(bed => (
                <div key={bed.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--surface-container-low)', borderRadius: '0.875rem', border: '1px solid var(--outline-variant)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: bed.status === 'Vacant' ? 'var(--color-success)' : bed.status === 'Occupied' ? 'var(--primary)' : 'var(--error)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{bed.bed_number}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{data.currencySymbol}{bed.price.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="property-type-badge" style={{ fontSize: '0.55rem', padding: '0.15rem 0.4rem', background: bed.status === 'Vacant' ? 'var(--color-success-bg)' : 'var(--primary-container)', color: bed.status === 'Vacant' ? 'var(--color-success)' : 'var(--on-primary)' }}>{bed.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs */}
      <dialog id="add-room-dialog" className="modal-modern" style={{ padding: 0, border: 'none' }}>
        <header className="modal-header">
          <h2 className="modal-title">Add New Room</h2>
          <button className="modal-close-btn" onClick={() => (document.getElementById('add-room-dialog') as any)?.close()}><span className="material-symbols-outlined">close</span></button>
        </header>
        <form onSubmit={handleAddRoom} className="modal-form-modern">
          <div className="form-group-modern">
            <label>Room Number</label>
            <input type="text" value={newRoom.room_number} onChange={e => setNewRoom({...newRoom, room_number: e.target.value})} required />
          </div>
          <div className="form-group-modern">
            <label>Floor</label>
            <input type="number" value={newRoom.floor} onChange={e => setNewRoom({...newRoom, floor: parseInt(e.target.value)})} required />
          </div>
          <footer className="modal-footer-modern" style={{ padding: 0 }}>
            <button type="submit" className="primary-button">Create Room</button>
          </footer>
        </form>
      </dialog>

      <dialog id="add-beds-dialog" className="modal-modern" style={{ padding: 0, border: 'none' }}>
        <header className="modal-header">
          <h2 className="modal-title">Add Beds</h2>
          <button className="modal-close-btn" onClick={() => (document.getElementById('add-beds-dialog') as any)?.close()}><span className="material-symbols-outlined">close</span></button>
        </header>
        <form onSubmit={handleAddBeds} className="modal-form-modern">
          <div className="form-group-modern">
            <label>Number of Beds</label>
            <input type="number" min="1" max="10" value={newBed.count} onChange={e => setNewBed({...newBed, count: parseInt(e.target.value)})} required />
          </div>
          <div className="form-group-modern">
            <label>Price per Bed ({data.currencySymbol})</label>
            <input type="number" value={newBed.price} onChange={e => setNewBed({...newBed, price: parseFloat(e.target.value)})} required />
          </div>
          <footer className="modal-footer-modern" style={{ padding: 0 }}>
            <button type="submit" className="primary-button">Add Inventory</button>
          </footer>
        </form>
      </dialog>
    </div>
  );
};

export default HostelDetail;
