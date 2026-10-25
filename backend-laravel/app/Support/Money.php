<?php

namespace App\Support;

class Money
{
    /**
     * "₹1,23,456" — Indian digit grouping, up to two decimals and none when
     * whole, matching how the shop screens have always shown prices.
     */
    public static function format(int|float|null $cents, string $currency = 'INR'): string
    {
        $amount = round(((float) $cents) / 100, 2);
        $negative = $amount < 0;
        $amount = abs($amount);

        $whole = (string) (int) floor($amount);
        $fraction = (int) round(($amount - floor($amount)) * 100);

        // Last three digits, then groups of two.
        if (strlen($whole) > 3) {
            $head = substr($whole, 0, -3);
            $head = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $head);
            $whole = $head.','.substr($whole, -3);
        }

        $text = $whole.($fraction ? '.'.rtrim(sprintf('%02d', $fraction), '0') : '');

        return ($negative ? '-' : '').($currency === 'INR' ? '₹' : '').$text;
    }
}
