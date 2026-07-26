-- Track which staff member (dealer/admin) created an account, so dealers
-- can manage (e.g. reset the password of) the owner accounts they set up.
ALTER TABLE `users` ADD COLUMN `createdById` VARCHAR(36) NULL;
CREATE INDEX `users_createdById_idx` ON `users`(`createdById`);
ALTER TABLE `users` ADD CONSTRAINT `users_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
