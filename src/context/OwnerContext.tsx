import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { generateMonthlyPayments } from '../utils/generateMonthlyPayments';

export interface Account {
  id: string;
  name: string;
  isOwn: boolean;
}

interface OwnerContextType {
  user: User | null;
  ownerId: string | null;
  isStaff: boolean;
  ownerLoading: boolean;
  availableAccounts: Account[];
  switchAccount: (id: string) => void;
}

const OwnerContext = createContext<OwnerContextType>({
  user: null, ownerId: null, isStaff: false, ownerLoading: true,
  availableAccounts: [], switchAccount: () => {},
});

const STORAGE_KEY = 'selectedOwnerId';

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      setOwnerId(null);
      setIsStaff(false);
      setOwnerLoading(false);
      setAvailableAccounts([]);
      return;
    }

    setOwnerLoading(true);

    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('staff_email', '==', user.email), where('status', '==', 'active')),
      async (staffSnap) => {
        try {
          // Ensure own owner doc exists
          const ownerRef = doc(db, 'owners', user.uid);
          const ownerSnap = await getDoc(ownerRef);
          if (!ownerSnap.exists()) {
            await setDoc(ownerRef, {
              full_name: user.displayName || '',
              email: user.email || '',
              currency: 'USD',
            });
          }
          const ownName = ownerSnap.data()?.full_name || user.displayName || user.email || 'My Account';

          // Build accounts list: own account first, then staff accounts
          const accounts: Account[] = [
            { id: user.uid, name: ownName, isOwn: true },
            ...staffSnap.docs.map(d => {
              const data = d.data();
              return { id: data.owner_id as string, name: data.owner_name || 'Unknown', isOwn: false };
            }),
          ];
          setAvailableAccounts(accounts);

          // Determine which account to activate
          const saved = localStorage.getItem(STORAGE_KEY);
          const validSaved = saved && accounts.some(a => a.id === saved) ? saved : null;
          const active = accounts.find(a => a.id === (validSaved || user.uid)) || accounts[0];

          setOwnerId(active.id);
          setIsStaff(!active.isOwn);
          void generateMonthlyPayments(active.id);
        } catch (error) {
          console.error('OwnerContext error:', error);
          setOwnerId(user.uid);
          setIsStaff(false);
        } finally {
          setOwnerLoading(false);
        }
      },
      (error) => {
        console.error('OwnerContext snapshot error:', error);
        setOwnerId(user.uid);
        setIsStaff(false);
        setOwnerLoading(false);
      }
    );

    return () => unsubStaff();
  }, [user]);

  const switchAccount = (id: string) => {
    const account = availableAccounts.find(a => a.id === id);
    if (!account) return;
    localStorage.setItem(STORAGE_KEY, id);
    setOwnerId(id);
    setIsStaff(!account.isOwn);
    void generateMonthlyPayments(id);
  };

  return (
    <OwnerContext.Provider value={{ user: user ?? null, ownerId, isStaff, ownerLoading, availableAccounts, switchAccount }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
