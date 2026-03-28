import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { generateMonthlyPayments } from '../utils/generateMonthlyPayments';

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
      return;
    }

    setOwnerLoading(true);

    // Real-time listener on the staff collection for this email.
    // Fires immediately on mount (resolves initial state) and again whenever
    // the owner adds or revokes this user as staff — no re-login required.
    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('staff_email', '==', user.email)),
      async (staffSnap) => {
        try {
          if (!staffSnap.empty) {
            const staffDoc = staffSnap.docs[0];
            const staffData = staffDoc.data();
            const resolvedOwnerId = staffData.owner_id as string;

            setOwnerId(resolvedOwnerId);
            setIsStaff(true);

            // Auto-activate pending invite on first login
            if (staffData.status !== 'active') {
              await updateDoc(doc(db, 'staff', staffDoc.id), { status: 'active' });
            }

            void generateMonthlyPayments(resolvedOwnerId);
          } else {
            // No staff doc — treat as owner
            const ownerRef = doc(db, 'owners', user.uid);
            const ownerSnap = await getDoc(ownerRef);
            if (!ownerSnap.exists()) {
              await setDoc(ownerRef, {
                full_name: user.displayName || '',
                email: user.email || '',
                currency: 'USD',
              });
            }

            // If they were previously resolved as staff and just got revoked, sign out
            // so stale query caches don't leak the previous owner's data.
            setIsStaff(prev => {
              if (prev) {
                signOut(auth);
              }
              return false;
            });

            setOwnerId(user.uid);
            void generateMonthlyPayments(user.uid);
          }
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

  return (
    <OwnerContext.Provider value={{ user: user ?? null, ownerId, isStaff, ownerLoading }}>
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwner = () => useContext(OwnerContext);
