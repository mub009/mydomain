-- CreateTable
CREATE TABLE `visitors` (
    `id` VARCHAR(36) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `city` VARCHAR(100) NULL,
    `consentAt` DATETIME(3) NOT NULL,
    `locationAt` DATETIME(3) NULL,
    `userAgent` TEXT NULL,
    `visitCount` INTEGER NOT NULL DEFAULT 1,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `visitors_phone_key`(`phone`),
    INDEX `visitors_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
