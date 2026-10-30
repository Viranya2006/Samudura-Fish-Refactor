<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $q = Product::query()->orderBy('name_en');

        if ($request->boolean('active_only')) {
            $q->where('is_active', true);
        }

        return response()->json(['data' => $q->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'plu_code' => ['required', 'string', 'max:10', 'unique:products,plu_code'],
            'name_en' => ['required', 'string', 'max:255'],
            'name_si' => ['required', 'string', 'max:255'],
            'retail_price_per_kg' => ['nullable', 'numeric'],
            'wholesale_price_per_kg' => ['nullable', 'numeric'],
            'no_cut_discount_per_kg' => ['nullable', 'numeric'],
            'min_stock_kg' => ['nullable', 'numeric'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $product = Product::query()->create(array_merge($data, [
            'id' => (string) Str::uuid(),
        ]));

        return response()->json(['data' => $product], 201);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::query()->findOrFail($id);

        $data = $request->validate([
            'plu_code' => ['sometimes', 'string', 'max:10', 'unique:products,plu_code,'.$id],
            'name_en' => ['sometimes', 'string', 'max:255'],
            'name_si' => ['sometimes', 'string', 'max:255'],
            'retail_price_per_kg' => ['sometimes', 'numeric'],
            'wholesale_price_per_kg' => ['sometimes', 'numeric'],
            'no_cut_discount_per_kg' => ['sometimes', 'numeric'],
            'min_stock_kg' => ['sometimes', 'numeric'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $product->fill($data)->save();

        return response()->json(['data' => $product->fresh()]);
    }

    public function destroy(string $id)
    {
        Product::query()->findOrFail($id)->delete();

        return response()->json(['ok' => true]);
    }

    public function bulkUpsert(Request $request)
    {
        $data = $request->validate([
            'products' => ['required', 'array', 'min:1'],
            'products.*.plu_code' => ['required', 'string', 'max:10'],
            'products.*.name_en' => ['required', 'string'],
            'products.*.name_si' => ['required', 'string'],
            'products.*.retail_price_per_kg' => ['nullable', 'numeric'],
            'products.*.wholesale_price_per_kg' => ['nullable', 'numeric'],
            'products.*.no_cut_discount_per_kg' => ['nullable', 'numeric'],
            'products.*.min_stock_kg' => ['nullable', 'numeric'],
            'products.*.is_active' => ['nullable', 'boolean'],
        ]);

        $created = 0;
        $updated = 0;

        foreach ($data['products'] as $row) {
            $existing = Product::query()->where('plu_code', $row['plu_code'])->first();
            if ($existing) {
                $existing->fill($row)->save();
                $updated++;
            } else {
                Product::query()->create(array_merge($row, ['id' => (string) Str::uuid()]));
                $created++;
            }
        }

        return response()->json(['created' => $created, 'updated' => $updated]);
    }
}
