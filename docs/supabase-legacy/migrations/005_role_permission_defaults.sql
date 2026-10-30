-- Role-based permission defaults
-- Stores default permissions for each role; used when assigning roles or applying templates

create table if not exists role_permission_defaults (
  role text primary key check (role in ('admin', 'cashier', 'developer')),
  permissions jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table role_permission_defaults enable row level security;

create policy "Developers can manage role defaults"
  on role_permission_defaults for all
  to authenticated
  using ((select role from profiles where id = auth.uid()) = 'developer')
  with check ((select role from profiles where id = auth.uid()) = 'developer');

create policy "Authenticated can read role defaults"
  on role_permission_defaults for select
  to authenticated
  using (true);

-- Seed: admin gets admin routes, cashier gets POS routes
insert into role_permission_defaults (role, permissions) values
  ('admin', '{"sales":true,"inventory":true,"history":true,"petty_cash":true,"day_end":true,"reports":true,"user_management":true,"shop_settings":true,"scale_file":true,"permissions":false,"data_retention":false,"system":false}'::jsonb),
  ('cashier', '{"sales":true,"inventory":true,"history":true,"petty_cash":true,"day_end":true,"reports":false,"user_management":false,"shop_settings":false,"scale_file":false,"permissions":false,"data_retention":false,"system":false}'::jsonb),
  ('developer', '{"sales":true,"inventory":true,"history":true,"petty_cash":true,"day_end":true,"reports":true,"user_management":true,"shop_settings":true,"scale_file":true,"permissions":true,"data_retention":true,"system":true}'::jsonb)
on conflict (role) do update set permissions = excluded.permissions, updated_at = now();
