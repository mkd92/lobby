import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';

export async function generateMonthlyPayments(ownerId: string): Promise<void> {
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const storageKey = `payment_gen_${ownerId}`;

  // Only run once per calendar month per owner
  if (localStorage.getItem(storageKey) === currentMonth) return;

  const leasesSnap = await getDocs(query(
    collection(db, 'leases'),
    where('owner_id', '==', ownerId),
    where('status', '==', 'Active')
  ));

  const batch = writeBatch(db);
  let hasChanges = false;

  for (const leaseDoc of leasesSnap.docs) {
    const lease = leaseDoc.data();
    const existingSnap = await getDocs(query(
      collection(db, 'payments'),
      where('lease_id', '==', leaseDoc.id),
      where('month_for', '==', currentMonth)
    ));
    // Skip leases that started this month — lease creation handles those explicitly
    if (lease.start_date) {
      const [ly, lm] = (lease.start_date as string).split('-').map(Number);
      if (ly === today.getFullYear() && lm === today.getMonth() + 1) continue;
    }

    if (existingSnap.empty) {
      batch.set(doc(collection(db, 'payments')), {
        owner_id:       ownerId,
        lease_id:       leaseDoc.id,
        tenant_name:    lease.tenant_name || '',
        unit_number:    lease.unit_number || null,
        property_name:  lease.property_name || null,
        bed_number:     lease.bed_number || null,
        room_number:    lease.room_number || null,
        hostel_name:    lease.hostel_name || null,
        rent_amount:    lease.rent_amount,
        amount:         lease.rent_amount,
        payment_date:   today.toISOString().split('T')[0],
        month_for:      currentMonth,
        payment_method: null,
        status:         'Pending',
        created_at:     serverTimestamp(),
      });
      hasChanges = true;
    }
  }

  if (hasChanges) await batch.commit();

  // Mark this month as done so we don't re-run until next month
  localStorage.setItem(storageKey, currentMonth);
}
