import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface OwnerContextType {
  session: Session | null;
  ownerId: string | null;
  isStaff: boolean;
  ownerLoading: boolean;
}

const OwnerContext = createContext<OwnerContextType>({
  session: null, ownerId: null, isStaff: false, ownerLoading: true,
});

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (!newSession?.user) {
        setOwnerId(null);
        setIsStaff(false);
        setOwnerLoading(false);
        return;
      }

      setOwnerLoading(true);
      try {
        const { data: staffRecord } = await supabase
          .from('staff')
          .select('owner_id')
          .eq('staff_email', newSession.user.email)
          .maybeSingle();

        if (staffRecord?.owner_id) {
          setOwnerId(staffRecord.owner_id);
          setIsStaff(true);
        } else {
          setOwnerId(newSession.user.id);
          setIsStaff(false);
        }
      } catch (error) {
        console.error('OwnerContext error:', error);
      } finally {
        setOwnerLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <OwnerContext.Provider value={{ session, ownerId, isStaff, ownerLoading }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
