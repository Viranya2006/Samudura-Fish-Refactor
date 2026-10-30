-- Phase 2: Sales and sale_items tables

create type sale_type as enum ('retail', 'wholesale');
create type payment_method as enum ('cash', 'card');
create type sale_status as enum ('completed', 'held', 'voided');

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number varchar(50) unique not null,
  cashier_id uuid not null references auth.users(id) on delete restrict,
  sale_type sale_type not null default 'retail',
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  discount_type varchar(20),
  total numeric(12,2) not null default 0,
  payment_method payment_method,
  cash_received numeric(12,2),
  change_given numeric(12,2),
  status sale_status not null default 'completed',
  terminal_id varchar(50),
  synced boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  weight_kg numeric(10,4) not null,
  price_per_kg numeric(10,2) not null,
  line_total numeric(12,2) not null,
  barcode_raw varchar(20),
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_sales_cashier on sales(cashier_id);
create index idx_sales_created on sales(created_at);
create index idx_sales_status on sales(status);
create index idx_sale_items_sale on sale_items(sale_id);

alter table sales enable row level security;
alter table sale_items enable row level security;

-- Authenticated users can read/write sales (cashiers need to create)
create policy "Authenticated users can manage sales"
  on sales for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage sale_items"
  on sale_items for all
  to authenticated
  using (true)
  with check (true);
