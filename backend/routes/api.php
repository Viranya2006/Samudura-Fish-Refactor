<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\DayEndController;
use App\Http\Controllers\Api\PettyCashController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\ShopSettingController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/password', [AuthController::class, 'resetPassword']);

    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store'])->middleware('role:admin,developer');
    Route::post('/products/bulk', [ProductController::class, 'bulkUpsert'])->middleware('role:admin,developer');
    Route::patch('/products/{id}', [ProductController::class, 'update'])->middleware('role:admin,developer');
    Route::delete('/products/{id}', [ProductController::class, 'destroy'])->middleware('role:admin,developer');

    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::patch('/sales/{id}', [SaleController::class, 'update']);
    Route::post('/sales/purge', [SaleController::class, 'destroyOlderThan'])->middleware('role:developer');

    Route::get('/shop-settings', [ShopSettingController::class, 'show']);
    Route::put('/shop-settings', [ShopSettingController::class, 'upsert'])->middleware('role:admin,developer');

    Route::get('/petty-cash', [PettyCashController::class, 'index']);
    Route::post('/petty-cash', [PettyCashController::class, 'store']);
    Route::post('/petty-cash/purge', [PettyCashController::class, 'destroyOlderThan'])->middleware('role:developer');

    Route::get('/day-end', [DayEndController::class, 'index']);
    Route::post('/day-end', [DayEndController::class, 'store']);
    Route::post('/day-end/purge', [DayEndController::class, 'destroyOlderThan'])->middleware('role:developer');

    Route::get('/stock/levels', [StockController::class, 'levels']);
    Route::get('/stock/purchases', [StockController::class, 'purchases']);
    Route::post('/stock/purchases', [StockController::class, 'storePurchase']);
    Route::get('/stock/adjustments', [StockController::class, 'adjustments']);
    Route::post('/stock/adjustments', [StockController::class, 'storeAdjustment']);

    Route::get('/users', [UserController::class, 'index'])->middleware('role:admin,developer');
    Route::post('/users', [UserController::class, 'store'])->middleware('role:admin,developer');
    Route::patch('/users/{id}', [UserController::class, 'update'])->middleware('role:admin,developer');

    Route::get('/role-permissions', [RolePermissionController::class, 'index']);
    Route::put('/role-permissions', [RolePermissionController::class, 'upsert'])->middleware('role:developer');

    Route::get('/backup/export', [BackupController::class, 'export'])->middleware('role:admin,developer');
});
