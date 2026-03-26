-- Create properties table
create table public.properties (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.owners(id) on delete cascade not null,
  name text not null,
  address text not null,
  type text check (type in ('Residential', 'Commercial', 'Industrial', 'Mixed')),
  image_url text,
  total_units integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.properties enable row level security;

-- Policies
create policy "Owners can view their own properties."
  on public.properties for select
  using ( auth.uid() = owner_id );

create policy "Owners can insert their own properties."
  on public.properties for insert
  with check ( auth.uid() = owner_id );

create policy "Owners can update their own properties."
  on public.properties for update
  using ( auth.uid() = owner_id );
