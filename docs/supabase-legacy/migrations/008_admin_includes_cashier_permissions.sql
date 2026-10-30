-- Admin role: include cashier (POS) permission flags alongside existing admin capabilities
update role_permission_defaults
set
  permissions = '{"sales":true,"inventory":true,"history":true,"petty_cash":true,"day_end":true,"reports":true,"user_management":true,"shop_settings":true,"scale_file":true,"permissions":false,"data_retention":false,"system":false}'::jsonb,
  updated_at = now()
where role = 'admin';
