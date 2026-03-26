-- ==========================================
-- 1. TENANTS TABLE
-- ==========================================
create table if not exists public.tenants (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.owners(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,

  document_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tenants enable row level security;

create policy "Owners can manage their own tenants."
  on public.tenants for all
  using ( auth.uid() = owner_id );

-- ==========================================
-- 2. LEASES TABLE (Links Units to Tenants)
-- ==========================================
create table if not exists public.leases (
  id uuid default gen_random_uuid() primary key,
  unit_id uuid references public.units(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  start_date date not null,
  end_date date,
  rent_amount numeric(10, 2) not null,
  security_deposit numeric(10, 2),
  status text check (status in ('Active', 'Expired', 'Terminated')) default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.leases enable row level security;

create policy "Owners can manage leases of their properties."
  on public.leases for all
  using (
    exists (
      select 1 from public.units
      join public.properties on public.units.property_id = public.properties.id
      where public.units.id = public.leases.unit_id
      and public.properties.owner_id = auth.uid()
    )
  );

-- ==========================================
-- 3. RENT PAYMENTS TABLE
-- ==========================================
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  lease_id uuid references public.leases(id) on delete cascade not null,
  amount numeric(10, 2) not null,
  payment_date date default current_date not null,
  month_for text not null, -- e.g. "October 2023"
  payment_method text check (payment_method in ('Cash', 'Bank Transfer', 'Online', 'Check')),
  status text check (status in ('Paid', 'Pending', 'Partial')) default 'Paid',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payments enable row level security;

create policy "Owners can manage payments of their leases."
  on public.payments for all
  using (
    exists (
      select 1 from public.leases
      join public.units on public.leases.unit_id = public.units.id
      join public.properties on public.units.property_id = public.properties.id
      where public.leases.id = public.payments.lease_id
      and public.properties.owner_id = auth.uid()
    )
  );

-- ==========================================
-- 4. MAINTENANCE REQUESTS TABLE
-- ==========================================
create table if not exists public.maintenance_requests (
  id uuid default gen_random_uuid() primary key,
  unit_id uuid references public.units(id) on delete cascade not null,
  title text not null,
  description text,
  priority text check (priority in ('Low', 'Medium', 'High', 'Urgent')) default 'Medium',
  status text check (status in ('Open', 'In Progress', 'Resolved', 'Closed')) default 'Open',
  cost numeric(10, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.maintenance_requests enable row level security;

create policy "Owners can manage maintenance of their properties."
  on public.maintenance_requests for all
  using (
    exists (
      select 1 from public.units
      join public.properties on public.units.property_id = public.properties.id
      where public.units.id = public.maintenance_requests.unit_id
      and public.properties.owner_id = auth.uid()
    )
  );
