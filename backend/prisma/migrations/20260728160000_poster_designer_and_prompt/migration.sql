-- CreateTable
CREATE TABLE `poster_designers` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `poster_designers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: who drew it, and the prompt it came from.
ALTER TABLE `poster_designs`
    ADD COLUMN `designerId` VARCHAR(36) NULL,
    -- A poster whose artwork already carries its message needs no headline.
    MODIFY COLUMN `headline` TEXT NULL,
    MODIFY COLUMN `layout` VARCHAR(50) NOT NULL DEFAULT 'artwork',
    MODIFY COLUMN `palette` VARCHAR(50) NOT NULL DEFAULT 'crimson';

-- The brief was always this prompt; the name now says so.
ALTER TABLE `poster_designs` CHANGE COLUMN `aiBrief` `aiPrompt` TEXT NULL;

-- AddForeignKey
ALTER TABLE `poster_designs` ADD CONSTRAINT `poster_designs_designerId_fkey` FOREIGN KEY (`designerId`) REFERENCES `poster_designers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `poster_designs_designerId_idx` ON `poster_designs`(`designerId`);
