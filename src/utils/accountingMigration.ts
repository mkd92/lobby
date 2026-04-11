import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

export const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash/Bank', type: 'Asset' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
  { code: '4000', name: 'Rental Revenue', type: 'Revenue' },
] as const;

export async function ensureChartOfAccounts(ownerId: string) {
  const accountsRef = collection(db, 'accounts');
  const snap = await getDocs(query(accountsRef, where('owner_id', '==', ownerId)));
  
  if (snap.empty) {
    const batch = writeBatch(db);
    for (const acc of DEFAULT_ACCOUNTS) {
      const newRef = doc(collection(db, 'accounts'));
      batch.set(newRef, {
        owner_id: ownerId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        created_at: serverTimestamp()
      });
    }
    await batch.commit();
  }
}

export async function runAccountingMigration(ownerId: string) {
  await ensureChartOfAccounts(ownerId);

  const paymentsSnap = await getDocs(query(
    collection(db, 'payments'),
    where('owner_id', '==', ownerId)
  ));

  let batch = writeBatch(db);
  let opCount = 0;

  const commitBatch = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  const addOp = async () => {
    opCount++;
    if (opCount >= 400) { // Firestore batch limit is 500, play it safe
      await commitBatch();
    }
  };

  for (const pDoc of paymentsSnap.docs) {
    const p = pDoc.data();
    const invoiceId = pDoc.id; // Using payment ID as invoice ID for simplicity

    // Create Invoice
    const invRef = doc(db, 'invoices', invoiceId);
    const invSnap = await getDoc(invRef);

    if (!invSnap.exists()) {
      batch.set(invRef, {
        owner_id: ownerId,
        lease_id: p.lease_id || '',
        tenant_name: p.tenant_name || '',
        hostel_id: p.hostel_id || null,
        hostel_name: p.hostel_name || null,
        month_for: p.month_for || '',
        amount: p.rent_amount || 0,
        due_date: p.payment_date || new Date().toISOString().split('T')[0],
        status: p.status || 'Pending',
        legacy_payment_id: pDoc.id,
        created_at: p.created_at || serverTimestamp(),
      });
      await addOp();

      // Invoice Journal Entry (Debit A/R, Credit Revenue)
      const invJeRef = doc(collection(db, 'journal_entries'));
      batch.set(invJeRef, {
        owner_id: ownerId,
        date: p.payment_date || new Date().toISOString().split('T')[0],
        description: `Rent Billed for ${p.month_for} - ${p.tenant_name}`,
        reference_type: 'Invoice',
        reference_id: invoiceId,
        debit_account_code: '1200',
        credit_account_code: '4000',
        amount: p.rent_amount || 0,
        created_at: p.created_at || serverTimestamp(),
      });
      await addOp();
    }

    // Process Receipts (Transactions)
    const txSnap = await getDocs(collection(db, 'payments', pDoc.id, 'transactions'));
    
    if (txSnap.empty && p.amount > 0) {
      // Fallback: create a single receipt if there's paid amount but no transactions
      const receiptId = `rect_${pDoc.id}`;
      const rectRef = doc(db, 'receipts', receiptId);
      const rectSnap = await getDoc(rectRef);

      if (!rectSnap.exists()) {
        batch.set(rectRef, {
          owner_id: ownerId,
          invoice_id: invoiceId,
          tenant_name: p.tenant_name || '',
          amount: p.amount,
          payment_date: p.payment_date || new Date().toISOString().split('T')[0],
          payment_method: p.payment_method || 'Unknown',
          legacy_transaction_id: pDoc.id, // Linking to parent payment
          created_at: p.updated_at || serverTimestamp(),
        });
        await addOp();

        // Receipt Journal Entry (Debit Cash, Credit A/R)
        const rectJeRef = doc(collection(db, 'journal_entries'));
        batch.set(rectJeRef, {
          owner_id: ownerId,
          date: p.payment_date || new Date().toISOString().split('T')[0],
          description: `Payment Received - ${p.tenant_name}`,
          reference_type: 'Receipt',
          reference_id: receiptId,
          debit_account_code: '1000',
          credit_account_code: '1200',
          amount: p.amount,
          created_at: p.updated_at || serverTimestamp(),
        });
        await addOp();
      }
    } else if (!txSnap.empty) {
      for (const txDoc of txSnap.docs) {
        const tx = txDoc.data();
        const receiptId = txDoc.id;
        const rectRef = doc(db, 'receipts', receiptId);
        const rectSnap = await getDoc(rectRef);

        if (!rectSnap.exists()) {
          batch.set(rectRef, {
            owner_id: ownerId,
            invoice_id: invoiceId,
            tenant_name: p.tenant_name || '',
            amount: tx.amount || 0,
            payment_date: tx.payment_date || p.payment_date || new Date().toISOString().split('T')[0],
            payment_method: tx.payment_method || p.payment_method || 'Unknown',
            legacy_transaction_id: receiptId,
            created_at: tx.recorded_at || serverTimestamp(),
          });
          await addOp();

          // Receipt Journal Entry (Debit Cash, Credit A/R)
          const rectJeRef = doc(collection(db, 'journal_entries'));
          batch.set(rectJeRef, {
            owner_id: ownerId,
            date: tx.payment_date || p.payment_date || new Date().toISOString().split('T')[0],
            description: `Payment Received - ${p.tenant_name}`,
            reference_type: 'Receipt',
            reference_id: receiptId,
            debit_account_code: '1000',
            credit_account_code: '1200',
            amount: tx.amount || 0,
            created_at: tx.recorded_at || serverTimestamp(),
          });
          await addOp();
        }
      }
    }
  }

  await commitBatch();
  return { success: true, message: 'Migration completed.' };
}
