-- Cut / no-cut per-kg discount (replaces today-only promo)

alter table products
  add column if not exists no_cut_discount_per_kg numeric(10,2) not null default 0;

alter table products
  drop column if exists promo_discount_type,
  drop column if exists promo_discount_value,
  drop column if exists promo_valid_date;

alter table sale_items
  add column if not exists is_cut boolean not null default true,
  add column if not exists line_discount numeric(12,2) not null default 0;
