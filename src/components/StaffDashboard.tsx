import React from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { LoadingScreen } from './layout/LoadingScreen';

interface Payment {
  id: string;
  tenant_name: string;
  bed_number: string | null;
  room_number: string | null;
  hostel_name: string | null;
  amount: number;
  rent_amount: number;
  month_for: string;
  status: 'Paid' | 'Partial' | 'Pending';
}

interface Bed {
  id: string;
  bed_number: string;
  room_id: string;
  hostel_id: string;
  status: string;
}

interface Room {
  id: string;
  room_number: string;
  hostel_id: string;
}

interface Hostel {
  id: string;
  name: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em',
  fontWeight: 800, opacity: 0.4, marginBottom: '1rem', display: 'block',
};

const StaffDashboard: React.FC = () => {
  const { ownerId, availableAccounts } = useOwner();
  const ownerName = availableAccounts.find(a => a.id === ownerId)?.name ?? 'Owner';

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['staff-payments', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment);
    },
  });

  const { data: beds = [], isLoading: bedsLoading } = useQuery({
    queryKey: ['staff-beds', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Bed);
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['staff-rooms', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Room);
    },
  });

  const { data: hostels = [] } = useQuery({
    queryKey: ['staff-hostels', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Hostel);
    },
  });

  const isLoading = paymentsLoading || bedsLoading;
  if (isLoading) return <LoadingScreen message="Loading workspace" />;

  // Derived data
  const pendingPayments = payments.filter(p => p.status === 'Pending' || p.status === 'Partial');
  const vacantBeds      = beds.filter(b => b.status === 'Vacant');

  const roomMap   = new Map(rooms.map(r => [r.id, r]));
  const hostelMap = new Map(hostels.map(h => [h.id, h.name]));

  // Group vacant beds by room
  const bedsByRoom = new Map<string, { hostelName: string; roomNumber: string; beds: Bed[] }>();
  vacantBeds.forEach(b => {
    const room = roomMap.get(b.room_id);
    const key  = b.room_id || b.hostel_id;
    if (!bedsByRoom.has(key)) {
      bedsByRoom.set(key, {
        hostelName:  hostelMap.get(b.hostel_id) ?? '—',
        roomNumber:  room?.room_number ?? '—',
        beds: [],
      });
    }
    bedsByRoom.get(key)!.beds.push(b);
  });

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* Staff banner header */}
      <div style={{
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '1.5rem',
        padding: '1.25rem 1.75rem',
        marginBottom: '2.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            background: 'rgba(245,158,11,0.15)',
            borderRadius: '0.625rem',
            padding: '0.375rem 0.75rem',
            fontSize: '0.6rem',
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#f59e0b',
          }}>
            Staff
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              Viewing <span style={{ color: '#f59e0b' }}>{ownerName}</span>
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.4, fontWeight: 500 }}>
              Read-only · Operational Snapshot
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            fontSize: '0.72rem', fontWeight: 700, opacity: 0.4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>payments</span>
            <span>{pendingPayments.length} pending</span>
          </div>
          <span style={{ opacity: 0.2 }}>·</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            fontSize: '0.72rem', fontWeight: 700, opacity: 0.4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>hotel</span>
            <span>{vacantBeds.length} vacant beds</span>
          </div>
        </div>
      </div>

      {/* ── Pending / Partial Payments ── */}
      <div className="modern-card" style={{ padding: '2rem 2.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={sectionLabel as React.CSSProperties}>
            Outstanding Rent
            {pendingPayments.length > 0 && (
              <span style={{
                marginLeft: '0.625rem',
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.6rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
              }}>
                {pendingPayments.length}
              </span>
            )}
          </span>
          {pendingPayments.length > 0 && (
            <Link
              to="/payments"
              style={{
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
                textDecoration: 'none', opacity: 0.7,
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              View all
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>arrow_forward</span>
            </Link>
          )}
        </div>

        {pendingPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.2 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2.25rem', display: 'block', marginBottom: '0.625rem' }}>check_circle</span>
            <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>All rent is up to date</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingPayments.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.875rem 1.125rem', borderRadius: '0.875rem',
                background: 'var(--surface-container-high)', gap: '1rem', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '0.625rem', flexShrink: 0,
                    background: p.status === 'Partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: '1rem',
                      color: p.status === 'Partial' ? '#f59e0b' : '#ef4444',
                    }}>
                      {p.status === 'Partial' ? 'hourglass_top' : 'warning'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.tenant_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.45, fontWeight: 500, marginTop: '0.15rem' }}>
                      {p.bed_number
                        ? `Bed ${p.bed_number}${p.room_number ? ` · Room ${p.room_number}` : ''}${p.hostel_name ? ` · ${p.hostel_name}` : ''}`
                        : '—'
                      }
                      {' · '}{p.month_for}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>
                    ₹{(p.amount ?? p.rent_amount).toLocaleString()}
                  </div>
                  <div style={{
                    fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: p.status === 'Partial' ? '#f59e0b' : '#ef4444',
                    marginTop: '0.2rem',
                  }}>
                    {p.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Vacant Beds ── */}
      <div className="modern-card" style={{ padding: '2rem 2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={sectionLabel as React.CSSProperties}>
            Vacant Beds
            {vacantBeds.length > 0 && (
              <span style={{
                marginLeft: '0.625rem',
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.6rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
              }}>
                {vacantBeds.length}
              </span>
            )}
          </span>
          {vacantBeds.length > 0 && (
            <Link
              to="/hostels"
              style={{
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
                textDecoration: 'none', opacity: 0.7,
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}
            >
              View hostels
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>arrow_forward</span>
            </Link>
          )}
        </div>

        {vacantBeds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', opacity: 0.2 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2.25rem', display: 'block', marginBottom: '0.625rem' }}>hotel</span>
            <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>No vacant beds</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...bedsByRoom.entries()].map(([roomKey, { hostelName, roomNumber, beds: roomBeds }]) => (
              <div key={roomKey} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '0.875rem 1.125rem', borderRadius: '0.875rem',
                background: 'var(--surface-container-high)',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '0.625rem', flexShrink: 0,
                  background: 'rgba(34,197,94,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#22c55e' }}>hotel</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                    Room {roomNumber}
                    <span style={{ opacity: 0.4, fontWeight: 500, fontSize: '0.8rem' }}> · {hostelName}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.5, fontWeight: 600, marginTop: '0.2rem' }}>
                    {roomBeds.map(b => `Bed ${b.bed_number}`).join(', ')}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '0.2rem 0.5rem', borderRadius: '999px',
                  }}>
                    {roomBeds.length} vacant
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StaffDashboard;
