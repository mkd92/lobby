import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const QUERY_OPTS = { staleTime: 0, refetchInterval: 60_000 };

const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, userRole, availableAccounts } = useOwner();
  const ownerName = availableAccounts.find(a => a.id === ownerId)?.name ?? 'Owner';
  const isManager = userRole === 'manager';

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['staff-payments', ownerId],
    enabled: !!ownerId,
    ...QUERY_OPTS,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment);
    },
  });

  const { data: beds = [], isLoading: bedsLoading } = useQuery({
    queryKey: ['staff-beds', ownerId],
    enabled: !!ownerId,
    ...QUERY_OPTS,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Bed);
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['staff-rooms', ownerId],
    enabled: !!ownerId,
    ...QUERY_OPTS,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Room);
    },
  });

  const { data: hostels = [] } = useQuery({
    queryKey: ['staff-hostels', ownerId],
    enabled: !!ownerId,
    ...QUERY_OPTS,
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Hostel);
    },
  });

  const isLoading = paymentsLoading || bedsLoading;
  if (isLoading) return <LoadingScreen message="Compiling Operational Intelligence" />;

  const pendingPayments = payments.filter(p => p.status === 'Pending' || p.status === 'Partial');
  const vacantBeds      = beds.filter(b => b.status === 'Vacant');

  const roomMap   = new Map(rooms.map(r => [r.id, r]));
  const hostelMap = new Map(hostels.map(h => [h.id, h.name]));

  const bedsByRoom = new Map<string, { hostelName: string; roomNumber: string; beds: Bed[] }>();
  vacantBeds.forEach(b => {
    const room = roomMap.get(b.room_id);
    const key  = b.room_id || b.hostel_id;
    if (!bedsByRoom.has(key)) {
      bedsByRoom.set(key, {
        hostelName: hostelMap.get(b.hostel_id) ?? '—',
        roomNumber: room?.room_number ?? '—',
        beds: [],
      });
    }
    bedsByRoom.get(key)!.beds.push(b);
  });

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '1200px' }}>

      {/* Staff Banner */}
      <div className="modern-card mb-8" style={{ border: '1px solid var(--color-warning)', background: 'rgba(245,158,11,0.02)', padding: '1.5rem 2rem' }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-warning)', fontSize: '1.25rem' }}>verified_user</span>
            </div>
            <div>
              <div className="view-eyebrow mb-1" style={{ color: 'var(--color-warning)', opacity: 1 }}>Authenticated Session</div>
              <div className="font-bold text-lg">Operating for <span style={{ color: 'var(--on-surface)' }}>{ownerName}</span></div>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <div className="view-eyebrow mb-1">Access Tier</div>
              <div className="font-bold text-sm uppercase tracking-widest">{userRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Manager Actions */}
      {isManager && (
        <div className="flex flex-wrap gap-4 mb-12">
          <button onClick={() => navigate('/customers/new')} className="primary-button" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>person_add</span>
            Identify Tenant
          </button>
          <button onClick={() => navigate('/leases/new')} className="primary-button" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>description</span>
            Establish Lease
          </button>
          <button onClick={() => navigate('/payments')} className="primary-button" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>payments</span>
            Verify Receipts
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Outstanding Arrears */}
        <div className="modern-card">
          <div className="flex justify-between items-center mb-10">
            <div className="view-eyebrow" style={{ margin: 0 }}>Outstanding Arrears</div>
            {pendingPayments.length > 0 && <span className="badge-modern badge-error">{pendingPayments.length} Active</span>}
          </div>

          {pendingPayments.length === 0 ? (
            <div className="py-12 text-center opacity-20">
              <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>check_circle</span>
              <p className="mt-4 font-bold">Ledger fully settled</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingPayments.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-on-surface truncate">{p.tenant_name}</div>
                    <div className="flex items-center gap-2 mt-1 opacity-50 text-[0.7rem] font-bold uppercase tracking-wider">
                      {p.month_for} · Rm {p.room_number || '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-on-surface">₹{(p.amount ?? p.rent_amount).toLocaleString()}</div>
                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: p.status === 'Partial' ? 'var(--color-warning)' : 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.status}</span>
                  </div>
                </div>
              ))}
              {pendingPayments.length > 10 && (
                <Link to="/payments" className="text-center py-3 text-xs font-bold text-primary hover:underline mt-2">
                  View {pendingPayments.length - 10} additional arrears
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Unit Availability */}
        <div className="modern-card">
          <div className="flex justify-between items-center mb-10">
            <div className="view-eyebrow" style={{ margin: 0 }}>Unit Availability</div>
            <span className="badge-modern badge-success">{vacantBeds.length} Vacant</span>
          </div>

          {vacantBeds.length === 0 ? (
            <div className="py-12 text-center opacity-20">
              <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>hotel</span>
              <p className="mt-4 font-bold">Facility fully occupied</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[...bedsByRoom.entries()].slice(0, 10).map(([roomKey, { hostelName, roomNumber, beds: roomBeds }]) => (
                <div key={roomKey} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="min-w-0">
                    <div className="font-bold text-on-surface">Room {roomNumber}</div>
                    <div className="text-[0.7rem] font-bold opacity-40 uppercase tracking-wider mt-1">{hostelName}</div>
                  </div>
                  <div className="flex gap-2">
                    {roomBeds.map(b => (
                      <span key={b.id} className="badge-modern" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', fontSize: '0.6rem' }}>
                        Bed {b.bed_number}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {bedsByRoom.size > 10 && (
                <Link to="/hostels" className="text-center py-3 text-xs font-bold text-primary hover:underline mt-2">
                  View all available inventory
                </Link>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StaffDashboard;
