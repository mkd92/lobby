-- ==========================================
-- EXTEND LEASES TABLE TO SUPPORT HOSTEL BEDS
-- Run this in your Supabase SQL editor
-- ==========================================

-- 1. Make unit_id nullable (leases can now belong to a bed instead)
ALTER TABLE public.leases
  ALTER COLUMN unit_id DROP NOT NULL;

-- 2. Add optional bed_id FK
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS bed_id uuid references public.beds(id) on delete cascade;

-- 3. Add optional notes column
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS notes text;


-- 4. Constraint: exactly one of unit_id or bed_id must be set
ALTER TABLE public.leases
  ADD CONSTRAINT leases_one_target CHECK (
    (unit_id IS NOT NULL AND bed_id IS NULL) OR
    (unit_id IS NULL AND bed_id IS NOT NULL)
  );

-- 5. Update leases RLS policy to also allow bed-based leases
DROP POLICY IF EXISTS "Owners can manage leases of their properties." ON public.leases;

CREATE POLICY "Owners can manage leases."
  ON public.leases FOR ALL
  USING (
    (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.units
      JOIN public.properties ON public.units.property_id = public.properties.id
      WHERE public.units.id = public.leases.unit_id
        AND public.properties.owner_id = auth.uid()
    ))
    OR
    (bed_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.beds
      JOIN public.rooms ON public.beds.room_id = public.rooms.id
      JOIN public.hostels ON public.rooms.hostel_id = public.hostels.id
      WHERE public.beds.id = public.leases.bed_id
        AND public.hostels.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    (unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.units
      JOIN public.properties ON public.units.property_id = public.properties.id
      WHERE public.units.id = public.leases.unit_id
        AND public.properties.owner_id = auth.uid()
    ))
    OR
    (bed_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.beds
      JOIN public.rooms ON public.beds.room_id = public.rooms.id
      JOIN public.hostels ON public.rooms.hostel_id = public.hostels.id
      WHERE public.beds.id = public.leases.bed_id
        AND public.hostels.owner_id = auth.uid()
    ))
  );

-- 6. Update payments RLS policy to handle both unit-based and bed-based leases
--    The original policy only joined through unit→property, which breaks when unit_id is NULL
DROP POLICY IF EXISTS "Owners can manage payments of their leases." ON public.payments;

CREATE POLICY "Owners can manage payments of their leases."
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      JOIN public.units ON public.leases.unit_id = public.units.id
      JOIN public.properties ON public.units.property_id = public.properties.id
      WHERE public.leases.id = public.payments.lease_id
        AND public.properties.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leases
      JOIN public.beds ON public.leases.bed_id = public.beds.id
      JOIN public.rooms ON public.beds.room_id = public.rooms.id
      JOIN public.hostels ON public.rooms.hostel_id = public.hostels.id
      WHERE public.leases.id = public.payments.lease_id
        AND public.hostels.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases
      JOIN public.units ON public.leases.unit_id = public.units.id
      JOIN public.properties ON public.units.property_id = public.properties.id
      WHERE public.leases.id = public.payments.lease_id
        AND public.properties.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.leases
      JOIN public.beds ON public.leases.bed_id = public.beds.id
      JOIN public.rooms ON public.beds.room_id = public.rooms.id
      JOIN public.hostels ON public.rooms.hostel_id = public.hostels.id
      WHERE public.leases.id = public.payments.lease_id
        AND public.hostels.owner_id = auth.uid()
    )
  );
