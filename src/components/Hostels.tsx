import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import { PageSkeleton } from './layout/PageSkeleton';
import { useDialog } from '../hooks/useDialog';
import '../styles/Hostels.css';

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

  if (isLoading) return <div className="view-container"><PageSkeleton variant="cards" rows={6} /></div>;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Registry Overview</p>
          <h1 className="view-title text-4xl md:text-6xl">Hostel Facilities</h1>
        </div>
        {canCreate && (
          <button onClick={() => navigate('/hostels/new')} className="primary-button">
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>add_home</span>
            Register Facility
          </button>
        )}
      </header>

      {/* Metrics Bar */}
      {hostels.length > 0 && (
        <div className="properties-metrics-bar mb-12">
          <div className="prop-metric">
            <span className="prop-metric-label">Facilities</span>
            <span className="prop-metric-value">{hostels.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Room Inventory</span>
            <span className="prop-metric-value">{totalRooms}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Avg. Occupancy</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>88%</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', opacity: 0.3 }}>search</span>
          <input 
            type="text" 
            placeholder="Search by facility name or location..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.75rem 1.25rem 0.75rem 3rem', color: 'var(--on-surface)', fontSize: '0.875rem', fontWeight: 600 }}
          />
        </div>
        <div className="view-eyebrow" style={{ margin: 0, opacity: 0.4, fontSize: '0.6rem' }}>
          {filteredHostels.length} Facilities Identified
        </div>
      </div>

      {hostels.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>hotel_class</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Registry Is Empty</h2>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">Initialize your first shared accommodation facility to begin managing inventory.</p>
          {canCreate && (
            <button onClick={() => navigate('/hostels/new')} className="primary-button">Register First Facility</button>
          )}
        </div>
      ) : filteredHostels.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>search_off</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No Matching Facilities</h2>
          <p className="text-on-surface-variant mb-8">Adjust your parameters to locate specific accommodation entries.</p>
          <button className="primary-button" style={{ background: 'var(--surface-container-highest)' }} onClick={() => setSearch('')}>Clear Filter</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredHostels.map(hostel => (
            <div key={hostel.id} className="modern-card group cursor-pointer" onClick={() => navigate(`/hostels/${hostel.id}`)} style={{ padding: '2rem' }}>
              <div className="flex justify-between items-start mb-8">
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--outline-variant)' }}>
                  <span className="material-symbols-outlined text-on-surface opacity-60">apartment</span>
                </div>
                <div className="flex gap-2">
                  <span className="badge-modern badge-success">Active</span>
                  {isOwner && (
                    <button className="btn-icon danger" onClick={e => handleDelete(e, hostel)} style={{ background: 'rgba(239,68,68,0.05)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{hostel.name}</h3>
              <div className="flex items-center gap-2 text-on-surface-variant text-sm mb-8">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
                <span className="text-truncate">{hostel.address}</span>
              </div>
              
              <div className="flex gap-4 pt-6 border-t border-white/5">
                <div className="flex-1">
                  <div className="view-eyebrow" style={{ fontSize: '0.55rem', marginBottom: '0.25rem' }}>Inventory</div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{hostel.roomCount} Rooms</div>
                </div>
                <div className="flex items-center text-secondary group-hover:translate-x-1 transition-transform">
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Hostels;
