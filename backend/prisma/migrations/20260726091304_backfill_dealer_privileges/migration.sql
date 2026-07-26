-- Dealers created before the privilege system have NULL privileges, which
-- locks them out of every gated feature (they cannot even add a business).
-- Backfill the full grant set they effectively had before privileges
-- existed; admins can narrow it per dealer afterwards.
UPDATE `users`
SET `privileges` = JSON_ARRAY('MANAGE_LISTINGS', 'MANAGE_LEADS', 'MANAGE_BOOKINGS')
WHERE `role` = 'DEALER' AND `privileges` IS NULL;
