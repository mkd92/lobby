import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, setDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';

interface StaffMember {
  id: string;
  staff_email: string;
  staff_uid?: string;
  status: 'active' | 'pending';
  role?: 'manager' | 'viewer';
}

interface PendingInvite {
  id: string;
  owner_id: string;
  owner_name: string;
  staff_email: string;
  status: string;
  role?: 'manager' | 'viewer';
}

const Team: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, userRole, user, switchAccount } = useOwner();
  const isStaff = userRole !== 'owner';
  const queryClient = useQueryClient();

  const [staffEmail,  setStaffEmail]  = useState('');
  const [inviteRole,  setInviteRole]  = useState<'viewer' | 'manager'>('viewer');
  const [addingStaff, setAddingStaff] = useState(false);
  const [message,     setMessage]     = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  // Pending invites sent to the current user
  const { data: pendingInvites = [], refetch: refetchInvites, isLoading: invitesLoading } = useQuery({
    queryKey: ['pending-invites', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'staff'),
        where('staff_email', '==', user!.email),
        where('status', '==', 'pending'),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PendingInvite[];
    },
  });

  // Owner's staff list (only loaded when not a staff viewer)
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId && !isStaff,
  });

  const { data: staffList = [], refetch: refetchStaff, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-list', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'staff'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[];
    },
    enabled: !!ownerId && !isStaff,
  });

  const flash = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(null), 4000);
  };

  const handleAcceptInvite = async (invite: PendingInvite) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'staff', invite.id), {
        status: 'active',
        staff_uid: user.uid,
      });
      await setDoc(
        doc(db, 'staff_lookup', user.uid, 'owners', invite.owner_id),
        { accepted_at: serverTimestamp(), role: invite.role ?? 'viewer' },
      );
      refetchInvites();
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      switchAccount(invite.owner_id);
      navigate('/');
    } catch (err) {
      flash((err as Error).message, 'error');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'staff', inviteId));
      refetchInvites();
      flash('Invitation declined.', 'success');
    } catch (err) {
      flash((err as Error).message, 'error');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !ownerId) return;
    setAddingStaff(true);
    try {
      const exists = await getDocs(query(
        collection(db, 'staff'),
        where('staff_email', '==', staffEmail),
        where('owner_id', '==', ownerId),
      ));
      if (!exists.empty) throw new Error('This email already has access or a pending invite.');
      await addDoc(collection(db, 'staff'), {
        staff_email: staffEmail,
        owner_id: ownerId,
        owner_name: ownerProfile?.name || '',
        status: 'pending',
        role: inviteRole,
        created_at: serverTimestamp(),
      });
      setStaffEmail('');
      setInviteRole('viewer');
      refetchStaff();
      queryClient.invalidateQueries({ queryKey: ['staff-list', ownerId] });
      flash("Invite sent. They'll see it on their Team page.", 'success');
    } catch (err) {
      flash((err as Error).message, 'error');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRevokeStaff = async (s: StaffMember) => {
    try {
      if (s.staff_uid && ownerId) {
        await deleteDoc(doc(db, 'staff_lookup', s.staff_uid, 'owners', ownerId));
      }
      await deleteDoc(doc(db, 'staff', s.id));
      refetchStaff();
      flash('Access revoked.', 'success');
    } catch (err) {
      flash((err as Error).message, 'error');
    }
  };

  if (invitesLoading || (ownerId && !isStaff && staffLoading)) return <LoadingScreen message="Accessing Personnel Registry" />;

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '800px' }}>

      {/* Header */}
      <header className="view-header">
        <p className="view-eyebrow">Access Management</p>
        <h1 className="view-title text-4xl md:text-6xl">Team & Access</h1>
        <p className="text-on-surface-variant mt-4 font-medium max-w-xl">
          {isStaff
            ? 'Review workspace invitations sent to you by facility owners.'
            : 'Invite stakeholders to collaborate. Assign roles to manage inventory or monitor performance.'}
        </p>
      </header>

      {/* Flash message */}
      {message && (
        <div className={`modern-card mb-8 py-4 flex items-center gap-4 ${message.type === 'success' ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'}`}>
          <span className="material-symbols-outlined" style={{ color: message.type === 'success' ? 'var(--color-success)' : 'var(--error)' }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{message.text}</span>
        </div>
      )}

      {/* Pending invitations for this user */}
      {pendingInvites.length > 0 && (
        <div className="modern-card mb-12" style={{ border: '1px solid var(--color-warning)', background: 'rgba(245,158,11,0.02)' }}>
          <div className="view-eyebrow mb-6" style={{ color: 'var(--color-warning)', opacity: 1 }}>Pending Invitations</div>
          <div className="flex flex-col gap-4">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="modern-card" style={{ padding: '1.25rem', background: 'var(--surface-container-high)' }}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-warning)', fontSize: '1.25rem' }}>mark_email_unread</span>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{invite.owner_name || 'Organization Owner'}</div>
                      <div className="text-on-surface-variant text-sm font-medium">Invited you as {invite.role || 'viewer'}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => handleDeclineInvite(invite.id)} className="primary-button" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface)', flex: 1 }}>Decline</button>
                    <button onClick={() => handleAcceptInvite(invite)} className="primary-button" style={{ flex: 1 }}>Accept</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner management */}
      {!isStaff && (
        <div className="grid grid-cols-1 gap-8">
          {/* Invite form */}
          <div className="modern-card">
            <div className="view-eyebrow mb-6">Authorize Colleague</div>
            <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-4">
              <div style={{ flex: 2 }}>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={e => setStaffEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  style={{ width: '100%', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', color: 'var(--on-surface)', fontWeight: 600 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  style={{ width: '100%', background: 'var(--surface-container-high)', border: '1px solid var(--outline-variant)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', color: 'var(--on-surface)', fontWeight: 600, cursor: 'pointer' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <button type="submit" className="primary-button" disabled={addingStaff}>
                {addingStaff ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
            <p className="text-on-surface-variant text-xs mt-4 font-medium opacity-60">Recipient will receive a secure notification within their Team dashboard.</p>
          </div>

          {/* Personnel list */}
          <div className="modern-card">
            <div className="view-eyebrow mb-8">Authorized Personnel</div>
            {staffList.length === 0 ? (
              <div className="py-12 text-center opacity-30">
                <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>supervisor_account</span>
                <p className="mt-4 font-bold">No registered personnel</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {staffList.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined opacity-40">person</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-on-surface truncate">{s.staff_email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge-modern ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.55rem', padding: '0.1rem 0.4rem' }}>
                            {s.status}
                          </span>
                          <span className="view-eyebrow" style={{ fontSize: '0.55rem', margin: 0 }}>{s.role || 'viewer'}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRevokeStaff(s)} className="btn-icon danger opacity-0 group-hover:opacity-100 transition-opacity" title="Revoke access">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>person_remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-10 pt-8 border-t border-white/5 flex gap-4">
              <span className="material-symbols-outlined text-on-surface-variant opacity-40" style={{ fontSize: '1.25rem' }}>shield</span>
              <p className="text-on-surface-variant text-xs leading-relaxed font-medium">
                <strong>Access Control:</strong> Viewers maintain read-only privileges across the portfolio. Managers are authorized to initialize new inventory and agreements but cannot modify historical ledger records.
              </p>
            </div>
          </div>
        </div>
      )}

      {isStaff && pendingInvites.length === 0 && (
        <div className="modern-card py-20 text-center">
          <span className="material-symbols-outlined opacity-10" style={{ fontSize: '4rem' }}>verified_user</span>
          <h2 className="text-xl font-bold mt-6">Registry Verified</h2>
          <p className="text-on-surface-variant mt-2">No pending workspace invitations identified.</p>
        </div>
      )}
    </div>
  );
};

export default Team;
