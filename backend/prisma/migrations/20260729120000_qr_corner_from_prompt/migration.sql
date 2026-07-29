-- Where the QR sits is read from the prompt too ("leave the bottom right
-- clear for @qr"), so there is nothing left to store about it.
ALTER TABLE `poster_designs` DROP COLUMN `qrPosition`, DROP COLUMN `qrScale`;
