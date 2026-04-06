import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import { useDialog } from '../hooks/useDialog';
import '../styles/Hostels.css';
import '../styles/Leases.css';


interface HostelData {
  id: string;
  name: string;
  address: string;
  roomCount: number;
}

const Hostels: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [search, setSearch] = useState('');

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

  const filteredHostels = useMemo(() => {
    return hostels.filter(h => 
      h.name.toLowerCase().includes(search.toLowerCase()) || 
      h.address.toLowerCase().includes(search.toLowerCase())
    );
  }, [hostels, search]);

  const totalRooms = useMemo(() => 
    hostels.reduce((acc, h) => acc + h.roomCount, 0), 
  [hostels]);

  const handleDelete = async (e: React.MouseEvent, hostel: HostelData) => {
    e.preventDefault();
    e.stopPropagation();

    if (hostel.roomCount > 0) {
      await showAlert(`Cannot terminate — "${hostel.name}" currently contains ${hostel.roomCount} room records. Remove room inventory first.`);
      return;
    }

    const ok = await showConfirm(`Terminate registration for "${hostel.name}"? This action is permanent.`, { danger: true });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'hostels', hostel.id));
      queryClient.invalidateQueries({ queryKey: ['hostels', ownerId] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Accessing Shared Facility Vault" />;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header">
        <p className="view-eyebrow">Shared Facilities</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h1 className="view-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Hostel Facilities</h1>
          {canCreate && (
            <button onClick={() => navigate('/hostels/new')} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>add_home</span>
              Add Facility
            </button>
          )}
        </div>
      </header>

      {/* Metrics Bar */}
      {hostels.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar">
          <div className="prop-metric">
            <span className="prop-metric-label">Facilities</span>
            <span className="prop-metric-value">{hostels.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Room Inventory</span>
            <span className="prop-metric-value">{totalRooms}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Target Occupancy</span>
            <span className="prop-metric-value" style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'auto', color: 'var(--secondary)' }}>88% Avg</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="properties-toolbar">
        <div className="prop-search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input 
            type="text" 
            placeholder="Search by facility name or location..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="prop-search-input"
          />
        </div>
        <div className="prop-filter-count">
          {filteredHostels.length} / {hostels.length} Facilities Identified
        </div>
      </div>

      {hostels.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>hotel_class</span>
          </div>
          <h2 className="mb-4">No Hostels Registered</h2>
          <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Initialize your first shared accommodation facility to begin managing rooms and bed allocations.</p>
          {canCreate && (
            <button onClick={() => navigate('/hostels/new')} className="primary-button">Register First Facility</button>
          )}
        </div>
      ) : filteredHostels.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>search_off</span>
          </div>
          <h2 className="mb-4">No Matching Facilities</h2>
          <p className="text-on-surface-variant">Adjust your search parameters to find specific accommodation entries.</p>
          <button className="primary-button glass-panel mt-8" onClick={() => setSearch('')} style={{ background: 'rgba(255,255,255,0.05)' }}>Clear Search</button>
        </div>
      ) : (
        <div className="properties-grid">
          {filteredHostels.map(hostel => (
            <div key={hostel.id} className="property-card" onClick={() => navigate(`/hostels/${hostel.id}`)}>
              <div className="property-card-visual">
                <div className="property-type-chip">Shared Asset</div>
                <div className="property-icon-large">
                  <span className="material-symbols-outlined">hotel</span>
                </div>
                {isOwner && (
                  <div className="property-card-quick-actions" onClick={e => e.stopPropagation()}>
                    <button className="prop-mini-btn danger" onClick={e => handleDelete(e, hostel)} title="Terminate Registration">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="property-card-body">
                {isOwner && (
                  <div className="property-card-quick-actions-mobile mobile-only" onClick={e => e.stopPropagation()}>
                    <button className="prop-mini-btn danger" onClick={e => handleDelete(e, hostel)} title="Terminate Registration">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                )}
                <h3 className="property-name-modern">{hostel.name}</h3>
                <div className="property-address-modern">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', opacity: 0.5 }}>location_on</span>
                  {hostel.address}
                </div>
                
                <div className="property-card-stats-row">
                  <div className="stat-pill">
                    <span className="stat-pill-label">Inventory</span>
                    <span className="stat-pill-value">{hostel.roomCount} Rooms</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-label">Status</span>
                    <span className="stat-pill-value" style={{ color: 'var(--primary)' }}>Active</span>
                  </div>
                </div>
              </div>
              
              <div className="property-card-footer">
                <span className="view-link">
                  Manage Room & Bed Inventory
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Hostels;
