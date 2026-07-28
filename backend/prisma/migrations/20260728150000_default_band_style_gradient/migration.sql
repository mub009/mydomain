-- A solid bar can leave a visible seam on artwork with a busy edge; a faded
-- one cannot, so it becomes the default for designs created from here on.
ALTER TABLE `poster_designs` ALTER COLUMN `bandStyle` SET DEFAULT 'gradient';
