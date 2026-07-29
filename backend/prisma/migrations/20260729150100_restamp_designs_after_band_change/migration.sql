-- Turning the bands off changed what every one of these designs looks like,
-- but a shop's copy is only remade when the design is newer than the copy —
-- and `updatedAt` is maintained by Prisma, not by the database, so the plain
-- UPDATE in the previous migration left it untouched. Without this, every
-- poster already made would keep serving its banded version from cache, and
-- the change would reach nobody who had opened one.
UPDATE `poster_designs`
SET `updatedAt` = NOW(3)
WHERE `artworkUrl` IS NOT NULL;
