-- Stock management: purchases, adjustments, min stock, levels view

-- Minimum stock threshold per product (kg)
alter table products
  add column if not exists min_stock_kg numeric(10,4) not null default 0;

create type stock_adjustment_reason as enum (
  'waste',
  'freezer_in',
  'freezer_out',
  'damage',
  'other'
);

create table if not exists stock_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  purchase_date date not null default (timezone('utc', now()))::date,
  weight_kg numeric(10,4) not null check (weight_kg > 0),
  cost_per_kg numeric(10,2) not null check (cost_per_kg >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  supplier text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_purchases_product on stock_purchases(product_id);
create index if not exists idx_stock_purchases_date on stock_purchases(purchase_date);

create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  adjustment_date date not null default (timezone('utc', now()))::date,
  weight_kg numeric(10,4) not null check (weight_kg > 0),
  reason stock_adjustment_reason not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_adjustments_product on stock_adjustments(product_id);
create index if not exists idx_stock_adjustments_date on stock_adjustments(adjustment_date);

-- Aggregated stock per product (lifetime / all-time basis for simplicity)
create or replace view stock_levels as
with purchases as (
  select product_id, sum(weight_kg)::numeric as purchased_kg
  from stock_purchases
  group by product_id
),
sold as (
  select si.product_id, sum(si.weight_kg)::numeric as sold_kg
  from sale_items si
  inner join sales s on s.id = si.sale_id and s.status = 'completed'
  group by si.product_id
),
adj as (
  select
    product_id,
    sum(
      case when reason in ('waste', 'damage', 'other') then weight_kg else 0 end
    )::numeric as loss_kg,
    sum(case when reason = 'freezer_in' then weight_kg else 0 end)::numeric as freezer_in_kg,
    sum(case when reason = 'freezer_out' then weight_kg else 0 end)::numeric as freezer_out_kg
  from stock_adjustments
  group by product_id
)
select
  p.id as product_id,
  p.plu_code,
  p.name_en,
  p.name_si,
  p.min_stock_kg,
  coalesce(pr.purchased_kg, 0) as purchased_kg,
  coalesce(s.sold_kg, 0) as sold_kg,
  coalesce(a.loss_kg, 0) as adjustment_loss_kg,
  coalesce(a.freezer_in_kg, 0) as freezer_in_kg,
  coalesce(a.freezer_out_kg, 0) as freezer_out_kg,
  (
    coalesce(pr.purchased_kg, 0)
    - coalesce(s.sold_kg, 0)
    - coalesce(a.loss_kg, 0)
    - coalesce(a.freezer_in_kg, 0)
    + coalesce(a.freezer_out_kg, 0)
  )::numeric(12,4) as fresh_available_kg,
  (
    coalesce(a.freezer_in_kg, 0) - coalesce(a.freezer_out_kg, 0)
  )::numeric(12,4) as freezer_kg
from products p
left join purchases pr on pr.product_id = p.id
left join sold s on s.product_id = p.id
left join adj a on a.product_id = p.id
where p.is_active = true;

alter table stock_purchases enable row level security;
alter table stock_adjustments enable row level security;

create policy "Authenticated users can manage stock_purchases"
  on stock_purchases for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage stock_adjustments"
  on stock_adjustments for all
  to authenticated
  using (true)
  with check (true);

grant select on stock_levels to authenticated;
