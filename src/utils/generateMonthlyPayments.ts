import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';

export interface GeneratePreview {
  toCreate: Array<{ tenant_name: string; unit: string; rent_amount: number }>;
  existing: number;
}

export async function previewMonthlyPayments(ownerId: string): Promise<GeneratePreview> {
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const leasesSnap = await getDocs(query(
    collection(db, 'leases'),
    where('owner_id', '==', ownerId),
    where('status', '==', 'Active')
  ));

  const toCreate: GeneratePreview['toCreate'] = [];
  let existing = 0;

  for (const leaseDoc of leasesSnap.docs) {
    const lease = leaseDoc.data();
    if (lease.start_date) {
      const [ly, lm] = (lease.start_date as string).split('-').map(Number);
      if (ly === today.getFullYear() && lm === today.getMonth() + 1) continue;
    }
    const existingSnap = await getDocs(query(
      collection(db, 'payments'),
      where('owner_id', '==', ownerId),
      where('lease_id', '==', leaseDoc.id),
      where('month_for', '==', currentMonth)
    ));
    if (existingSnap.empty) {
      const unit = lease.bed_number ? `Bed ${lease.bed_number}` : '—';
      toCreate.push({ tenant_name: lease.tenant_name || 'Unknown', unit, rent_amount: lease.rent_amount || 0 });
    } else {
      existing++;
    }
  }

  return { toCreate, existing };
}

export async function generateMonthlyPayments(ownerId: string): Promise<void> {
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const paymentDateStr = today.toISOString().split('T')[0];
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
      where('owner_id', '==', ownerId),
      where('lease_id', '==', leaseDoc.id),
      where('month_for', '==', currentMonth)
    ));
    // Skip leases that started this month — lease creation handles those explicitly
    if (lease.start_date) {
      const [ly, lm] = (lease.start_date as string).split('-').map(Number);
      if (ly === today.getFullYear() && lm === today.getMonth() + 1) continue;
    }

    if (existingSnap.empty) {
      // DUAL WRITE: Create legacy payment
      const newPaymentRef = doc(collection(db, 'payments'));
      const paymentData = {
        owner_id:       ownerId,
        lease_id:       leaseDoc.id,
        tenant_name:    lease.tenant_name || '',
        bed_number:     lease.bed_number || null,
        room_number:    lease.room_number || null,
        hostel_id:      lease.hostel_id || null,
        hostel_name:    lease.hostel_name || null,
        rent_amount:    lease.rent_amount,
        amount:         0,
        payment_date:   paymentDateStr,
        month_for:      currentMonth,
        payment_method: null,
        status:         'Pending',
        created_at:     serverTimestamp(),
      };
      batch.set(newPaymentRef, paymentData);

      // DUAL WRITE: Create Double-Entry Invoice
      const invoiceRef = doc(db, 'invoices', newPaymentRef.id);
      batch.set(invoiceRef, {
        owner_id: ownerId,
        lease_id: leaseDoc.id,
        tenant_name: lease.tenant_name || '',
        hostel_id: lease.hostel_id || null,
        month_for: currentMonth,
        amount: lease.rent_amount || 0,
        due_date: paymentDateStr,
        status: 'Pending',
        legacy_payment_id: newPaymentRef.id,
        created_at: serverTimestamp(),
      });

      // DUAL WRITE: Create Invoice Journal Entry (Debit 1200 A/R, Credit 4000 Revenue)
      const invJeRef = doc(collection(db, 'journal_entries'));
      batch.set(invJeRef, {
        owner_id: ownerId,
        date: paymentDateStr,
        description: `Rent Billed for ${currentMonth} - ${lease.tenant_name || 'Unknown'}`,
        reference_type: 'Invoice',
        reference_id: invoiceRef.id,
        debit_account_code: '1200', // A/R
        credit_account_code: '4000', // Rental Revenue
        amount: lease.rent_amount || 0,
        created_at: serverTimestamp(),
      });

      hasChanges = true;
    }
  }

  if (hasChanges) await batch.commit();

  // Mark this month as done so we don't re-run until next month
  localStorage.setItem(storageKey, currentMonth);
}
