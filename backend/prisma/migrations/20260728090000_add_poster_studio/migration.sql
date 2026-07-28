-- CreateTable
CREATE TABLE `poster_designs` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `layout` VARCHAR(50) NOT NULL,
    `palette` VARCHAR(50) NOT NULL,
    `size` ENUM('SQUARE', 'PORTRAIT', 'STORY') NOT NULL DEFAULT 'PORTRAIT',
    `headline` TEXT NOT NULL,
    `subheadline` TEXT NULL,
    `ctaText` TEXT NULL,
    `badgeText` VARCHAR(60) NULL,
    `footnote` TEXT NULL,
    `backgroundImageUrl` TEXT NULL,
    `categoryId` VARCHAR(36) NULL,
    `city` VARCHAR(100) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `aiBrief` TEXT NULL,
    `aiEngine` VARCHAR(40) NULL,
    `createdById` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `poster_designs_isPublished_categoryId_idx`(`isPublished`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `poster_renders` (
    `id` VARCHAR(36) NOT NULL,
    `designId` VARCHAR(36) NOT NULL,
    `businessId` VARCHAR(36) NOT NULL,
    `downloads` INTEGER NOT NULL DEFAULT 0,
    `lastAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `poster_renders_businessId_idx`(`businessId`),
    UNIQUE INDEX `poster_renders_designId_businessId_key`(`designId`, `businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `poster_designs` ADD CONSTRAINT `poster_designs_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `poster_designs` ADD CONSTRAINT `poster_designs_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `poster_renders` ADD CONSTRAINT `poster_renders_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `poster_designs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `poster_renders` ADD CONSTRAINT `poster_renders_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
