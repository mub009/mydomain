-- Records which built-in design a business's website was generated from.
-- Existing sites were all built from the original layout, now called "classic".
ALTER TABLE `business_sites` ADD COLUMN `templateId` VARCHAR(40) NOT NULL DEFAULT 'classic';
