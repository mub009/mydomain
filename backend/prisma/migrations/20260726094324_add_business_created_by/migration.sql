-- Track who registered each listing so admin can report on dealer activity.
ALTER TABLE `businesses` ADD COLUMN `createdById` VARCHAR(36) NULL;
CREATE INDEX `businesses_createdById_idx` ON `businesses`(`createdById`);
ALTER TABLE `businesses` ADD CONSTRAINT `businesses_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Best-guess backfill: existing listings were registered by their owner.
UPDATE `businesses` SET `createdById` = `ownerId` WHERE `createdById` IS NULL;
