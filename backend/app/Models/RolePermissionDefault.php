<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RolePermissionDefault extends Model
{
    protected $table = 'role_permission_defaults';

    protected $primaryKey = 'role';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'role',
        'permissions',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'updated_at' => 'datetime',
        ];
    }
}
