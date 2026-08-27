<?php

namespace App\Support;

class Pagination
{
    /**
     * @return array{page:int,pageSize:int,skip:int,take:int}
     */
    public static function parse(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $pageSize = min(50, max(1, (int) ($query['pageSize'] ?? 20)));

        return [
            'page' => $page,
            'pageSize' => $pageSize,
            'skip' => ($page - 1) * $pageSize,
            'take' => $pageSize,
        ];
    }
}
