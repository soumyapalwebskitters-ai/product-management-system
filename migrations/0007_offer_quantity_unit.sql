ALTER TABLE offers ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'item' CHECK (quantity_unit IN ('box', 'item'));
