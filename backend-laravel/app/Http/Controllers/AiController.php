<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Category;
use App\Support\AiWriter;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

// AI help for filling in listings (see App\Support\AiWriter).
class AiController extends Controller
{
    // A description drafted from what has been typed so far: the business's
    // name and category, plus its city and B2B/B2C type when known. Nothing is
    // saved — the form shows the draft for the owner to keep or edit.
    public function businessDescription(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'categoryId' => ['nullable', 'uuid'],
            'category' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'businessType' => ['nullable', 'in:B2C,B2B'],
        ]);

        $category = ! empty($data['categoryId'])
            ? Category::whereKey($data['categoryId'])->value('name')
            : ($data['category'] ?? null);
        if (! $category) {
            throw ApiException::badRequest('Choose a category first');
        }

        // {description, source}: source says which writer produced it.
        return ApiResponse::ok(AiWriter::businessDescription(trim($data['name']), $category, $data['city'] ?? null, $data['businessType'] ?? null));
    }
}
