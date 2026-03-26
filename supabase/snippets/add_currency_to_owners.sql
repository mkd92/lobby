-- Add currency column to owners table
alter table public.owners 
add column if not exists currency text default 'USD' check (currency in ('USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'));
