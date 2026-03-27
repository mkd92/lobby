-- ==========================================
-- STAFF ACCESS SYSTEM
-- Run this entire file in Supabase SQL Editor
-- ==========================================


-- ── 1. Staff Table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id     uuid REFERENCES public.owners(id) ON DELETE CASCADE NOT NULL,
  staff_email  text NOT NULL,
  created_at   timestamp with time zone DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (owner_id, staff_email)
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Owner: full control over their own staff list
DROP POLICY IF EXISTS "Owners can manage their own staff." ON public.staff;
CREATE POLICY "Owners can manage their own staff."
  ON public.staff FOR ALL
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Staff: can read their own record so OwnerContext can resolve owner_id
DROP POLICY IF EXISTS "Staff can read their own record." ON public.staff;
CREATE POLICY "Staff can read their own record."
  ON public.staff FOR SELECT
  USING (staff_email = auth.email());


-- ── 2. Helper function ──────────────────────────────────────────────────────
-- Wrapping in (SELECT ...) in each policy causes PostgreSQL to evaluate
-- this STABLE function once per query (not once per row) — much faster.

CREATE OR REPLACE FUNCTION public.is_staff_of(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE owner_id    = p_owner_id
      AND staff_email = auth.email()
  );
$$;


-- ── 3. owners ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view their owner profile." ON public.owners;
CREATE POLICY "Staff can view their owner profile."
  ON public.owners FOR SELECT
  USING ((SELECT is_staff_of(id)));


-- ── 4. properties ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner properties." ON public.properties;
CREATE POLICY "Staff can view owner properties."
  ON public.properties FOR SELECT
  USING ((SELECT is_staff_of(owner_id)));


-- ── 5. units ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner units." ON public.units;
CREATE POLICY "Staff can view owner units."
  ON public.units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = units.property_id
        AND (SELECT is_staff_of(p.owner_id))
    )
  );


-- ── 6. tenants ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner tenants." ON public.tenants;
CREATE POLICY "Staff can view owner tenants."
  ON public.tenants FOR SELECT
  USING ((SELECT is_staff_of(owner_id)));


-- ── 7. hostels ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner hostels." ON public.hostels;
CREATE POLICY "Staff can view owner hostels."
  ON public.hostels FOR SELECT
  USING ((SELECT is_staff_of(owner_id)));


-- ── 8. rooms ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner rooms." ON public.rooms;
CREATE POLICY "Staff can view owner rooms."
  ON public.rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = rooms.hostel_id
        AND (SELECT is_staff_of(h.owner_id))
    )
  );


-- ── 9. beds ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner beds." ON public.beds;
CREATE POLICY "Staff can view owner beds."
  ON public.beds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.hostels h ON h.id = r.hostel_id
      WHERE r.id = beds.room_id
        AND (SELECT is_staff_of(h.owner_id))
    )
  );


-- ── 10. leases ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner leases." ON public.leases;
CREATE POLICY "Staff can view owner leases."
  ON public.leases FOR SELECT
  USING (
    (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      WHERE u.id = leases.unit_id
        AND (SELECT is_staff_of(p.owner_id))
    ))
    OR
    (bed_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.beds b
      JOIN public.rooms r ON r.id = b.room_id
      JOIN public.hostels h ON h.id = r.hostel_id
      WHERE b.id = leases.bed_id
        AND (SELECT is_staff_of(h.owner_id))
    ))
  );


-- ── 11. payments ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can view owner payments." ON public.payments;
CREATE POLICY "Staff can view owner payments."
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.units u ON u.id = l.unit_id
      JOIN public.properties p ON p.id = u.property_id
      WHERE l.id = payments.lease_id
        AND (SELECT is_staff_of(p.owner_id))
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.beds b ON b.id = l.bed_id
      JOIN public.rooms r ON r.id = b.room_id
      JOIN public.hostels h ON h.id = r.hostel_id
      WHERE l.id = payments.lease_id
        AND (SELECT is_staff_of(h.owner_id))
    )
  );
