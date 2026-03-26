-- Create units table
create table if not exists public.units (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  unit_number text not null,
  floor integer,
  type text check (type in ('Studio', '1BHK', '2BHK', '3BHK', 'Office', 'Retail', 'Warehouse')),
  status text check (status in ('Vacant', 'Occupied', 'Maintenance')) default 'Vacant',
  base_rent numeric(10, 2),
  area_sqft integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.units enable row level security;

-- Policies: Owners can manage units of their own properties
create policy "Owners can view units of their properties."
  on public.units for select
  using (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );

create policy "Owners can insert units for their properties."
  on public.units for insert
  with check (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );

create policy "Owners can update units of their properties."
  on public.units for update
  using (
    exists (
      select 1 from public.properties
      where public.properties.id = public.units.property_id
      and public.properties.owner_id = auth.uid()
    )
  );
