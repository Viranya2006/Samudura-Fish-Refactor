-- Phase 4: Petty Cash and Day End

-- Petty cash transactions (add/withdraw from register)
create table if not exists petty_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null,
  reason text,
  created_at timestamptz not null default now()
);

-- Day end records (closing count and summary)
create table if not exists day_end_records (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references auth.users(id) on delete restrict,
  record_date date not null,
  opening_cash numeric(12,2) not null default 0,
  closing_cash numeric(12,2) not null,
  expected_cash numeric(12,2) not null,
  variance numeric(12,2) not null,
  total_sales numeric(12,2) not null default 0,
  cash_sales numeric(12,2) not null default 0,
  card_sales numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_petty_cash_created on petty_cash_transactions(created_at);
create index idx_day_end_date on day_end_records(record_date);

alter table petty_cash_transactions enable row level security;
alter table day_end_records enable row level security;

create policy "Authenticated users can manage petty_cash"
  on petty_cash_transactions for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage day_end"
  on day_end_records for all
  to authenticated
  using (true)
  with check (true);
