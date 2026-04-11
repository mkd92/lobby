export interface Account {
  id: string;
  owner_id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  description?: string;
  created_at: any;
}

export interface Invoice {
  id: string;
  owner_id: string;
  lease_id: string;
  tenant_name: string;
  month_for: string;
  amount: number;
  due_date: string;
  status: 'Pending' | 'Partial' | 'Paid' | 'Voided';
  legacy_payment_id?: string; // Links back to legacy payments collection during migration
  created_at: any;
}

export interface Receipt {
  id: string;
  owner_id: string;
  invoice_id: string | null; // Can be null if it's an unapplied payment
  tenant_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  legacy_transaction_id?: string;
  created_at: any;
}

export interface JournalEntry {
  id: string;
  owner_id: string;
  date: string;
  description: string;
  reference_type: 'Invoice' | 'Receipt' | 'Expense' | 'Manual';
  reference_id: string;
  debit_account_code: string;
  credit_account_code: string;
  amount: number;
  created_at: any;
}
