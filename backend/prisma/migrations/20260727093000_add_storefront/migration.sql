-- Sites can now be either a brochure website or a storefront that takes orders.
ALTER TABLE `business_sites`
  ADD COLUMN `siteType` ENUM('WEBSITE', 'ECOMMERCE') NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN `deliveryFeeCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `freeDeliveryAboveCents` INTEGER NULL,
  ADD COLUMN `acceptsOnlinePayment` BOOLEAN NOT NULL DEFAULT false;

-- Catalogue
CREATE TABLE `products` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `priceCents` INTEGER NOT NULL,
  `compareAtCents` INTEGER NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `imageUrl` TEXT NULL,
  `sku` VARCHAR(60) NULL,
  `trackStock` BOOLEAN NOT NULL DEFAULT false,
  `stock` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `products_businessId_slug_key`(`businessId`, `slug`),
  INDEX `products_businessId_isActive_idx`(`businessId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Orders
CREATE TABLE `orders` (
  `id` VARCHAR(36) NOT NULL,
  `businessId` VARCHAR(36) NOT NULL,
  `orderNumber` VARCHAR(24) NOT NULL,
  `customerId` VARCHAR(36) NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerPhone` VARCHAR(20) NOT NULL,
  `customerEmail` VARCHAR(191) NULL,
  `addressLine1` VARCHAR(191) NOT NULL,
  `addressLine2` VARCHAR(191) NULL,
  `city` VARCHAR(191) NOT NULL,
  `postalCode` VARCHAR(20) NULL,
  `notes` TEXT NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `paymentMethod` ENUM('COD', 'ONLINE') NOT NULL DEFAULT 'COD',
  `subtotalCents` INTEGER NOT NULL,
  `deliveryFeeCents` INTEGER NOT NULL DEFAULT 0,
  `totalCents` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
  INDEX `orders_businessId_status_idx`(`businessId`, `status`),
  INDEX `orders_businessId_placedAt_idx`(`businessId`, `placedAt`),
  INDEX `orders_businessId_customerPhone_idx`(`businessId`, `customerPhone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` VARCHAR(36) NOT NULL,
  `orderId` VARCHAR(36) NOT NULL,
  `productId` VARCHAR(36) NULL,
  `name` VARCHAR(191) NOT NULL,
  `imageUrl` TEXT NULL,
  `unitPriceCents` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL,
  `lineTotalCents` INTEGER NOT NULL,

  INDEX `order_items_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `products` ADD CONSTRAINT `products_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `orders_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
