<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedCategory;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ClassifiedCategoryController extends Controller
{
    public function index()
    {
        $categories = ClassifiedCategory::whereNull('parentId')
            ->with('children')
            ->orderBy('sortOrder')->orderBy('name')
            ->get();

        return ApiResponse::ok($categories);
    }

    public function show(string $slug)
    {
        $category = ClassifiedCategory::where('slug', $slug)->with('children')->first();
        if (! $category) {
            throw ApiException::notFound('Category not found');
        }

        return ApiResponse::ok($category);
    }

    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'min:1', 'max:100'],
            'slug' => [$required, 'string', 'min:1', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'iconUrl' => ['nullable', 'url'],
            'parentId' => ['nullable', 'uuid'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());

        return ApiResponse::created(ClassifiedCategory::create($data));
    }

    public function update(Request $request, string $id)
    {
        $category = ClassifiedCategory::find($id);
        if (! $category) {
            throw ApiException::notFound('Category not found');
        }

        $data = $request->validate($this->rules(partial: true));
        $category->update($data);

        return ApiResponse::ok($category);
    }

    public function destroy(string $id)
    {
        $category = ClassifiedCategory::find($id);
        if (! $category) {
            throw ApiException::notFound('Category not found');
        }
        $category->delete();

        return ApiResponse::noContent();
    }
}
