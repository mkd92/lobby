-- ============================================================
-- AUTO-SYNC UNIT / BED STATUS BASED ON LEASE STATUS
-- Run this in your Supabase SQL editor
-- ============================================================

-- Trigger function: fires on INSERT, UPDATE(status), and DELETE of leases
CREATE OR REPLACE FUNCTION sync_occupancy_on_lease_change()
RETURNS TRIGGER AS $$
BEGIN

  IF TG_OP = 'DELETE' THEN
    -- Only free the unit/bed if the lease being deleted was Active
    IF OLD.status = 'Active' THEN
      IF OLD.unit_id IS NOT NULL THEN
        UPDATE public.units SET status = 'Vacant' WHERE id = OLD.unit_id;
      END IF;
      IF OLD.bed_id IS NOT NULL THEN
        UPDATE public.beds SET status = 'Occupied' WHERE id = OLD.bed_id;
        -- re-check: set Vacant only if no other active lease holds this bed
        UPDATE public.beds SET status = 'Vacant'
          WHERE id = OLD.bed_id
            AND NOT EXISTS (
              SELECT 1 FROM public.leases
              WHERE bed_id = OLD.bed_id AND status = 'Active' AND id != OLD.id
            );
      END IF;
      IF OLD.unit_id IS NOT NULL THEN
        UPDATE public.units SET status = 'Vacant'
          WHERE id = OLD.unit_id
            AND NOT EXISTS (
              SELECT 1 FROM public.leases
              WHERE unit_id = OLD.unit_id AND status = 'Active' AND id != OLD.id
            );
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  IF NEW.status = 'Active' THEN
    IF NEW.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'Occupied' WHERE id = NEW.unit_id;
    END IF;
    IF NEW.bed_id IS NOT NULL THEN
      UPDATE public.beds SET status = 'Occupied' WHERE id = NEW.bed_id;
    END IF;

  ELSIF NEW.status IN ('Expired', 'Terminated') THEN
    -- Only mark Vacant if no other active lease still holds this unit/bed
    IF NEW.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'Vacant'
        WHERE id = NEW.unit_id
          AND NOT EXISTS (
            SELECT 1 FROM public.leases
            WHERE unit_id = NEW.unit_id AND status = 'Active' AND id != NEW.id
          );
    END IF;
    IF NEW.bed_id IS NOT NULL THEN
      UPDATE public.beds SET status = 'Vacant'
        WHERE id = NEW.bed_id
          AND NOT EXISTS (
            SELECT 1 FROM public.leases
            WHERE bed_id = NEW.bed_id AND status = 'Active' AND id != NEW.id
          );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to leases
DROP TRIGGER IF EXISTS trg_sync_occupancy ON public.leases;

CREATE TRIGGER trg_sync_occupancy
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_occupancy_on_lease_change();

-- ============================================================
-- OPTIONAL: manually expire overdue leases
-- Can also be scheduled with pg_cron:
--   SELECT cron.schedule('expire-leases', '0 0 * * *', 'SELECT expire_overdue_leases()');
-- ============================================================
CREATE OR REPLACE FUNCTION expire_overdue_leases()
RETURNS integer AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.leases
  SET status = 'Expired'
  WHERE status = 'Active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
