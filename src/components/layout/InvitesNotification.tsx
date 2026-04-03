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

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-500">
      {pendingInvites.map((invite: any) => (
        <div key={invite.id} className="glass-panel p-6 rounded-[32px] border border-primary/20 shadow-2xl bg-surface/90 backdrop-blur-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary">mail</span>
            </div>
            <div className="flex-1">
              <h4 className="text-white font-display font-bold text-lg tracking-tight">Access Invitation</h4>
              <p className="text-secondary/60 text-xs font-medium mt-1 leading-relaxed">
                <span className="text-primary font-bold">{invite.owner_name || 'An entity'}</span> has requested your secondary stakeholder oversight for their registry.
              </p>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => handleAccept(invite.id)}
                  className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-black uppercase tracking-widest text-[0.6rem] hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  Accept Authorization
                </button>
                <button 
                  onClick={() => handleDecline(invite.id)}
                  className="px-4 py-3 rounded-xl bg-surface-container-low text-secondary/40 font-bold uppercase tracking-widest text-[0.6rem] hover:text-error transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
