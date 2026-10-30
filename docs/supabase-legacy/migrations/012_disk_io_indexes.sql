-- 012_disk_io_indexes.sql
-- Optimizes Disk IO and prevents high burst balance consumption on Supabase.

-- 1. Index sale_items(product_id) to eliminate sequential scans in:
--    - stock_levels view (lifetime sold_kg aggregation)
--    - Sales by Product report
--    - Foreign key checks
CREATE INDEX IF NOT EXISTS idx_sale_items_product 
  ON public.sale_items(product_id);

-- 2. Composite index on sale_items(sale_id, product_id) for fast batch item lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product 
  ON public.sale_items(sale_id, product_id);

-- 3. Composite index on sales(status, created_at DESC)
--    Optimizes dashboard today's sales, history list, and sales date-range reports
CREATE INDEX IF NOT EXISTS idx_sales_status_created 
  ON public.sales(status, created_at DESC);

-- 4. Foreign key index on petty_cash_transactions(cashier_id)
CREATE INDEX IF NOT EXISTS idx_petty_cash_cashier 
  ON public.petty_cash_transactions(cashier_id);

-- 5. Foreign key index on day_end_records(cashier_id)
CREATE INDEX IF NOT EXISTS idx_day_end_cashier 
  ON public.day_end_records(cashier_id);

-- 6. Foreign key indexes on stock audit columns (created_by)
CREATE INDEX IF NOT EXISTS idx_stock_purchases_created_by 
  ON public.stock_purchases(created_by);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_by 
  ON public.stock_adjustments(created_by);
