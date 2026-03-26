-- ============================================================
-- AUTO-GENERATE MONTHLY PENDING RENT PAYMENTS
-- Run this in your Supabase SQL editor
-- ============================================================

-- Function: inserts a Pending payment for every active lease
-- that doesn't already have a regular payment for the current month.
-- Safe to call multiple times — the NOT EXISTS guard prevents duplicates.

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  month_label   text;
  month_start   date;
  rows_inserted integer;
BEGIN
  month_start  := date_trunc('month', CURRENT_DATE)::date;
  month_label  := to_char(CURRENT_DATE, 'FMMonth YYYY');  -- e.g. "March 2026"

  INSERT INTO public.payments (lease_id, amount, payment_date, month_for, status)
  SELECT
    l.id,
    l.rent_amount,
    month_start,
    month_label,
    'Pending'
  FROM public.leases l
  WHERE
    l.status = 'Active'
    -- lease has already started
    AND l.start_date <= CURRENT_DATE
    -- lease hasn't expired before this month
    AND (l.end_date IS NULL OR l.end_date >= month_start)
    -- no regular payment exists yet for this lease + month
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.lease_id = l.id
        AND p.month_for = month_label
    );

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RETURN rows_inserted;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION generate_monthly_rent_payments() TO authenticated;

-- ============================================================
-- OPTIONAL SCHEDULE: run at midnight on the 1st of every month
-- Requires pg_cron extension. To enable it in Supabase:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
-- Then run the lines below separately after enabling:
-- ============================================================
-- SELECT cron.schedule(
--   'generate-monthly-rent-payments',
--   '0 0 1 * *',
--   'SELECT generate_monthly_rent_payments()'
-- );
