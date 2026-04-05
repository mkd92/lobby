import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
      // Single where clause — two-field compound queries require a composite
      // index that may not exist, causing a silent failure. Filter status
      // client-side instead so the snapshot always fires correctly.
      query(collection(db, 'staff'), where('staff_email', '==', user.email)),
      async (staffSnap) => {
        // Only consider accepted (active) memberships
        const activeStaffDocs = staffSnap.docs.filter(d => d.data().status === 'active');
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

          // Build accounts list: own account first, then active staff accounts
          const accounts: Account[] = [
            { id: user.uid, name: ownName, isOwn: true },
            ...activeStaffDocs.map(d => {
              const data = d.data();
              return { id: data.owner_id as string, name: data.owner_name || 'Unknown', isOwn: false };
            }),
          ];
          setAvailableAccounts(accounts);

          // Ensure staff_lookup entries exist for every active staff membership.
          // This acts as a migration for staff who accepted before the lookup
          // collection was introduced — without it Firestore rules deny reads.
          await Promise.all(
            activeStaffDocs.map(async (staffDoc) => {
              const ownerId = staffDoc.data().owner_id as string;
              const lookupRef = doc(db, 'staff_lookup', user.uid, 'owners', ownerId);
              const lookupSnap = await getDoc(lookupRef);
              if (!lookupSnap.exists()) {
                await setDoc(lookupRef, { migrated_at: serverTimestamp() });
              }
            }),
          );

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
