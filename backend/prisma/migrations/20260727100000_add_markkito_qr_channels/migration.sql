-- QR boards that point at the shop's own Markkito listing, so a scan can lead
-- to its details page or straight to writing a review on our platform.
ALTER TABLE `businesses`
  MODIFY `preferredReviewChannel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW') NULL;

ALTER TABLE `review_qr_codes`
  MODIFY `channel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW') NULL;

ALTER TABLE `review_scans`
  MODIFY `channel` ENUM('GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW') NOT NULL;
