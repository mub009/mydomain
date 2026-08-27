<?php

namespace App\Exceptions;

use Exception;

class ApiException extends Exception
{
    public function __construct(
        public readonly int $statusCode,
        public readonly string $errorCode,
        string $message,
        public readonly mixed $details = null,
    ) {
        parent::__construct($message);
    }

    public static function badRequest(string $message, mixed $details = null): self
    {
        return new self(400, 'BAD_REQUEST', $message, $details);
    }

    public static function unauthorized(string $message = 'Unauthorized'): self
    {
        return new self(401, 'UNAUTHORIZED', $message);
    }

    public static function forbidden(string $message = 'Forbidden'): self
    {
        return new self(403, 'FORBIDDEN', $message);
    }

    public static function notFound(string $message = 'Resource not found'): self
    {
        return new self(404, 'NOT_FOUND', $message);
    }

    public static function conflict(string $message): self
    {
        return new self(409, 'CONFLICT', $message);
    }

    public static function internal(string $message = 'Internal server error'): self
    {
        return new self(500, 'INTERNAL_ERROR', $message);
    }
}
