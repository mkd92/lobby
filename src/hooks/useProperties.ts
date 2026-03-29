import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';

export interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  unitCount?: number;
}

export const useProperties = () => {
  const { ownerId } = useOwner();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const [propSnap, unitSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId))),
      ]);

      const unitCounts: Record<string, number> = {};
      unitSnap.docs.forEach(d => {
        const pid = d.data().property_id;
        if (pid) unitCounts[pid] = (unitCounts[pid] || 0) + 1;
      });

      const props: Property[] = propSnap.docs
        .map(d => ({ id: d.id, ...d.data(), unitCount: unitCounts[d.id] || 0 } as Property))
        .sort((a, b) => a.name.localeCompare(b.name));

      return props;
    },
  });

  const saveProperty = async (propertyId: string, data: Partial<Property>) => {
    await updateDoc(doc(db, 'properties', propertyId), data);
    queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
  };

  const removeProperty = async (propertyId: string) => {
    await deleteDoc(doc(db, 'properties', propertyId));
    queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
  };

  const checkOccupiedUnits = async (propertyId: string) => {
    const unitSnap = await getDocs(
      query(collection(db, 'units'), where('property_id', '==', propertyId), where('status', '==', 'Occupied'))
    );
    return unitSnap.size;
  };

  return {
    properties,
    isLoading,
    saveProperty,
    removeProperty,
    checkOccupiedUnits,
  };
};
