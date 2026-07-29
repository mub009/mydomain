-- The header and footer strips were laid over every uploaded design. They
-- cover the designer's work and leave any slots marked in the artwork showing
-- underneath, which is the opposite of putting the shop's details *into* the
-- design. They are now opt-in.
ALTER TABLE `poster_designs` MODIFY `showHeader` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `poster_designs` MODIFY `showFooter` BOOLEAN NOT NULL DEFAULT false;

-- Existing designs built on uploaded artwork are turned off too: they are the
-- ones carrying the strips today. Designs with no artwork are the drawn
-- layouts, where the bands are the poster rather than something over it.
UPDATE `poster_designs`
SET `showHeader` = false, `showFooter` = false
WHERE `artworkUrl` IS NOT NULL;
