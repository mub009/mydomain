<?php

namespace App\Services;

use RuntimeException;

/** An error reply from Kite Connect. */
class KiteException extends RuntimeException
{
    public function __construct(string $message, public int $httpStatus, public ?string $type = null)
    {
        parent::__construct($message);
    }

    /** The session ended (06:00 IST) or was revoked: log in again. */
    public function sessionEnded(): bool
    {
        return $this->httpStatus === 403 || $this->type === 'TokenException';
    }
}
