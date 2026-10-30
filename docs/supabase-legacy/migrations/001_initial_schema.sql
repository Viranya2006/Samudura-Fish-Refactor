-- Samudura Fish Market POS - Initial Schema
-- Phase 1: profiles, products, shop_settings

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User role enum
create type user_role as enum ('developer', 'admin', 'cashier');

-- Profiles table (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cashier',
  permissions jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products table (fish catalog)
create table products (
  id uuid primary key default gen_random_uuid(),
  plu_code varchar(10) unique not null,
  name_en varchar(255) not null,
  name_si varchar(255) not null,
  retail_price_per_kg decimal(10,2) not null default 0,
  wholesale_price_per_kg decimal(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shop settings (configurable by admin/dev)
create table shop_settings (
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
create or replace function get_user_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper: check if user is admin or developer
create or replace function is_admin_or_dev()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'developer')
    and is_active = true
  );
$$ language sql security definer stable;

-- Helper: check if user is developer
create or replace function is_developer()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'developer'
    and is_active = true
  );
$$ language sql security definer stable;

-- Row Level Security: profiles
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admins and devs can read all profiles"
  on profiles for select
  using (is_admin_or_dev());

create policy "Only developers can insert profiles"
  on profiles for insert
  with check (is_developer());

create policy "Only developers can update profiles"
  on profiles for update
  using (is_developer());

-- Row Level Security: products
alter table products enable row level security;

create policy "Authenticated users can read products"
  on products for select
  to authenticated
  using (true);

create policy "Admins and devs can insert products"
  on products for insert
  to authenticated
  with check (is_admin_or_dev());

create policy "Admins and devs can update products"
  on products for update
  to authenticated
  using (is_admin_or_dev());

create policy "Admins and devs can delete products"
  on products for delete
  to authenticated
  using (is_admin_or_dev());

-- Row Level Security: shop_settings
alter table shop_settings enable row level security;

create policy "Authenticated users can read shop_settings"
  on shop_settings for select
  to authenticated
  using (true);

create policy "Admins and devs can update shop_settings"
  on shop_settings for update
  to authenticated
  using (is_admin_or_dev());

create policy "Admins and devs can insert shop_settings"
  on shop_settings for insert
  to authenticated
  with check (is_admin_or_dev());

-- Trigger: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cashier')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Seed: default shop settings (singleton row)
insert into shop_settings (shop_name, shop_name_si, data_retention_days)
values ('Samudura Fish Market', 'සමුදුර මත්ස්‍ය වෙළඳපොළ', 90);

-- Seed: sample products
insert into products (plu_code, name_en, name_si, retail_price_per_kg, wholesale_price_per_kg) values
  ('0040', 'Salaya', 'සාලය', 500.00, 450.00),
  ('0041', 'Kelawalla', 'කෙලවළ්ල', 650.00, 580.00),
  ('0042', 'Thalapath', 'තලපත්', 700.00, 620.00),
  ('0043', 'Thora', 'තෝරා', 550.00, 490.00),
  ('0044', 'Sardine', 'සාඩින්', 400.00, 360.00);
