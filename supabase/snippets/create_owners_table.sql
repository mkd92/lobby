-- 1. Create the owners table in the public schema
create table public.owners (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.owners enable row level security;

-- Create policies so owners can only manage their own profile
create policy "Owners can view their own profile."
  on public.owners for select
  using ( auth.uid() = id );

create policy "Owners can update their own profile."
  on public.owners for update
  using ( auth.uid() = id );

-- 3. Create a function to handle new user signups
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.owners (id, email, full_name)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- 4. Create a trigger that calls the function after a new user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
