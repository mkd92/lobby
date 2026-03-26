-- ==========================================
-- 1. OWNERS TABLE & AUTH TRIGGER
-- ==========================================

-- Create the owners table
create table if not exists public.owners (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.owners enable row level security;

-- Policies
create policy "Owners can view their own profile."
  on public.owners for select
  using ( auth.uid() = id );

create policy "Owners can update their own profile."
  on public.owners for update
  using ( auth.uid() = id );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.owners (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- Trigger for new users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 2. PROPERTIES TABLE
-- ==========================================

-- Create properties table
create table if not exists public.properties (
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
