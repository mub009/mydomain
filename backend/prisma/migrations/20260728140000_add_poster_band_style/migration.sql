-- AlterTable
ALTER TABLE `poster_designs`
    ADD COLUMN `bandStyle` VARCHAR(20) NOT NULL DEFAULT 'solid',
    ADD COLUMN `bandColor` VARCHAR(9) NULL,
    ADD COLUMN `bandTextColor` VARCHAR(9) NULL;
