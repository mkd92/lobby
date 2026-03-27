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
  // undefined = not yet received from Supabase (waiting for INITIAL_SESSION)
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);

  // Synchronous-only listener — no async work inside, avoids Web Lock deadlock
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Resolve owner separately, outside the auth lock
  useEffect(() => {
    if (session === undefined) return; // waiting for INITIAL_SESSION

    if (!session?.user) {
      setOwnerId(null);
      setIsStaff(false);
      setOwnerLoading(false);
      return;
    }

    setOwnerLoading(true);

    supabase
      .from('staff')
      .select('owner_id')
      .eq('staff_email', session.user.email)
      .maybeSingle()
      .then(({ data: staffRecord }) => {
        if (staffRecord?.owner_id) {
          setOwnerId(staffRecord.owner_id);
          setIsStaff(true);
        } else {
          setOwnerId(session.user!.id);
          setIsStaff(false);
        }
      })
      .catch((error) => {
        console.error('OwnerContext error:', error);
      })
      .finally(() => {
        setOwnerLoading(false);
      });
  }, [session]);

  return (
    <OwnerContext.Provider value={{ session: session ?? null, ownerId, isStaff, ownerLoading }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
