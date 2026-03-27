import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface OwnerContextType {
  ownerId: string | null;
  isStaff: boolean;
  ownerLoading: boolean;
}

const OwnerContext = createContext<OwnerContextType>({ ownerId: null, isStaff: false, ownerLoading: true });

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);

  const resolve = async () => {
    // getSession reads from localStorage — instant, no network call
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setOwnerLoading(false); return; }

    const { data: staffRecord } = await supabase
      .from('staff')
      .select('owner_id')
      .eq('staff_email', session.user.email)
      .maybeSingle();

    if (staffRecord?.owner_id) {
      setOwnerId(staffRecord.owner_id);
      setIsStaff(true);
    } else {
      setOwnerId(session.user.id);
      setIsStaff(false);
    }
    setOwnerLoading(false);
  };

  useEffect(() => {
    resolve();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setOwnerLoading(true);
      resolve();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <OwnerContext.Provider value={{ ownerId, isStaff, ownerLoading }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
