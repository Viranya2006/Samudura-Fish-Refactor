-- RLS hardening — resolves Supabase "rls_disabled_in_public" warning.
--
-- Context: Supabase security flagged the project because several public-schema
-- tables had no explicit anon denial and used broad `using (true)` policies
-- that let any authenticated user read, UPDATE, and DELETE all rows.
--
-- This migration:
--   1. Revokes all access from the `anon` (public) role on every business table.
--   2. Grants access only to `authenticated`.
--   3. Replaces the broad "for all using (true)" policies on sensitive tables
--      with role-aware ones:
--        SELECT / INSERT  -> any authenticated user (cashiers need these)
--        UPDATE / DELETE  -> admin or developer only
--   4. Leaves profiles, products, shop_settings, role_permission_defaults as-is
--      (already role-scoped via is_admin_or_dev() / is_developer()).
--   5. Rebuilds the stock_levels view with security_invoker = on so the view
--      enforces RLS on its underlying tables (stock_purchases, sale_items,
--      stock_adjustments, products) rather than running with the owner's
--      privileges and silently bypassing RLS.
--
-- Safe to re-run (idempotent): every policy is dropped before recreate.
-- Works whether `001_initial_schema.sql` or `sql.sql` was the applied init
-- (drop policy if exists ignores the missing case).

-- ---------------------------------------------------------------------------
-- 1. Lock down the anon (public) role on every business table
-- ---------------------------------------------------------------------------

revoke all on public.profiles                   from anon;
revoke all on public.products                   from anon;
revoke all on public.shop_settings              from anon;
revoke all on public.sales                      from anon;
revoke all on public.sale_items                 from anon;
revoke all on public.petty_cash_transactions    from anon;
revoke all on public.day_end_records            from anon;
revoke all on public.stock_purchases            from anon;
revoke all on public.stock_adjustments          from anon;
revoke all on public.role_permission_defaults   from anon;
revoke all on public.stock_levels               from anon;

-- Ensure authenticated retains baseline access for SELECT; tighter policies below
-- control write operations. These grants are the floor; RLS is the real gate.
grant select on public.products                 to authenticated;
grant select on public.shop_settings            to authenticated;
grant select on public.stock_levels             to authenticated;
grant select on public.role_permission_defaults to authenticated;

-- Tables where authenticated users both read and write (subject to RLS policies):
grant select, insert, update, delete on public.sales                   to authenticated;
grant select, insert, update, delete on public.sale_items              to authenticated;
grant select, insert, update, delete on public.petty_cash_transactions to authenticated;
grant select, insert, update, delete on public.day_end_records         to authenticated;
grant select, insert, update, delete on public.stock_purchases         to authenticated;
grant select, insert, update, delete on public.stock_adjustments       to authenticated;
grant select, insert, update, delete on public.profiles               to authenticated;
grant select, insert, update, delete on public.products               to authenticated;
grant select, insert, update, delete on public.shop_settings          to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Role-aware policies for sensitive tables (replace broad using(true))
-- ---------------------------------------------------------------------------

-- ===================== sales =====================
drop policy if exists "Authenticated users can manage sales" on public.sales;

-- Anyone authenticated (cashier) can read sales (history, reports)
create policy "sales_select_authenticated"
  on public.sales for select
  to authenticated
  using (true);

-- Anyone authenticated (cashier) can create new sales
create policy "sales_insert_authenticated"
  on public.sales for insert
  to authenticated
  with check (true);

-- Only admin/dev can edit or void existing sales (audit integrity)
create policy "sales_update_admin_or_dev"
  on public.sales for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "sales_delete_admin_or_dev"
  on public.sales for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ===================== sale_items =====================
drop policy if exists "Authenticated users can manage sale_items" on public.sale_items;

create policy "sale_items_select_authenticated"
  on public.sale_items for select
  to authenticated
  using (true);

create policy "sale_items_insert_authenticated"
  on public.sale_items for insert
  to authenticated
  with check (true);

create policy "sale_items_update_admin_or_dev"
  on public.sale_items for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "sale_items_delete_admin_or_dev"
  on public.sale_items for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ===================== petty_cash_transactions =====================
drop policy if exists "Authenticated users can manage petty_cash" on public.petty_cash_transactions;

create policy "petty_cash_select_authenticated"
  on public.petty_cash_transactions for select
  to authenticated
  using (true);

create policy "petty_cash_insert_authenticated"
  on public.petty_cash_transactions for insert
  to authenticated
  with check (true);

create policy "petty_cash_update_admin_or_dev"
  on public.petty_cash_transactions for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "petty_cash_delete_admin_or_dev"
  on public.petty_cash_transactions for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ===================== day_end_records =====================
drop policy if exists "Authenticated users can manage day_end" on public.day_end_records;

create policy "day_end_select_authenticated"
  on public.day_end_records for select
  to authenticated
  using (true);

create policy "day_end_insert_authenticated"
  on public.day_end_records for insert
  to authenticated
  with check (true);

create policy "day_end_update_admin_or_dev"
  on public.day_end_records for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "day_end_delete_admin_or_dev"
  on public.day_end_records for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ===================== stock_purchases =====================
drop policy if exists "Authenticated users can manage stock_purchases" on public.stock_purchases;

create policy "stock_purchases_select_authenticated"
  on public.stock_purchases for select
  to authenticated
  using (true);

create policy "stock_purchases_insert_authenticated"
  on public.stock_purchases for insert
  to authenticated
  with check (true);

create policy "stock_purchases_update_admin_or_dev"
  on public.stock_purchases for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "stock_purchases_delete_admin_or_dev"
  on public.stock_purchases for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ===================== stock_adjustments =====================
drop policy if exists "Authenticated users can manage stock_adjustments" on public.stock_adjustments;

create policy "stock_adjustments_select_authenticated"
  on public.stock_adjustments for select
  to authenticated
  using (true);

create policy "stock_adjustments_insert_authenticated"
  on public.stock_adjustments for insert
  to authenticated
  with check (true);

create policy "stock_adjustments_update_admin_or_dev"
  on public.stock_adjustments for update
  to authenticated
  using (public.is_admin_or_dev())
  with check (public.is_admin_or_dev());

create policy "stock_adjustments_delete_admin_or_dev"
  on public.stock_adjustments for delete
  to authenticated
  using (public.is_admin_or_dev());

-- ---------------------------------------------------------------------------
-- 3. Verify RLS is enabled on every business table (no-op if already on)
-- ---------------------------------------------------------------------------

alter table public.profiles                 enable row level security;
alter table public.products                 enable row level security;
alter table public.shop_settings            enable row level security;
alter table public.sales                    enable row level security;
alter table public.sale_items               enable row level security;
alter table public.petty_cash_transactions  enable row level security;
alter table public.day_end_records          enable row level security;
alter table public.stock_purchases          enable row level security;
alter table public.stock_adjustments        enable row level security;
alter table public.role_permission_defaults enable row level security;

-- ---------------------------------------------------------------------------
-- 4. stock_levels view: enforce RLS via security_invoker = on
-- ---------------------------------------------------------------------------
-- Rebuilds the view defined in 006_stock_management.sql with
-- security_invoker = on. The view then runs with the querying user's
-- privileges, so RLS on stock_purchases / sale_items / stock_adjustments /
-- products is honored instead of being silently bypassed because the view
-- is owned by postgres. The SELECT body is identical to the original.

create or replace view public.stock_levels
with (security_invoker = on)
as
with purchases as (
  select product_id, sum(weight_kg)::numeric as purchased_kg
  from public.stock_purchases
  group by product_id
),
sold as (
  select si.product_id, sum(si.weight_kg)::numeric as sold_kg
  from public.sale_items si
  inner join public.sales s on s.id = si.sale_id and s.status = 'completed'
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
  from public.stock_adjustments
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
from public.products p
left join purchases pr on pr.product_id = p.id
left join sold s on s.product_id = p.id
left join adj a on a.product_id = p.id
where p.is_active = true;

-- Re-affirm the grant (create or replace preserves grants, but be explicit
-- in case the view was dropped+recreated by an earlier migration elsewhere).
grant select on public.stock_levels to authenticated;

