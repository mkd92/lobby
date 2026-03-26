-- ==========================================
-- HOSTEL FRAMEWORK SCHEMA
-- ==========================================

-- 1. Hostels Table
create table if not exists public.hostels (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.owners(id) on delete cascade not null,
  name text not null,
  address text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.hostels enable row level security;

create policy "Owners can manage their own hostels."
  on public.hostels for all using ( auth.uid() = owner_id );

-- 2. Rooms Table (Hostel -> Rooms)
create table if not exists public.rooms (
  id uuid default gen_random_uuid() primary key,
  hostel_id uuid references public.hostels(id) on delete cascade not null,
  room_number text not null,
  floor integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rooms enable row level security;

create policy "Owners can manage rooms of their hostels."
  on public.rooms for all using (
    exists (
      select 1 from public.hostels
      where public.hostels.id = public.rooms.hostel_id
      and public.hostels.owner_id = auth.uid()
    )
  );

-- 3. Beds Table (Room -> Beds)
create table if not exists public.beds (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  bed_number text not null,
  price numeric(10, 2) not null,
  status text check (status in ('Vacant', 'Occupied', 'Maintenance')) default 'Vacant',
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.beds enable row level security;

create policy "Owners can manage beds of their rooms."
  on public.beds for all using (
    exists (
      select 1 from public.rooms
      join public.hostels on public.rooms.hostel_id = public.hostels.id
      where public.rooms.id = public.beds.room_id
      and public.hostels.owner_id = auth.uid()
    )
  );
