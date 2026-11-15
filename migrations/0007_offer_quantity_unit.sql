<<<<<<< HEAD
ALTER TABLE offers ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'item' CHECK (quantity_unit IN ('box', 'item'));
=======
ALTER TABLE offers ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'item' CHECK (quantity_unit IN ('box', 'item'));
>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
