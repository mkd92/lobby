import React from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import '../styles/Properties.css';

interface HostelData {
  id: string;
  name: string;
  address: string;
  roomCount: number;
}

const Hostels: React.FC = () => {
  const { ownerId, isStaff } = useOwner();

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

      const data = hostelSnap.docs.map(d => {
        const dData = d.data();
        return {
          id: d.id,
          name: dData.name || '',
          address: dData.address || '',
          roomCount: roomCounts[d.id] || 0,
        };
      });

      return data.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!ownerId,
  });

  if (isLoading) return <div className="p-12">Loading hostels...</div>;

  return (
    <div className="properties-container">
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
          <span className="material-symbols-outlined text-6xl opacity-20 mb-4" style={{ fontSize: '4rem' }}>hotel</span>
          <h2 className="mb-2">No hostels yet</h2>
          <p className="text-on-surface-variant mb-8">Start by registering your first hostel facility.</p>
          <Link to="/hostels/new" className="primary-button" style={{ textDecoration: 'none' }}>Create First Hostel</Link>
        </div>
      ) : (
        <div className="properties-grid">
          {hostels.map((hostel) => (
            <Link key={hostel.id} to={`/hostels/${hostel.id}`} className="property-card" style={{ textDecoration: 'none' }}>
              <div className="property-image" style={{ background: 'var(--primary-container)', color: 'white' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.8 }}>hotel</span>
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
                    <div className="stat-value">{hostel.roomCount || 0}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Facility</div>
                    <div className="stat-value">Hostel</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Hostels;
