CREATE TABLE gallery_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX idx_gallery_images_variant ON gallery_images (variant_id, position);
