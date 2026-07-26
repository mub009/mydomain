-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `youtubeUrl` TEXT NULL,
    MODIFY `preferredReviewChannel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE') NULL;

-- AlterTable
ALTER TABLE `review_qr_codes` ADD COLUMN `channel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE') NULL;

-- AlterTable
ALTER TABLE `review_scans` MODIFY `channel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE') NOT NULL;
