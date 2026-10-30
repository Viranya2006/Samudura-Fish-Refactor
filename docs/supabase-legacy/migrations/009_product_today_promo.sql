-- Per-product "today only" retail promo (end-of-day discounts)

alter table products
  add column if not exists promo_discount_type text
    check (promo_discount_type is null or promo_discount_type in ('percentage', 'fixed_per_kg')),
  add column if not exists promo_discount_value numeric(10,2) not null default 0,
  add column if not exists promo_valid_date date;
