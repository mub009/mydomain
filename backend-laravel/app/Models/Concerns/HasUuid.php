<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

trait HasUuid
{
    public static function bootHasUuid(): void
    {
        static::creating(function ($model) {
            if (! $model->getKey()) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function initializeHasUuid(): void
    {
        $this->keyType = 'string';
        $this->incrementing = false;
    }
}
