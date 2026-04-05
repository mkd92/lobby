import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface StaffMember {
  id: string;
  staff_email: string;
  status: 'active' | 'pending';
}

const Team: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();

  const [staffEmail,  setStaffEmail]  = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  const [message,     setMessage]     = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId && !isStaff,
  });

  const { data: staffList = [], refetch: refetchStaff } = useQuery({
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
        created_at: serverTimestamp(),
      });
      setStaffEmail('');
      refetchStaff();
      queryClient.invalidateQueries({ queryKey: ['staff-list', ownerId] });
      flash("Invite sent. They'll see a notification next time they open Lobby.", 'success');
    } catch (err) {
      flash((err as Error).message, 'error');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRevokeStaff = async (staffId: string) => {
    try {
      await deleteDoc(doc(db, 'staff', staffId));
      refetchStaff();
      flash('Access revoked.', 'success');
    } catch (err) {
      flash((err as Error).message, 'error');
    }
  };

  // ── Access denied for staff ───────────────────────────────────────────────

  if (isStaff) {
    return (
      <div className="view-container" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', paddingTop: '5rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '3.5rem', opacity: 0.12, display: 'block', marginBottom: '1rem' }}>lock</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.375rem', marginBottom: '0.5rem' }}>
          Owner Access Only
        </h2>
        <p style={{ opacity: 0.4, fontSize: '0.875rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Team management is only available to workspace owners.<br />You have read-only access to this workspace.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '1rem', background: 'var(--surface-container-high)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: 'var(--on-surface)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
          Go Back
        </button>
      </div>
    );
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em',
    fontWeight: 800, opacity: 0.4, marginBottom: '1rem', display: 'block',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="view-container" style={{ maxWidth: '720px', margin: '0 auto' }}>

      {/* Header */}
      <header className="view-header">
        <p className="view-eyebrow">Access Management</p>
        <h1 className="view-title">Team & Access</h1>
        <p style={{ opacity: 0.45, fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 500 }}>
          Invite stakeholders to view your portfolio. They get read-only access to all data.
        </p>
      </header>

      {/* Flash message */}
      {message && (
        <div style={{
          marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '1.25rem',
          background: message.type === 'success' ? 'var(--surface-container-high)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${message.type === 'success' ? 'var(--outline-variant)' : 'rgba(239,68,68,0.25)'}`,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          color: message.type === 'success' ? 'var(--on-surface)' : '#ef4444',
          fontWeight: 600, fontSize: '0.875rem',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', flexShrink: 0 }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {message.text}
        </div>
      )}

      {/* Invite card */}
      <div className="modern-card" style={{ padding: '2rem 2.5rem', marginBottom: '1.25rem' }}>
        <span style={sectionLabel}>Invite Stakeholder</span>
        <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={staffEmail}
            onChange={e => setStaffEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            style={{
              flex: 1, minWidth: '220px',
              padding: '0.875rem 1.25rem', borderRadius: '1rem',
              background: 'var(--surface-container-high)',
              border: '1.5px solid var(--outline-variant)',
              color: 'var(--on-surface)', fontSize: '0.9375rem', fontWeight: 500, outline: 'none',
            }}
          />
          <button type="submit" className="primary-button" disabled={addingStaff} style={{ whiteSpace: 'nowrap' }}>
            {addingStaff ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        <p style={{ fontSize: '0.75rem', opacity: 0.35, marginTop: '0.875rem', fontWeight: 500 }}>
          They'll receive an in-app notification to accept or decline your invitation.
        </p>
      </div>

      {/* Team members */}
      <div className="modern-card" style={{ padding: '2rem 2.5rem' }}>
        <span style={sectionLabel}>
          Team Members{staffList.length > 0 ? ` · ${staffList.length}` : ''}
        </span>

        {staffList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.25 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>group</span>
            <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No team members yet</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Invite someone above to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {staffList.map(s => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1rem 1.25rem', borderRadius: '1rem',
                background: 'var(--surface-container-high)', gap: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '0.75rem',
                    background: 'var(--surface-container-highest)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', opacity: 0.35 }}>person</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.staff_email}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                        background: s.status === 'active' ? '#22c55e' : '#f59e0b',
                      }} />
                      <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, opacity: 0.45 }}>
                        {s.status === 'active' ? 'Active · Read-Only' : 'Invite Pending'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeStaff(s.id)}
                  title="Revoke access"
                  style={{
                    padding: '0.5rem 0.625rem', borderRadius: '0.625rem',
                    border: 'none', background: 'var(--surface-container-highest)',
                    cursor: 'pointer', color: 'var(--error)',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person_remove</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '1.75rem', paddingTop: '1.5rem',
          borderTop: '1px solid var(--outline-variant)',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem', opacity: 0.35,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.05rem' }}>shield</span>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.5 }}>
            Staff can view all properties, leases, payments, and customers — but cannot create, edit, or delete any records.
          </p>
        </div>
      </div>

    </div>
  );
};

export default Team;
