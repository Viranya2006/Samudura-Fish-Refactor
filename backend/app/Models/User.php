<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $fillable = [
        'id',
        'name',
        'email',
        'password',
        'role',
        'permissions',
        'is_active',
        'must_reset_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'permissions' => 'array',
            'is_active' => 'boolean',
            'must_reset_password' => 'boolean',
        ];
    }

    public function isDeveloper(): bool
    {
        return $this->role === 'developer' && $this->is_active;
    }

    public function isAdminOrDev(): bool
    {
        return $this->is_active && in_array($this->role, ['admin', 'developer'], true);
    }

    public function toProfileArray(): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->name,
            'role' => $this->role,
            'permissions' => $this->permissions ?? [],
            'is_active' => $this->is_active,
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
        ];
    }

    public function toAuthUserArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
        ];
    }
}
