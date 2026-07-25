-- CreateTable
CREATE TABLE `shop_registrations` (
    `id` VARCHAR(36) NOT NULL,
    `businessId` VARCHAR(36) NOT NULL,
    `ownerId` VARCHAR(36) NOT NULL,
    `dealerId` VARCHAR(36) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `paymentMethod` ENUM('CASH', 'UPI', 'CARD', 'BANK_TRANSFER') NOT NULL DEFAULT 'CASH',
    `status` ENUM('COLLECTED', 'REFUNDED') NOT NULL DEFAULT 'COLLECTED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shop_registrations_businessId_key`(`businessId`),
    INDEX `shop_registrations_dealerId_idx`(`dealerId`),
    INDEX `shop_registrations_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `shop_registrations` ADD CONSTRAINT `shop_registrations_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_registrations` ADD CONSTRAINT `shop_registrations_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_registrations` ADD CONSTRAINT `shop_registrations_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
