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
  role: 'owner' | 'manager' | 'viewer';
}

interface OwnerContextType {
  user: User | null;
  ownerId: string | null;
  userRole: 'owner' | 'manager' | 'viewer';
  ownerLoading: boolean;
  availableAccounts: Account[];
  switchAccount: (id: string) => void;
}

const OwnerContext = createContext<OwnerContextType>({
  user: null, ownerId: null, userRole: 'viewer', ownerLoading: true,
  availableAccounts: [], switchAccount: () => {},
});

const STORAGE_KEY = 'selectedOwnerId';

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'viewer'>('viewer');
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
      setUserRole('viewer');
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
            { id: user.uid, name: ownName, isOwn: true, role: 'owner' },
            ...activeStaffDocs.map(d => {
              const data = d.data();
              return { 
                id: data.owner_id as string, 
                name: data.owner_name || 'Unknown', 
                isOwn: false,
                role: (data.role as 'manager' | 'viewer') || 'viewer'
              };
            }),
          ];
          setAvailableAccounts(accounts);

          // Ensure staff_lookup entries exist for every active staff membership.
          // This acts as a migration for staff who accepted before the lookup
          // collection was introduced — without it Firestore rules deny reads.
          await Promise.all(
            activeStaffDocs.map(async (staffDoc) => {
              const data = staffDoc.data();
              const ownerId = data.owner_id as string;
              const role = data.role as string || 'viewer';
              const lookupRef = doc(db, 'staff_lookup', user.uid, 'owners', ownerId);
              const lookupSnap = await getDoc(lookupRef);
              if (!lookupSnap.exists() || !lookupSnap.data()?.role) {
                await setDoc(lookupRef, { role }, { merge: true });
              }
            }),
          );

          // Determine which account to activate
          const saved = localStorage.getItem(STORAGE_KEY);
          const validSaved = saved && accounts.some(a => a.id === saved) ? saved : null;
          const active = accounts.find(a => a.id === (validSaved || user.uid)) || accounts[0];

          setOwnerId(active.id);
          setUserRole(active.role);
          if (active.role === 'owner' || active.role === 'manager') {
            void generateMonthlyPayments(active.id);
          }
        } catch (error) {
          console.error('OwnerContext error:', error);
          setOwnerId(user.uid);
          setUserRole('owner');
        } finally {
          setOwnerLoading(false);
        }
      },
      (error) => {
        console.error('OwnerContext snapshot error:', error);
        setOwnerId(user.uid);
        setUserRole('owner');
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
    setUserRole(account.role);
    if (account.role === 'owner' || account.role === 'manager') {
      void generateMonthlyPayments(id);
    }
  };

  return (
    <OwnerContext.Provider value={{ user: user ?? null, ownerId, userRole, ownerLoading, availableAccounts, switchAccount }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
