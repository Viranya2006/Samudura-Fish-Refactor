-- Samudura Fish Market POS - Initial Schema (FIXED)
-- Phase 1: profiles, products, shop_settings

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- User role enum (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'user_role'
  ) then
    create type user_role as enum ('developer', 'admin', 'cashier');
  end if;
end
$$;

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cashier',
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products table (fish catalog)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  plu_code varchar(10) unique not null,
  name_en varchar(255) not null,
  name_si varchar(255) not null,
  retail_price_per_kg numeric(10,2) not null default 0,
  wholesale_price_per_kg numeric(10,2) not null default 0,
  no_cut_discount_per_kg numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shop settings (configurable by admin/dev)
create table if not exists public.shop_settings (
  id uuid primary key default gen_random_uuid(),
  shop_name varchar(255) not null default 'Samudura Fish Market',
  shop_name_si varchar(255) not null default 'සමුදුර මත්ස්‍ය වෙළඳපොළ',
  address text,
  address_si text,
  phone varchar(20),
  logo_url text,
  receipt_footer text,
  receipt_footer_si text,
  data_retention_days int not null default 90,
  updated_at timestamptz not null default now()
);

-- Helper: get current user's role
create or replace function public.get_user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

-- Helper: check if user is admin or developer
create or replace function public.is_admin_or_dev()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'developer')
      and is_active = true
  );
$$;

-- Helper: check if user is developer
create or replace function public.is_developer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'developer'
      and is_active = true
  );
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.shop_settings enable row level security;

-- Drop old policies if they exist (to avoid duplicate policy errors on rerun)
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins and devs can read all profiles" on public.profiles;
drop policy if exists "Only developers can insert profiles" on public.profiles;
drop policy if exists "Only developers can update profiles" on public.profiles;

drop policy if exists "Authenticated users can read products" on public.products;
drop policy if exists "Admins and devs can insert products" on public.products;
drop policy if exists "Admins and devs can update products" on public.products;
drop policy if exists "Admins and devs can delete products" on public.products;

drop policy if exists "Authenticated users can read shop_settings" on public.shop_settings;
drop policy if exists "Admins and devs can update shop_settings" on public.shop_settings;
drop policy if exists "Admins and devs can insert shop_settings" on public.shop_settings;

-- Profiles policies
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Admins and devs can read all profiles"
  on public.profiles
  for select
  using (public.is_admin_or_dev());

create policy "Only developers can insert profiles"
  on public.profiles
  for insert
  with check (public.is_developer());

create policy "Only developers can update profiles"
  on public.profiles
  for update
  using (public.is_developer());

-- Products policies
create policy "Authenticated users can read products"
  on public.products
  for select
  to authenticated
  using (true);

create policy "Admins and devs can insert products"
  on public.products
  for insert
  to authenticated
  with check (public.is_admin_or_dev());

create policy "Admins and devs can update products"
  on public.products
  for update
  to authenticated
  using (public.is_admin_or_dev());

create policy "Admins and devs can delete products"
  on public.products
  for delete
  to authenticated
  using (public.is_admin_or_dev());

-- Shop settings policies
create policy "Authenticated users can read shop_settings"
  on public.shop_settings
  for select
  to authenticated
  using (true);

create policy "Admins and devs can update shop_settings"
  on public.shop_settings
  for update
  to authenticated
  using (public.is_admin_or_dev());

create policy "Admins and devs can insert shop_settings"
  on public.shop_settings
  for insert
  to authenticated
  with check (public.is_admin_or_dev());

-- Trigger function: auto-create profile on signup (FIXED)
-- Main fix: safe role parsing + validation before enum cast
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_role text;
  safe_role user_role;
begin
  incoming_role := lower(trim(coalesce(new.raw_user_meta_data->>'role', 'cashier')));

  if incoming_role in ('developer', 'admin', 'cashier') then
    safe_role := incoming_role::user_role;
  else
    safe_role := 'cashier'::user_role;
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    safe_role
  );

  return new;
end;
$$;

-- Recreate trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Seed: default shop settings (singleton row)
insert into public.shop_settings (shop_name, shop_name_si, data_retention_days)
select 'Samudura Fish Market', 'සමුදුර මත්ස්‍ය වෙළඳපොළ', 90
where not exists (select 1 from public.shop_settings);

-- Seed: sample products (upsert by plu_code)
insert into public.products (plu_code, name_en, name_si, retail_price_per_kg, wholesale_price_per_kg) values
  ('0040', 'Salaya', 'සාලය', 500.00, 450.00),
  ('0041', 'Kelawalla', 'කෙලවළ්ල', 650.00, 580.00),
  ('0042', 'Thalapath', 'තලපත්', 700.00, 620.00),
  ('0043', 'Thora', 'තෝරා', 550.00, 490.00),
  ('0044', 'Sardine', 'සාඩින්', 400.00, 360.00)
on conflict (plu_code) do update
set
  name_en = excluded.name_en,
  name_si = excluded.name_si,
  retail_price_per_kg = excluded.retail_price_per_kg,
  wholesale_price_per_kg = excluded.wholesale_price_per_kg,
  is_active = true,
  updated_at = now();