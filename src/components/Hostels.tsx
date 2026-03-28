import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import { useDialog } from '../hooks/useDialog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/Properties.css';

interface HostelData {
  id: string;
  name: string;
  address: string;
  roomCount: number;
}

const Hostels: React.FC = () => {
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [editingHostel, setEditingHostel] = useState<HostelData | null>(null);
  const [editData, setEditData] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);

  useEscapeKey(() => setEditingHostel(null), !!editingHostel);

  const { data: hostels = [], isLoading } = useQuery<HostelData[]>({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const [hostelSnap, roomSnap] = await Promise.all([
        getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId))),
      ]);

      const roomCounts: Record<string, number> = {};
      roomSnap.docs.forEach(d => {
        const hid = d.data().hostel_id;
        if (hid) roomCounts[hid] = (roomCounts[hid] || 0) + 1;
      });

      return hostelSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || '',
        address: d.data().address || '',
        roomCount: roomCounts[d.id] || 0,
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!ownerId,
  });

  const openEdit = (e: React.MouseEvent, hostel: HostelData) => {
    e.preventDefault();
    e.stopPropagation();
    setEditData({ name: hostel.name, address: hostel.address });
    setEditingHostel(hostel);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHostel) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'hostels', editingHostel.id), editData);
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
      setEditingHostel(null);
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, hostel: HostelData) => {
    e.preventDefault();
    e.stopPropagation();

    if (hostel.roomCount > 0) {
      await showAlert(`Cannot delete — "${hostel.name}" has ${hostel.roomCount} room(s). Remove all rooms first.`);
      return;
    }

    const ok = await showConfirm(`Delete "${hostel.name}"? This cannot be undone.`, { danger: true });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'hostels', hostel.id));
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <div className="p-12">Loading hostels...</div>;

  return (
    <div className="properties-container">
      {DialogMount}
      <header className="page-header">
        <div>
          <h1 className="display-small">Hostels</h1>
          <p className="text-on-surface-variant">Manage your shared accommodation facilities.</p>
        </div>
        {!isStaff && (
          <Link to="/hostels/new" className="primary-button">
            <span className="material-symbols-outlined">add</span>
            New Hostel
          </Link>
        )}
      </header>

      {hostels.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '4rem', opacity: 0.2, display: 'block', marginBottom: '1rem' }}>hotel</span>
          <h2 className="mb-2">No hostels yet</h2>
          <p className="text-on-surface-variant mb-8">Start by registering your first hostel facility.</p>
          <Link to="/hostels/new" className="primary-button" style={{ textDecoration: 'none' }}>Create First Hostel</Link>
        </div>
      ) : (
        <div className="properties-grid">
          {hostels.map((hostel) => (
            <div key={hostel.id} className="property-card" style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/hostels/${hostel.id}`}>
              <div className="property-header-compact">
                <div className="property-icon-box">
                  <span className="material-symbols-outlined">hotel</span>
                </div>
                {!isStaff && (
                  <div className="property-actions-compact" onClick={e => e.stopPropagation()}>
                    <button className="prop-action-btn" title="Edit hostel" onClick={e => openEdit(e, hostel)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
                    </button>
                    <button className="prop-action-btn danger" title="Delete hostel" onClick={e => handleDelete(e, hostel)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>delete</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="property-info">
                <h3 className="property-name">{hostel.name}</h3>
                <div className="property-address">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
                  {hostel.address}
                </div>
                <div className="property-stats">
                  <div className="stat-item">
                    <div className="stat-label">Rooms</div>
                    <div className="stat-value">{hostel.roomCount}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Facility</div>
                    <div className="stat-value">Hostel</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingHostel && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingHostel(null)}>
          <div className="modal-content" style={{ borderRadius: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Edit Hostel</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.6 }}>Update the hostel details</p>
              </div>
              <button className="icon-action-btn" onClick={() => setEditingHostel(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="unit-input-group">
                <label>Hostel Name</label>
                <input type="text" className="unit-mini-input" value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div className="unit-input-group">
                <label>Address</label>
                <input type="text" className="unit-mini-input" value={editData.address} onChange={e => setEditData(d => ({ ...d, address: e.target.value }))} required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className="primary-button glass" style={{ padding: '0.7rem 1.5rem' }} onClick={() => setEditingHostel(null)}>Cancel</button>
                <button type="submit" className="primary-button" style={{ padding: '0.7rem 2rem' }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Hostels;
