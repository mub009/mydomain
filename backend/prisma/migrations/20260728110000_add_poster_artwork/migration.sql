-- AlterTable
ALTER TABLE `poster_designs`
    ADD COLUMN `artworkUrl` LONGTEXT NULL,
    ADD COLUMN `headerText` TEXT NULL,
    ADD COLUMN `footerText` TEXT NULL,
    ADD COLUMN `showHeader` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `showFooter` BOOLEAN NOT NULL DEFAULT true;
