import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
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
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();

  const [newRoom, setNewRoom] = useState({ room_number: '', floor: 0 });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newBed, setNewBed] = useState({ count: 1, price: 0 });

  const [vacancyFilter, setVacancyFilter] = useState<'All' | 'Vacant' | 'Full'>('All');

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState({ room_number: '', floor: 0 });
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [editBedData, setEditBedData] = useState({ bed_number: '', price: 0, status: 'Vacant' as Bed['status'] });

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
      if (ownerSnap && 'exists' in ownerSnap && ownerSnap.exists()) {
        const currency = (ownerSnap.data() as { currency?: string })?.currency || 'USD';
        currencySymbol = symbols[currency] || '$';
      }

      return { hostel, rooms, currencySymbol };
    },
    enabled: !!id && ownerId !== undefined,
  });

  const hostel = data?.hostel ?? null;
  const rooms = data?.rooms ?? [];
  const currencySymbol = data?.currencySymbol ?? '$';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hostel', id, ownerId] });

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !ownerId) return;
    try {
      await addDoc(collection(db, 'rooms'), {
        room_number: newRoom.room_number,
        floor: newRoom.floor,
        hostel_id: id,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      setNewRoom({ room_number: '', floor: 0 });
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  const getBedLabel = (index: number): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < 26) return letters[index];
    return letters[Math.floor(index / 26) - 1] + letters[index % 26];
  };

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !id || !ownerId) return;
    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return;
    try {
      const existingCount = room.beds?.length || 0;
      const bedsToInsert = Array.from({ length: newBed.count }, (_, i) => ({
        bed_number: `R${room.room_number} ${getBedLabel(existingCount + i)}`,
        price: newBed.price,
        room_id: selectedRoomId,
        hostel_id: id,
        owner_id: ownerId,
        status: 'Vacant',
        created_at: serverTimestamp(),
      }));
      await Promise.all(bedsToInsert.map(bed => addDoc(collection(db, 'beds'), bed)));
      setNewBed({ count: 1, price: 0 });
      setSelectedRoomId(null);
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  const startEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setEditRoomData({ room_number: room.room_number, floor: room.floor });
    setSelectedRoomId(null);
  };

  const handleEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoomId) return;
    try {
      await updateDoc(doc(db, 'rooms', editingRoomId), editRoomData);
      setEditingRoomId(null);
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  const handleDeleteRoom = async (room: Room) => {
    const occupiedBeds = room.beds?.filter(b => b.status === 'Occupied') || [];
    if (occupiedBeds.length > 0) {
      await showAlert(`Cannot delete — ${occupiedBeds.length} bed(s) are currently occupied.`);
      return;
    }
    const ok = await showConfirm('Delete this room and all its beds?', { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'rooms', room.id));
      setEditingRoomId(null);
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  const [bedModalOpen, setBedModalOpen] = useState(false);

  useEscapeKey(() => { setEditingBedId(null); setBedModalOpen(false); }, bedModalOpen);

  const startEditBed = (bed: Bed) => {
    setEditingBedId(bed.id);
    setEditBedData({ bed_number: bed.bed_number, price: bed.price, status: bed.status });
    setBedModalOpen(true);
  };

  const handleEditBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBedId) return;
    try {
      await updateDoc(doc(db, 'beds', editingBedId), editBedData);
      setEditingBedId(null);
      setBedModalOpen(false);
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  const handleDeleteBed = async (bed: Bed) => {
    if (bed.status === 'Occupied') {
      await showAlert('Cannot delete — this bed is currently occupied.');
      return;
    }
    const ok = await showConfirm('Delete this bed?', { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'beds', bed.id));
      setEditingBedId(null);
      setBedModalOpen(false);
      invalidate();
    } catch (error) { showAlert((error as Error).message); }
  };

  if (isLoading) return <div className="p-12">Loading hostel...</div>;
  if (!hostel) return null;

  const totalBeds  = rooms.reduce((acc, room) => acc + (room.beds?.length || 0), 0);
  const vacantBeds = rooms.reduce((acc, room) => acc + (room.beds?.filter(b => b.status === 'Vacant').length || 0), 0);

  const filteredRooms = rooms.filter(room => {
    const vacant = room.beds?.filter(b => b.status === 'Vacant').length || 0;
    if (vacancyFilter === 'Vacant') return vacant > 0;
    if (vacancyFilter === 'Full')   return vacant === 0 && (room.beds?.length || 0) > 0;
    return true;
  });

  return (
    <div className="hostel-detail-container">
      {DialogMount}

      {/* ── Header ── */}
      <header className="hostel-page-header">
        <button className="hostel-back-btn" onClick={() => navigate('/hostels')}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Hostels
        </button>
        <div className="hostel-title-row">
          <div className="hostel-title-group">
            <h1>{hostel.name}</h1>
            <p>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
              {hostel.address}
            </p>
          </div>
          <div className="hostel-header-stats">
            <div className="stat-block">
              <span className="label">Rooms</span>
              <span className="value">{rooms.length}</span>
            </div>
            <div className="stat-block">
              <span className="label">Total Beds</span>
              <span className="value">{totalBeds}</span>
            </div>
            <div className="stat-block">
              <span className="label">Vacant</span>
              <span className="value" style={{ color: 'var(--color-success)' }}>{vacantBeds}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Add Room ── */}
      {!isStaff && <section className="add-room-section">
        <h2>Add Room</h2>
        <form onSubmit={handleAddRoom} className="add-room-form">
          <div className="unit-input-group">
            <label>Room Number</label>
            <input
              type="text"
              className="unit-mini-input"
              placeholder="e.g. 101"
              value={newRoom.room_number}
              onChange={e => setNewRoom({ ...newRoom, room_number: e.target.value })}
              required
            />
          </div>
          <div className="unit-input-group" style={{ flex: '0 0 120px' }}>
            <label>Floor</label>
            <input
              type="number"
              className="unit-mini-input"
              value={newRoom.floor}
              onChange={e => setNewRoom({ ...newRoom, floor: parseInt(e.target.value) || 0 })}
              required
            />
          </div>
          <button type="submit" className="primary-button" style={{ alignSelf: 'flex-end' }}>
            <span className="material-symbols-outlined">add</span>
            Register Room
          </button>
        </form>
      </section>}

      {/* ── Rooms List ── */}
      <div className="rooms-title-row">
        <h2 className="display-small" style={{ fontSize: '1.5rem' }}>Rooms Inventory</h2>
        <div className="rooms-vacancy-filter">
          {(['All', 'Vacant', 'Full'] as const).map(f => (
            <button
              key={f}
              className={`vacancy-filter-btn ${vacancyFilter === f ? 'active' : ''}`}
              onClick={() => setVacancyFilter(f)}
            >
              {f === 'All'    && 'All Rooms'}
              {f === 'Vacant' && <>Has Vacancy <span className="vacancy-count">{rooms.filter(r => (r.beds?.filter(b => b.status === 'Vacant').length || 0) > 0).length}</span></>}
              {f === 'Full'   && 'Full'}
            </button>
          ))}
        </div>
      </div>

      <div className="rooms-list">
        {rooms.length === 0 ? (
          <div className="empty-state">No rooms registered yet. Add your first room above.</div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty-state">No rooms match this filter.</div>
        ) : (
          filteredRooms.map(room => (
            <div key={room.id} className="room-card">

              {/* Room header */}
              <div className="room-card-header">
                <div className="room-info-primary">
                  <div className="room-icon-circle">
                    <span className="material-symbols-outlined">meeting_room</span>
                  </div>
                  <div className="room-title-group">
                    <h3>Room {room.room_number}</h3>
                    <p>Floor {room.floor} · {room.beds?.length || 0} beds
                      {(() => {
                        const v = room.beds?.filter(b => b.status === 'Vacant').length || 0;
                        return v > 0
                          ? <span className="room-vacant-pill">{v} vacant</span>
                          : <span className="room-full-pill">Full</span>;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="room-header-actions">
                  {!isStaff && (
                    <>
                      <button
                        className={`icon-action-btn ${editingRoomId === room.id ? 'active' : ''}`}
                        title="Edit room"
                        onClick={() => editingRoomId === room.id ? setEditingRoomId(null) : startEditRoom(room)}
                      >
                        <span className="material-symbols-outlined">{editingRoomId === room.id ? 'close' : 'edit'}</span>
                      </button>
                      <button
                        className={`primary-button ${selectedRoomId === room.id ? 'glass' : ''}`}
                        style={{ padding: '0.55rem 1.1rem', fontSize: '0.8rem' }}
                        onClick={() => { setSelectedRoomId(selectedRoomId === room.id ? null : room.id); setEditingRoomId(null); }}
                      >
                        {selectedRoomId === room.id ? 'Close' : '+ Add Bed'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit room inline form */}
              {editingRoomId === room.id && (
                <form onSubmit={handleEditRoom} className="inline-add-bed">
                  <div className="unit-input-group">
                    <label>Room Number</label>
                    <input type="text" className="unit-mini-input" value={editRoomData.room_number}
                      onChange={e => setEditRoomData({ ...editRoomData, room_number: e.target.value })} required />
                  </div>
                  <div className="unit-input-group" style={{ flex: '0 0 120px' }}>
                    <label>Floor</label>
                    <input type="number" className="unit-mini-input" value={editRoomData.floor}
                      onChange={e => setEditRoomData({ ...editRoomData, floor: parseInt(e.target.value) || 0 })} required />
                  </div>
                  <button type="submit" className="primary-button" style={{ padding: '0.65rem 1.25rem' }}>Save</button>
                  <button type="button" className="primary-button glass" style={{ padding: '0.65rem 1.25rem' }} onClick={() => setEditingRoomId(null)}>Cancel</button>
                  <button type="button" className="delete-btn" onClick={() => handleDeleteRoom(room)}>
                    <span className="material-symbols-outlined">delete</span>Delete Room
                  </button>
                </form>
              )}

              {/* Add bed inline form */}
              {selectedRoomId === room.id && (
                <form onSubmit={handleAddBed} className="inline-add-bed">
                  <div className="unit-input-group" style={{ flex: '0 0 120px' }}>
                    <label>No. of Beds</label>
                    <input type="number" className="unit-mini-input" min={1} max={26} value={newBed.count}
                      onChange={e => setNewBed({ ...newBed, count: parseInt(e.target.value) || 1 })} required />
                  </div>
                  <div className="unit-input-group">
                    <label>Price ({currencySymbol})</label>
                    <input type="number" className="unit-mini-input" value={newBed.price}
                      onChange={e => setNewBed({ ...newBed, price: parseFloat(e.target.value) || 0 })} required />
                  </div>
                  <div className="unit-input-group">
                    <label>Preview</label>
                    <span className="unit-mini-input" style={{ display: 'flex', alignItems: 'center', opacity: 0.6, fontSize: '0.8rem' }}>
                      {Array.from({ length: Math.min(newBed.count, 3) }, (_, i) =>
                        `R${room.room_number} ${getBedLabel((room.beds?.length || 0) + i)}`
                      ).join(', ')}{newBed.count > 3 ? ', …' : ''}
                    </span>
                  </div>
                  <button type="submit" className="primary-button" style={{ padding: '0.65rem 1.25rem', alignSelf: 'flex-end' }}>
                    Add {newBed.count > 1 ? `${newBed.count} Beds` : 'Bed'}
                  </button>
                </form>
              )}

              {/* ── Desktop: beds table ── */}
              <div className="beds-table-scroll">
                <table className="beds-table">
                  <thead>
                    <tr>
                      <th>Bed</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Allotted To</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(room.beds || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', opacity: 0.4 }}>
                          No beds yet — add some above.
                        </td>
                      </tr>
                    ) : (
                      room.beds.map(bed => (
                        <tr key={bed.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined opacity-30" style={{ fontSize: '1.1rem' }}>bed</span>
                              <span className="bed-no">{bed.bed_number}</span>
                            </div>
                          </td>
                          <td className="bed-price">{currencySymbol}{bed.price.toLocaleString()}</td>
                          <td>
                            <span className={`status-badge status-${bed.status.toLowerCase()}`}>{bed.status}</span>
                          </td>
                          <td style={{ opacity: 0.45, fontSize: '0.8rem' }}>Not Allotted</td>
                          <td>
                            {!isStaff && (
                              <button className="icon-action-btn" title="Edit bed" onClick={() => startEditBed(bed)}>
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile: bed cards ── */}
              <div className="bed-cards-list">
                {(room.beds || []).length === 0 ? (
                  <p style={{ textAlign: 'center', opacity: 0.4, padding: '1.5rem 0', fontSize: '0.875rem' }}>
                    No beds yet — add some above.
                  </p>
                ) : (
                  room.beds.map(bed => (
                    <div key={bed.id} className="bed-card">
                      <div className="bed-card-left">
                        <div className="bed-card-icon">
                          <span className="material-symbols-outlined">bed</span>
                        </div>
                        <div className="bed-card-info">
                          <span className="bed-no">{bed.bed_number}</span>
                          <span className="bed-price">{currencySymbol}{bed.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="bed-card-right">
                        <span className={`status-badge status-${bed.status.toLowerCase()}`}>{bed.status}</span>
                        {!isStaff && (
                          <button className="icon-action-btn" title="Edit bed" onClick={() => startEditBed(bed)}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── Edit Bed Modal ── */}
      {bedModalOpen && editingBedId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setEditingBedId(null), setBedModalOpen(false))}>
          <div className="modal-content" style={{ borderRadius: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Edit Bed</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.6 }}>{editBedData.bed_number}</p>
              </div>
              <button className="icon-action-btn" onClick={() => { setEditingBedId(null); setBedModalOpen(false); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleEditBed} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="unit-input-group">
                <label>Bed Number</label>
                <input type="text" className="unit-mini-input" value={editBedData.bed_number}
                  onChange={e => setEditBedData({ ...editBedData, bed_number: e.target.value })}
                  required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div className="unit-input-group">
                <label>Price ({currencySymbol})</label>
                <input type="number" className="unit-mini-input" value={editBedData.price}
                  onChange={e => setEditBedData({ ...editBedData, price: parseFloat(e.target.value) || 0 })}
                  required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div className="unit-input-group">
                <label>Status</label>
                <select className="unit-mini-input" value={editBedData.status}
                  onChange={e => setEditBedData({ ...editBedData, status: e.target.value as Bed['status'] })}
                  style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }}>
                  <option value="Vacant">Vacant</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <button type="button" className="icon-action-btn danger"
                  onClick={() => handleDeleteBed(rooms.flatMap(r => r.beds).find(b => b.id === editingBedId)!)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="primary-button glass" style={{ padding: '0.7rem 1.5rem' }}
                    onClick={() => { setEditingBedId(null); setBedModalOpen(false); }}>Cancel</button>
                  <button type="submit" className="primary-button" style={{ padding: '0.7rem 2rem' }}>Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelDetail;
