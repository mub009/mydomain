-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `facebookPageUrl` TEXT NULL,
    ADD COLUMN `googlePlaceId` VARCHAR(255) NULL,
    ADD COLUMN `googleReviewUrl` TEXT NULL,
    ADD COLUMN `instagramUsername` VARCHAR(100) NULL,
    ADD COLUMN `preferredReviewChannel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK') NULL;

-- CreateTable
CREATE TABLE `review_scans` (
    `id` VARCHAR(36) NOT NULL,
    `businessId` VARCHAR(36) NOT NULL,
    `channel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK') NOT NULL,
    `userAgent` TEXT NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_scans_businessId_scannedAt_idx`(`businessId`, `scannedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `review_scans` ADD CONSTRAINT `review_scans_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
