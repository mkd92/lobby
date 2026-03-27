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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setOwnerLoading(false); return; }

      const { data: staffRecord } = await supabase
        .from('staff')
        .select('owner_id')
        .eq('staff_email', user.email)
        .maybeSingle();

      if (staffRecord?.owner_id) {
        setOwnerId(staffRecord.owner_id);
        setIsStaff(true);
      } else {
        setOwnerId(user.id);
        setIsStaff(false);
      }
    } catch (error) {
      console.error('OwnerContext resolve error:', error);
    } finally {
      setOwnerLoading(false);
    }
  };

  useEffect(() => {
    resolve();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setOwnerLoading(true);
        resolve();
      } else {
        setOwnerId(null);
        setIsStaff(false);
        setOwnerLoading(false);
      }
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
