# Stock page – user guide

How to use **Stock** in the POS and how the numbers are calculated.

## Who can open it

- **Cashier** and **Developer**: sidebar **Stock** (route `/stock`).
- **Admin**: same **Stock** item. Admins don’t use POS **Inventory** for products, but they can set **minimum stock** on the Stock **Overview** tab.

---

## The three tabs

### 1. Overview

- One row per **active** product.
- **Fresh (kg)** – estimated fish available **on the counter / for sale** (see [Formulas](#formulas) below).
- **Freezer (kg)** – estimated weight **in the freezer** from your adjustments (see below).
- **Purchased / Sold** – lifetime totals used in the math (for checking).
- **Min (kg)** – optional alert level.
  - **Admin / Developer**: change the value and click **Save min** for that row.
  - **Cashier**: min is shown read-only (if displayed).
- **Need to buy**
  - **Low** if **Min (kg) is greater than 0** and **Fresh** is **below** that minimum.
  - **OK** otherwise.  
  If min is **0**, that product never shows **Low**.

Products that need attention (**Low**) are sorted toward the **top** of the table.

### 2. Purchases

Use when you **buy fish** (incoming stock).

1. Choose **Product**.
2. Set **Date** (usually today).
3. **Weight (kg)** – total kg bought on that line.
4. **Cost (Rs/kg)** – buy price per kg that day (can change every purchase).
5. Optional: **Supplier**, **Notes**.
6. Click **Record purchase**.

**Recent purchases** lists the latest entries (newest first).

### 3. Adjustments

Use when weight changes **without** a normal sale (waste, freezer, damage, etc.).  
Enter a **positive** weight; the **reason** tells the system how it affects fresh vs freezer.

| Reason           | Meaning |
|------------------|--------|
| **Waste**        | Thrown away / not sellable. Reduces **fresh** only. |
| **Damage**       | Same effect as waste for the calculation – reduces **fresh** only. |
| **Other**        | Other loss from “fresh” – reduces **fresh** only. |
| **To freezer**   | Moved from counter into freezer. Reduces **fresh**, increases **freezer** balance. |
| **From freezer** | Moved from freezer back to counter. Increases **fresh**, decreases **freezer** balance. |

**Recent adjustments** lists the latest entries.

---

## Formulas

All figures are **all-time** (from when you started recording), **not** “today only” unless you add reporting later.

### Fresh available (kg)

```
Fresh = Total purchases
      − Sold (completed sales only)
      − (Waste + Damage + Other)
      − To freezer
      + From freezer
```

- **Total purchases** – sum of all **Purchases** you recorded for that product.
- **Sold** – sum of **sale line weights** where the sale status is **`completed`**.  
  **Held** and **voided** sales do **not** reduce stock.
- **Waste / Damage / Other** – sum of adjustment weights with those reasons.
- **To freezer / From freezer** – sum of adjustment weights for those reasons.

### Freezer (kg)

```
Freezer = Total “To freezer” − Total “From freezer”
```

This is a simple balance from adjustments. It does **not** separately track “sales from freezer”; sales in the POS reduce **fresh** unless you reflect reality with adjustments.

### Minimum stock and “Need to buy”

- **Min (kg) = 0** → no low-stock warning for that product.
- **Min (kg) > 0** and **Fresh < Min** → **Low** (restock / buy soon).

---

## Inventory and min stock

**Admin / Developer** can also set **Min stock (kg)** when adding or editing a product under **Inventory** (POS). It is the same field as **Min (kg)** on Stock **Overview**.

---

## Good habits

1. Record **purchases** when stock arrives (same day; split lines by product if needed).
2. Record **adjustments** the same day (waste, freezer moves, damage).
3. Set **realistic Min (kg)** so **Overview** highlights what to order.
4. **Fresh** is only as accurate as your **purchases**, **adjustments**, and **completed** sales.

---

## Limits (expectations)

- **Not** batch or expiry tracking – one running number per product.
- **Not** limited to “this week” – lifetime totals in the current design.
- **Freezer** follows **To freezer / From freezer** only; for a physical count mismatch, add an adjustment (or future feature) to correct it.

---

## Technical reference

- Database: `supabase/migrations/006_stock_management.sql`  
  Tables: `stock_purchases`, `stock_adjustments`; view: `stock_levels`; column: `products.min_stock_kg`.
