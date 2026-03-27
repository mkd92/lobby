import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const currencySymbols: { [key: string]: string } = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
};

interface OwnerContextType {
  ownerId: string | null;
  isStaff: boolean;
  ownerLoading: boolean;
  currencySymbol: string;
}

const OwnerContext = createContext<OwnerContextType>({
  ownerId: null,
  isStaff: false,
  ownerLoading: true,
  currencySymbol: '$',
});

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const resolve = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setOwnerLoading(false); return; }

    // Run staff check and owner profile fetch in parallel
    const [staffResult, ownerResult] = await Promise.all([
      supabase.from('staff').select('owner_id').eq('staff_email', user.email).maybeSingle(),
      supabase.from('owners').select('currency').eq('id', user.id).maybeSingle(),
    ]);

    let resolvedOwnerId = user.id;
    if (staffResult.data?.owner_id) {
      resolvedOwnerId = staffResult.data.owner_id;
      setIsStaff(true);
    } else {
      setIsStaff(false);
    }
    setOwnerId(resolvedOwnerId);

    // If staff, fetch owner's currency; otherwise use what we already fetched
    let currency = ownerResult.data?.currency || 'USD';
    if (staffResult.data?.owner_id) {
      const { data: ownerData } = await supabase
        .from('owners').select('currency').eq('id', resolvedOwnerId).maybeSingle();
      currency = ownerData?.currency || 'USD';
    }
    setCurrencySymbol(currencySymbols[currency] || '$');
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
    <OwnerContext.Provider value={{ ownerId, isStaff, ownerLoading, currencySymbol }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
