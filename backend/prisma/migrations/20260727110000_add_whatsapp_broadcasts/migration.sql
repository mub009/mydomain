-- WhatsApp broadcasts: a shop links its own number, imports contacts, writes a
-- template and sends to them.

CREATE TABLE `whatsapp_sessions` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `status` ENUM('DISCONNECTED', 'AWAITING_SCAN', 'CONNECTED') NOT NULL DEFAULT 'DISCONNECTED',
  `phoneNumber` VARCHAR(24) NULL,
  `qrDataUrl` LONGTEXT NULL,
  `lastError` TEXT NULL,
  `connectedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `whatsapp_sessions_businessId_key`(`businessId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contacts` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(191) NULL,
  `tag` VARCHAR(60) NULL,
  `optedOut` BOOLEAN NOT NULL DEFAULT false,
  `optedOutAt` DATETIME(3) NULL,
  `source` ENUM('MANUAL', 'IMPORT') NOT NULL DEFAULT 'MANUAL',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `contacts_businessId_phone_key`(`businessId`, `phone`),
  INDEX `contacts_businessId_optedOut_idx`(`businessId`, `optedOut`),
  INDEX `contacts_businessId_tag_idx`(`businessId`, `tag`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `message_templates` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `message_templates_businessId_idx`(`businessId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaigns` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(36) NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('DRAFT', 'SENDING', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `totalCount` INTEGER NOT NULL DEFAULT 0,
  `sentCount` INTEGER NOT NULL DEFAULT 0,
  `failedCount` INTEGER NOT NULL DEFAULT 0,
  `skippedCount` INTEGER NOT NULL DEFAULT 0,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `campaigns_businessId_status_idx`(`businessId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaign_messages` (
  `id` VARCHAR(36) NOT NULL,
  `campaignId` VARCHAR(36) NOT NULL,
  `contactId` VARCHAR(36) NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `error` TEXT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `sentAt` DATETIME(3) NULL,

  INDEX `campaign_messages_campaignId_status_idx`(`campaignId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_sessions` ADD CONSTRAINT `whatsapp_sessions_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_contactId_fkey`
  FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
