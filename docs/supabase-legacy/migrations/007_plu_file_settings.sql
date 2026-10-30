-- PLU scale file path and price format (local print-service writes this file on inventory changes)
alter table public.shop_settings
  add column if not exists plu_file_path text not null default 'D:/PLU/plu.txt';

alter table public.shop_settings
  add column if not exists scale_price_format text not null default 'none';

alter table public.shop_settings
  add constraint shop_settings_scale_price_format_check
  check (scale_price_format in ('actual', 'none', 'zero'));
