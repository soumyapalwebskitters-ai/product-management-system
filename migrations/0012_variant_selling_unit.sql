ALTER TABLE variants ADD COLUMN selling_unit TEXT NOT NULL DEFAULT 'item' CHECK (selling_unit IN ('box', 'item'));
