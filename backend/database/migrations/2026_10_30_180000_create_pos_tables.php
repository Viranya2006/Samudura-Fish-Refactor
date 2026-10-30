<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('plu_code', 10)->unique();
            $table->string('name_en');
            $table->string('name_si');
            $table->decimal('retail_price_per_kg', 10, 2)->default(0);
            $table->decimal('wholesale_price_per_kg', 10, 2)->default(0);
            $table->decimal('no_cut_discount_per_kg', 10, 2)->default(0);
            $table->decimal('min_stock_kg', 10, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('shop_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('shop_name')->default('Samudura Fish Market');
            $table->string('shop_name_si')->default('සමුදුර මත්ස්‍ය වෙළඳපොළ');
            $table->text('address')->nullable();
            $table->text('address_si')->nullable();
            $table->string('phone', 20)->nullable();
            $table->text('logo_url')->nullable();
            $table->text('receipt_footer')->nullable();
            $table->text('receipt_footer_si')->nullable();
            $table->integer('data_retention_days')->default(90);
            $table->string('plu_file_path')->default('D:/PLU/plu.txt');
            $table->string('scale_price_format', 20)->default('none');
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('role_permission_defaults', function (Blueprint $table) {
            $table->string('role', 20)->primary();
            $table->json('permissions');
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('receipt_number', 50)->unique();
            $table->uuid('cashier_id');
            $table->string('sale_type', 20)->default('retail');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->string('discount_type', 20)->nullable();
            $table->decimal('total', 12, 2)->default(0);
            $table->string('payment_method', 20)->nullable();
            $table->decimal('cash_received', 12, 2)->nullable();
            $table->decimal('change_given', 12, 2)->nullable();
            $table->string('status', 20)->default('completed');
            $table->string('terminal_id', 50)->nullable();
            $table->boolean('synced')->default(true);
            $table->timestamps();

            $table->foreign('cashier_id')->references('id')->on('users')->restrictOnDelete();
            $table->index('cashier_id');
            $table->index('created_at');
            $table->index('status');
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id');
            $table->uuid('product_id');
            $table->decimal('weight_kg', 10, 4);
            $table->decimal('price_per_kg', 10, 2);
            $table->decimal('line_total', 12, 2);
            $table->decimal('line_discount', 12, 2)->default(0);
            $table->boolean('is_cut')->default(true);
            $table->string('barcode_raw', 20)->nullable();
            $table->boolean('is_manual')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('sale_id')->references('id')->on('sales')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->index('sale_id');
        });

        Schema::create('petty_cash_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cashier_id');
            $table->decimal('amount', 12, 2);
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('cashier_id')->references('id')->on('users')->restrictOnDelete();
            $table->index('created_at');
        });

        Schema::create('day_end_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cashier_id');
            $table->date('record_date');
            $table->decimal('opening_cash', 12, 2)->default(0);
            $table->decimal('closing_cash', 12, 2);
            $table->decimal('expected_cash', 12, 2);
            $table->decimal('variance', 12, 2);
            $table->decimal('total_sales', 12, 2)->default(0);
            $table->decimal('cash_sales', 12, 2)->default(0);
            $table->decimal('card_sales', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('cashier_id')->references('id')->on('users')->restrictOnDelete();
            $table->index('record_date');
        });

        Schema::create('stock_purchases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->date('purchase_date');
            $table->decimal('weight_kg', 10, 4);
            $table->decimal('cost_per_kg', 10, 2);
            $table->decimal('total_cost', 12, 2);
            $table->text('supplier')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index('product_id');
            $table->index('purchase_date');
        });

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->date('adjustment_date');
            $table->decimal('weight_kg', 10, 4);
            $table->string('reason', 30);
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index('product_id');
            $table->index('adjustment_date');
        });

        // stock_levels view (MariaDB / MySQL / SQLite-compatible via driver check)
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::statement("
                CREATE VIEW stock_levels AS
                SELECT
                    p.id AS product_id,
                    p.plu_code,
                    p.name_en,
                    p.name_si,
                    p.min_stock_kg,
                    COALESCE(pr.purchased_kg, 0) AS purchased_kg,
                    COALESCE(s.sold_kg, 0) AS sold_kg,
                    COALESCE(a.loss_kg, 0) AS adjustment_loss_kg,
                    COALESCE(a.freezer_in_kg, 0) AS freezer_in_kg,
                    COALESCE(a.freezer_out_kg, 0) AS freezer_out_kg,
                    (
                        COALESCE(pr.purchased_kg, 0)
                        - COALESCE(s.sold_kg, 0)
                        - COALESCE(a.loss_kg, 0)
                        - COALESCE(a.freezer_in_kg, 0)
                        + COALESCE(a.freezer_out_kg, 0)
                    ) AS fresh_available_kg,
                    (COALESCE(a.freezer_in_kg, 0) - COALESCE(a.freezer_out_kg, 0)) AS freezer_kg
                FROM products p
                LEFT JOIN (
                    SELECT product_id, SUM(weight_kg) AS purchased_kg
                    FROM stock_purchases GROUP BY product_id
                ) pr ON pr.product_id = p.id
                LEFT JOIN (
                    SELECT si.product_id, SUM(si.weight_kg) AS sold_kg
                    FROM sale_items si
                    INNER JOIN sales s2 ON s2.id = si.sale_id AND s2.status = 'completed'
                    GROUP BY si.product_id
                ) s ON s.product_id = p.id
                LEFT JOIN (
                    SELECT
                        product_id,
                        SUM(CASE WHEN reason IN ('waste', 'damage', 'other') THEN weight_kg ELSE 0 END) AS loss_kg,
                        SUM(CASE WHEN reason = 'freezer_in' THEN weight_kg ELSE 0 END) AS freezer_in_kg,
                        SUM(CASE WHEN reason = 'freezer_out' THEN weight_kg ELSE 0 END) AS freezer_out_kg
                    FROM stock_adjustments GROUP BY product_id
                ) a ON a.product_id = p.id
                WHERE p.is_active = 1
            ");
        } else {
            DB::statement("
                CREATE OR REPLACE VIEW stock_levels AS
                SELECT
                    p.id AS product_id,
                    p.plu_code,
                    p.name_en,
                    p.name_si,
                    p.min_stock_kg,
                    COALESCE(pr.purchased_kg, 0) AS purchased_kg,
                    COALESCE(s.sold_kg, 0) AS sold_kg,
                    COALESCE(a.loss_kg, 0) AS adjustment_loss_kg,
                    COALESCE(a.freezer_in_kg, 0) AS freezer_in_kg,
                    COALESCE(a.freezer_out_kg, 0) AS freezer_out_kg,
                    (
                        COALESCE(pr.purchased_kg, 0)
                        - COALESCE(s.sold_kg, 0)
                        - COALESCE(a.loss_kg, 0)
                        - COALESCE(a.freezer_in_kg, 0)
                        + COALESCE(a.freezer_out_kg, 0)
                    ) AS fresh_available_kg,
                    (COALESCE(a.freezer_in_kg, 0) - COALESCE(a.freezer_out_kg, 0)) AS freezer_kg
                FROM products p
                LEFT JOIN (
                    SELECT product_id, SUM(weight_kg) AS purchased_kg
                    FROM stock_purchases GROUP BY product_id
                ) pr ON pr.product_id = p.id
                LEFT JOIN (
                    SELECT si.product_id, SUM(si.weight_kg) AS sold_kg
                    FROM sale_items si
                    INNER JOIN sales s2 ON s2.id = si.sale_id AND s2.status = 'completed'
                    GROUP BY si.product_id
                ) s ON s.product_id = p.id
                LEFT JOIN (
                    SELECT
                        product_id,
                        SUM(CASE WHEN reason IN ('waste', 'damage', 'other') THEN weight_kg ELSE 0 END) AS loss_kg,
                        SUM(CASE WHEN reason = 'freezer_in' THEN weight_kg ELSE 0 END) AS freezer_in_kg,
                        SUM(CASE WHEN reason = 'freezer_out' THEN weight_kg ELSE 0 END) AS freezer_out_kg
                    FROM stock_adjustments GROUP BY product_id
                ) a ON a.product_id = p.id
                WHERE p.is_active = 1
            ");
        }
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS stock_levels');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('stock_purchases');
        Schema::dropIfExists('day_end_records');
        Schema::dropIfExists('petty_cash_transactions');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('role_permission_defaults');
        Schema::dropIfExists('shop_settings');
        Schema::dropIfExists('products');
    }
};
