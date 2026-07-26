-- AlterTable
ALTER TABLE `review_scans` ADD COLUMN `qrCodeId` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `review_qr_codes` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `status` ENUM('UNASSIGNED', 'ASSIGNED', 'DISABLED') NOT NULL DEFAULT 'UNASSIGNED',
    `batchLabel` VARCHAR(100) NULL,
    `businessId` VARCHAR(36) NULL,
    `assignedAt` DATETIME(3) NULL,
    `assignedById` VARCHAR(36) NULL,
    `scanCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `review_qr_codes_code_key`(`code`),
    INDEX `review_qr_codes_status_idx`(`status`),
    INDEX `review_qr_codes_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `review_scans_qrCodeId_idx` ON `review_scans`(`qrCodeId`);

-- AddForeignKey
ALTER TABLE `review_qr_codes` ADD CONSTRAINT `review_qr_codes_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_scans` ADD CONSTRAINT `review_scans_qrCodeId_fkey` FOREIGN KEY (`qrCodeId`) REFERENCES `review_qr_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
