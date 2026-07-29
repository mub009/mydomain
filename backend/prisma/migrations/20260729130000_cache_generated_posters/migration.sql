-- AlterTable
ALTER TABLE `poster_renders`
    ADD COLUMN `imageUrl` LONGTEXT NULL,
    ADD COLUMN `engine` VARCHAR(20) NULL,
    ADD COLUMN `generatedAt` DATETIME(3) NULL;
