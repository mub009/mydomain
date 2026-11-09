<?php

namespace App\Support\Cards;

use RuntimeException;

/**
 * The card's image couldn't be read to make its PDF. The download then
 * fails with this message, rather than printing a different design.
 */
class CardImageUnavailable extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Your card image could not be loaded to make the PDF just now. Please try again in a minute.');
    }
}
