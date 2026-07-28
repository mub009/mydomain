-- AlterTable
ALTER TABLE `poster_designs`
    ADD COLUMN `logoPosition` VARCHAR(20) NOT NULL DEFAULT 'header',
    ADD COLUMN `logoScale` DOUBLE NOT NULL DEFAULT 1;
