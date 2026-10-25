<?php

namespace App\Support;

use App\Exceptions\ApiException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Lets a Blade page reuse an API controller action in-process, so a page
 * renders exactly the data (and goes through exactly the checks) the
 * /api/v1 endpoint would — without a second copy of the query logic.
 */
class InternalApi
{
    /**
     * Returns the decoded JSON envelope ({ success, data, meta, ... }).
     *
     * @param  array{0: class-string, 1: string}  $action
     * @param  array<string, mixed>  $routeArgs  route parameters by name
     */
    public static function call(array $action, array $query = [], array $routeArgs = [], bool $asUser = false): array
    {
        $request = Request::create('/', 'GET', $query);
        if ($asUser && ($user = WebAuth::user())) {
            $request->attributes->set('auth', ['sub' => $user->id, 'role' => $user->role]);
        }

        [$class, $method] = $action;
        $response = app()->call([app($class), $method], ['request' => $request, ...$routeArgs]);

        return $response->getData(true);
    }

    /**
     * Like call(), but a failed lookup or rejected filter yields null
     * instead of an exception, for pages that degrade to an empty state.
     */
    public static function tryCall(array $action, array $query = [], array $routeArgs = [], bool $asUser = false): ?array
    {
        try {
            return self::call($action, $query, $routeArgs, $asUser);
        } catch (ApiException|ValidationException) {
            return null;
        }
    }
}
