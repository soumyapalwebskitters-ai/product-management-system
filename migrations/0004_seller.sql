-- One shop profile: the seller, the business, and its public links.

CREATE TABLE seller (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  gst TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  profile_image TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  youtube TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT ''
);
