<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_and_profile(): void
    {
        User::query()->create([
            'id' => (string) Str::uuid(),
            'name' => 'Cashier',
            'email' => 'cashier@test.local',
            'password' => Hash::make('secret123'),
            'role' => 'cashier',
            'permissions' => ['sales' => true],
            'is_active' => true,
            'must_reset_password' => false,
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'cashier@test.local',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'cashier@test.local')
            ->assertJsonPath('profile.role', 'cashier')
            ->assertJsonStructure(['token', 'user', 'profile']);
    }

    public function test_products_require_auth(): void
    {
        $this->getJson('/api/products')->assertUnauthorized();
    }
}
