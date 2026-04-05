import React from 'react';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../firebaseClient';
import { useOwner } from '../../context/OwnerContext';

export const InvitesNotification: React.FC = () => {
  const { user } = useOwner();
  const queryClient = useQueryClient();

  const { data: pendingInvites = [], refetch } = useQuery({
    queryKey: ['pending-invites', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const q = query(collection(db, 'staff'), where('staff_email', '==', user?.email), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
  });

  const handleAccept = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'staff', inviteId), { status: 'active' });
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      refetch();
    } catch (err) {
      console.error('Failed to accept invite:', err);
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'staff', inviteId));
      refetch();
    } catch (err) {
      console.error('Failed to decline invite:', err);
    }
  };

  if (pendingInvites.length === 0) return null;

  // Show the first pending invite as a modal; rest wait in queue
  const invite = pendingInvites[0] as any;

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 998,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}>
        <div style={{
          background: 'var(--surface-container)',
          borderRadius: '2rem',
          padding: '2.5rem',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          border: '1px solid var(--outline-variant)',
          animation: 'dialogFadeIn 0.25s ease-out',
        }}>
          {/* Icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '1.25rem',
            background: 'var(--surface-container-high)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>mark_email_unread</span>
          </div>

          {/* Content */}
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: '1.375rem', marginBottom: '0.625rem', lineHeight: 1.2,
          }}>
            Workspace Invitation
          </h3>
          <p style={{ fontSize: '0.875rem', opacity: 0.6, lineHeight: 1.6, marginBottom: '0.25rem' }}>
            <strong style={{ opacity: 1, color: 'var(--on-surface)' }}>
              {invite.owner_name || 'A workspace owner'}
            </strong>{' '}
            has invited you to access their portfolio as a read-only viewer.
          </p>
          <p style={{ fontSize: '0.75rem', opacity: 0.35, marginBottom: '2rem', fontWeight: 500 }}>
            You can view all properties, leases, and payments — but cannot make any changes.
          </p>

          {/* Queue indicator */}
          {pendingInvites.length > 1 && (
            <p style={{ fontSize: '0.7rem', opacity: 0.4, marginBottom: '1.25rem', fontWeight: 600 }}>
              +{pendingInvites.length - 1} more invite{pendingInvites.length - 1 > 1 ? 's' : ''} waiting
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => handleDecline(invite.id)}
              style={{
                padding: '0.875rem 1.25rem', borderRadius: '1rem',
                border: 'none', background: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)', fontWeight: 700,
                fontSize: '0.8125rem', cursor: 'pointer', transition: 'opacity 0.15s',
              }}
            >
              Decline
            </button>
            <button
              onClick={() => handleAccept(invite.id)}
              className="primary-button"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Accept Access
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
