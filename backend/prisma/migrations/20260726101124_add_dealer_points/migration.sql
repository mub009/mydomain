-- AlterTable
ALTER TABLE `users` ADD COLUMN `points` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `point_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `type` ENUM('ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED') NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `note` TEXT NULL,
    `businessId` VARCHAR(36) NULL,
    `grantedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `point_transactions_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `point_transactions` ADD CONSTRAINT `point_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_transactions` ADD CONSTRAINT `point_transactions_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Give existing dealers an opening balance so the new requirement does not
-- lock them out the moment it ships; admins can top up or deduct from here.
UPDATE `users` SET `points` = 10 WHERE `role` = 'DEALER';

INSERT INTO `point_transactions` (`id`, `userId`, `type`, `amount`, `balanceAfter`, `note`, `createdAt`)
SELECT UUID(), `id`, 'ADMIN_GRANT', 10, 10, 'Opening balance when the points system was introduced', NOW(3)
FROM `users` WHERE `role` = 'DEALER';
