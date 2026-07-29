-- Cataloguing a poster does not involve choosing a designer, so the field and
-- the table behind it go. Who filed the poster is already on the row as
-- `createdById`.
ALTER TABLE `poster_designs` DROP FOREIGN KEY `poster_designs_designerId_fkey`;
DROP INDEX `poster_designs_designerId_idx` ON `poster_designs`;
ALTER TABLE `poster_designs` DROP COLUMN `designerId`;
DROP TABLE `poster_designers`;
