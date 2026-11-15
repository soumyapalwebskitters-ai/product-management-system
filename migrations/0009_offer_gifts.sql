CREATE TABLE offer_gifts (
  offer_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_unit TEXT NOT NULL DEFAULT 'item' CHECK (quantity_unit IN ('box', 'item')),
  PRIMARY KEY (offer_id, position)
);
