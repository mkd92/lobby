import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import '../styles/Units.css';
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
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const [newRoom, setNewRoom] = useState({ room_number: '', floor: 0 });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newBed, setNewBed] = useState({ count: 1, price: 0 });

  const [vacancyFilter, setVacancyFilter] = useState<'All' | 'Vacant' | 'Full'>('All');

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState({ room_number: '', floor: 0 });
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [editBedData, setEditBedData] = useState({ bed_number: '', price: 0, status: 'Vacant' as Bed['status'] });

  const fetchData = useCallback(async () => {
    try {
      if (ownerId) {
        const { data: ownerData } = await supabase
          .from('owners').select('currency').eq('id', ownerId).single();
        const symbols: { [key: string]: string } = {
          USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
        };
        setCurrencySymbol(symbols[ownerData?.currency || 'USD'] || '$');
      }

      const { data: hData, error: hError } = await supabase
        .from('hostels').select('*').eq('id', id).single();
      if (hError) throw hError;
      setHostel(hData);

      const { data: rData, error: rError } = await supabase
        .from('rooms')
        .select('*, beds (*)')
        .eq('hostel_id', id)
        .order('room_number', { ascending: true });
      if (rError) throw rError;
      setRooms(rData || []);
    } catch (error) {
      console.error('Error fetching hostel details:', error);
      navigate('/hostels');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, ownerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('rooms').insert([{ ...newRoom, hostel_id: id }]);
      if (error) throw error;
      setNewRoom({ room_number: '', floor: 0 });
      fetchData();
    } catch (error) { showAlert((error as Error).message); }
  };

  const getBedLabel = (index: number): string => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (index < 26) return letters[index];
    return letters[Math.floor(index / 26) - 1] + letters[index % 26];
  };

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return;
    try {
      const existingCount = room.beds?.length || 0;
      const bedsToInsert = Array.from({ length: newBed.count }, (_, i) => ({
        bed_number: `R${room.room_number} ${getBedLabel(existingCount + i)}`,
        price: newBed.price,
        room_id: selectedRoomId,
      }));
      const { error } = await supabase.from('beds').insert(bedsToInsert);
      if (error) throw error;
      setNewBed({ count: 1, price: 0 });
      setSelectedRoomId(null);
      fetchData();
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
      const { error } = await supabase.from('rooms').update(editRoomData).eq('id', editingRoomId);
      if (error) throw error;
      setEditingRoomId(null);
      fetchData();
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
      const { error } = await supabase.from('rooms').delete().eq('id', room.id);
      if (error) throw error;
      setEditingRoomId(null);
      fetchData();
    } catch (error) { showAlert((error as Error).message); }
  };

  const startEditBed = (bed: Bed) => {
    setEditingBedId(bed.id);
    setEditBedData({ bed_number: bed.bed_number, price: bed.price, status: bed.status });
  };

  const handleEditBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBedId) return;
    try {
      const { error } = await supabase.from('beds').update(editBedData).eq('id', editingBedId);
      if (error) throw error;
      setEditingBedId(null);
      fetchData();
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
      const { error } = await supabase.from('beds').delete().eq('id', bed.id);
      if (error) throw error;
      setEditingBedId(null);
      fetchData();
    } catch (error) { showAlert((error as Error).message); }
  };

  if (loading) return <div className="p-12">Loading hostel...</div>;
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
                        editingBedId === bed.id ? (
                          <tr key={bed.id} className="bed-edit-row">
                            <td>
                              <input type="text" className="unit-mini-input" style={{ width: '100%' }}
                                value={editBedData.bed_number}
                                onChange={e => setEditBedData({ ...editBedData, bed_number: e.target.value })} />
                            </td>
                            <td>
                              <input type="number" className="unit-mini-input" style={{ width: '100%' }}
                                value={editBedData.price}
                                onChange={e => setEditBedData({ ...editBedData, price: parseFloat(e.target.value) || 0 })} />
                            </td>
                            <td>
                              <select className="unit-mini-input" style={{ width: '100%' }}
                                value={editBedData.status}
                                onChange={e => setEditBedData({ ...editBedData, status: e.target.value as Bed['status'] })}>
                                <option value="Vacant">Vacant</option>
                                <option value="Occupied">Occupied</option>
                                <option value="Maintenance">Maintenance</option>
                              </select>
                            </td>
                            <td className="opacity-50">—</td>
                            <td>
                              <div className="bed-row-actions">
                                <button className="icon-action-btn active" title="Save" onClick={handleEditBed}>
                                  <span className="material-symbols-outlined">check</span>
                                </button>
                                <button className="icon-action-btn" title="Cancel" onClick={() => setEditingBedId(null)}>
                                  <span className="material-symbols-outlined">close</span>
                                </button>
                                <button className="icon-action-btn danger" title="Delete" onClick={() => handleDeleteBed(bed)}>
                                  <span className="material-symbols-outlined">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
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
                        )
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
    </div>
  );
};

export default HostelDetail;
