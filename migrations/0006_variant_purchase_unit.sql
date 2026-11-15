ALTER TABLE variants ADD COLUMN purchase_unit TEXT NOT NULL DEFAULT 'box' CHECK (purchase_unit IN ('box', 'item'));
