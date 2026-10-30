<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        $q = Sale::query()->with('items')->orderByDesc('created_at');

        if ($from = $request->query('from')) {
            $q->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('created_at', '<=', $to);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($request->filled('limit')) {
            $q->limit((int) $request->query('limit'));
        }

        return response()->json(['data' => $q->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'receipt_number' => ['required', 'string', 'max:50', 'unique:sales,receipt_number'],
            'sale_type' => ['required', 'in:retail,wholesale'],
            'subtotal' => ['required', 'numeric'],
            'discount_amount' => ['nullable', 'numeric'],
            'discount_type' => ['nullable', 'string'],
            'total' => ['required', 'numeric'],
            'payment_method' => ['nullable', 'in:cash,card'],
            'cash_received' => ['nullable', 'numeric'],
            'change_given' => ['nullable', 'numeric'],
            'status' => ['nullable', 'in:completed,held,voided'],
            'terminal_id' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'uuid'],
            'items.*.weight_kg' => ['required', 'numeric'],
            'items.*.price_per_kg' => ['required', 'numeric'],
            'items.*.line_total' => ['required', 'numeric'],
            'items.*.line_discount' => ['nullable', 'numeric'],
            'items.*.is_cut' => ['nullable', 'boolean'],
            'items.*.barcode_raw' => ['nullable', 'string'],
            'items.*.is_manual' => ['nullable', 'boolean'],
        ]);

        $sale = DB::transaction(function () use ($request, $data) {
            $sale = Sale::query()->create([
                'id' => (string) Str::uuid(),
                'receipt_number' => $data['receipt_number'],
                'cashier_id' => $request->user()->id,
                'sale_type' => $data['sale_type'],
                'subtotal' => $data['subtotal'],
                'discount_amount' => $data['discount_amount'] ?? 0,
                'discount_type' => $data['discount_type'] ?? null,
                'total' => $data['total'],
                'payment_method' => $data['payment_method'] ?? null,
                'cash_received' => $data['cash_received'] ?? null,
                'change_given' => $data['change_given'] ?? null,
                'status' => $data['status'] ?? 'completed',
                'terminal_id' => $data['terminal_id'] ?? null,
                'synced' => true,
            ]);

            foreach ($data['items'] as $item) {
                SaleItem::query()->create([
                    'id' => (string) Str::uuid(),
                    'sale_id' => $sale->id,
                    'product_id' => $item['product_id'],
                    'weight_kg' => $item['weight_kg'],
                    'price_per_kg' => $item['price_per_kg'],
                    'line_total' => $item['line_total'],
                    'line_discount' => $item['line_discount'] ?? 0,
                    'is_cut' => $item['is_cut'] ?? true,
                    'barcode_raw' => $item['barcode_raw'] ?? null,
                    'is_manual' => $item['is_manual'] ?? false,
                    'created_at' => now(),
                ]);
            }

            return $sale->load('items');
        });

        return response()->json(['data' => $sale], 201);
    }

    public function update(Request $request, string $id)
    {
        $sale = Sale::query()->with('items')->findOrFail($id);

        $data = $request->validate([
            'sale_type' => ['sometimes', 'in:retail,wholesale'],
            'subtotal' => ['sometimes', 'numeric'],
            'discount_amount' => ['sometimes', 'numeric'],
            'discount_type' => ['nullable', 'string'],
            'total' => ['sometimes', 'numeric'],
            'payment_method' => ['nullable', 'in:cash,card'],
            'cash_received' => ['nullable', 'numeric'],
            'change_given' => ['nullable', 'numeric'],
            'status' => ['sometimes', 'in:completed,held,voided'],
            'items' => ['sometimes', 'array'],
            'items.*.id' => ['nullable', 'uuid'],
            'items.*.product_id' => ['required_with:items', 'uuid'],
            'items.*.weight_kg' => ['required_with:items', 'numeric'],
            'items.*.price_per_kg' => ['required_with:items', 'numeric'],
            'items.*.line_total' => ['required_with:items', 'numeric'],
            'items.*.line_discount' => ['nullable', 'numeric'],
            'items.*.is_cut' => ['nullable', 'boolean'],
            'items.*.barcode_raw' => ['nullable', 'string'],
            'items.*.is_manual' => ['nullable', 'boolean'],
            'delete_item_ids' => ['sometimes', 'array'],
            'delete_item_ids.*' => ['uuid'],
        ]);

        DB::transaction(function () use ($sale, $data) {
            $sale->fill(collect($data)->except(['items', 'delete_item_ids'])->all())->save();

            if (! empty($data['delete_item_ids'])) {
                SaleItem::query()->where('sale_id', $sale->id)->whereIn('id', $data['delete_item_ids'])->delete();
            }

            if (isset($data['items'])) {
                foreach ($data['items'] as $item) {
                    if (! empty($item['id'])) {
                        SaleItem::query()->where('id', $item['id'])->where('sale_id', $sale->id)->update([
                            'product_id' => $item['product_id'],
                            'weight_kg' => $item['weight_kg'],
                            'price_per_kg' => $item['price_per_kg'],
                            'line_total' => $item['line_total'],
                            'line_discount' => $item['line_discount'] ?? 0,
                            'is_cut' => $item['is_cut'] ?? true,
                            'barcode_raw' => $item['barcode_raw'] ?? null,
                            'is_manual' => $item['is_manual'] ?? false,
                        ]);
                    } else {
                        SaleItem::query()->create([
                            'id' => (string) Str::uuid(),
                            'sale_id' => $sale->id,
                            'product_id' => $item['product_id'],
                            'weight_kg' => $item['weight_kg'],
                            'price_per_kg' => $item['price_per_kg'],
                            'line_total' => $item['line_total'],
                            'line_discount' => $item['line_discount'] ?? 0,
                            'is_cut' => $item['is_cut'] ?? true,
                            'barcode_raw' => $item['barcode_raw'] ?? null,
                            'is_manual' => $item['is_manual'] ?? false,
                            'created_at' => now(),
                        ]);
                    }
                }
            }
        });

        return response()->json(['data' => $sale->fresh()->load('items')]);
    }

    public function destroyOlderThan(Request $request)
    {
        $data = $request->validate([
            'before' => ['required', 'date'],
        ]);

        $sales = Sale::query()->where('created_at', '<', $data['before'])->pluck('id');
        SaleItem::query()->whereIn('sale_id', $sales)->delete();
        $count = Sale::query()->whereIn('id', $sales)->delete();

        return response()->json(['deleted' => $count]);
    }
}
