-- Whether a poster carries a QR is now read from its prompt (`@qr`), so a
-- stored flag could only ever disagree with the words beside it.
ALTER TABLE `poster_designs` DROP COLUMN `showQr`;
