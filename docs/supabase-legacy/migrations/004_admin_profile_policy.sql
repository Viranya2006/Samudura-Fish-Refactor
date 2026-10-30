-- Phase 5: Allow admins to update cashier profiles (role, is_active)
-- Developers keep full update access; admins can manage cashiers only.

drop policy if exists "Only developers can update profiles" on profiles;

-- Developers can update any profile
create policy "Developers can update all profiles"
  on profiles for update
  to authenticated
  using (is_developer())
  with check (is_developer());

-- Admins can update cashier profiles only (role, is_active)
create policy "Admins can update cashier profiles"
  on profiles for update
  to authenticated
  using (
    is_admin_or_dev()
    and not is_developer()
    and (select role from profiles where id = profiles.id) = 'cashier'
  )
  with check (
    (select role from profiles where id = profiles.id) = 'cashier'
  );
