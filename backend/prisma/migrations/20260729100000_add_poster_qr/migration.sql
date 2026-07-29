-- AlterTable
ALTER TABLE `poster_designs`
    ADD COLUMN `showQr` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `qrPosition` VARCHAR(20) NOT NULL DEFAULT 'bottom-right',
    ADD COLUMN `qrScale` DOUBLE NOT NULL DEFAULT 1;
