import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';

interface OwnerContextType {
  user: User | null;
  ownerId: string | null;
  isStaff: boolean;
  ownerLoading: boolean;
}

const OwnerContext = createContext<OwnerContextType>({
  user: null, ownerId: null, isStaff: false, ownerLoading: true,
});

export const OwnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(true);

  // Sync auth state synchronously
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsub;
  }, []);

  // Resolve owner outside auth listener to avoid lock issues
  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      setOwnerId(null);
      setIsStaff(false);
      setOwnerLoading(false);
      return;
    }

    setOwnerLoading(true);

    const resolveOwner = async () => {
      try {
        // Check if this user is a staff member
        const staffSnap = await getDocs(
          query(collection(db, 'staff'), where('staff_email', '==', user.email))
        );

        if (!staffSnap.empty) {
          const staffData = staffSnap.docs[0].data();
          setOwnerId(staffData.owner_id);
          setIsStaff(true);
        } else {
          // Owner — ensure owner doc exists
          const ownerRef = doc(db, 'owners', user.uid);
          const ownerSnap = await getDoc(ownerRef);
          if (!ownerSnap.exists()) {
            await setDoc(ownerRef, {
              full_name: user.displayName || '',
              email: user.email || '',
              currency: 'USD',
            });
          }
          setOwnerId(user.uid);
          setIsStaff(false);
        }
      } catch (error) {
        console.error('OwnerContext error:', error);
      } finally {
        setOwnerLoading(false);
      }
    };

    resolveOwner();
  }, [user]);

  return (
    <OwnerContext.Provider value={{ user: user ?? null, ownerId, isStaff, ownerLoading }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
