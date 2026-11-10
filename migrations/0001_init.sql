-- Shop catalog, stock, buyers, and orders. One row in shop tracks the save revision.

CREATE TABLE shop (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  items_per_box INTEGER NOT NULL,
  price INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  minimum_stock INTEGER NOT NULL,
  desired_stock INTEGER NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX idx_variants_product ON variants (product_id, position);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  items_per_box INTEGER NOT NULL,
  boxes INTEGER NOT NULL,
  ordered_items INTEGER NOT NULL,
  received_items INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ordered', 'partial', 'received')),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('sale', 'adjustment', 'receipt', 'purchase')),
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  purchase_id TEXT,
  position INTEGER NOT NULL
);

CREATE TABLE buyers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('placed', 'delivered', 'cancelled')),
  subtotal INTEGER NOT NULL,
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL CHECK (paid >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'bank')),
  comment TEXT NOT NULL,
  offer_kind TEXT CHECK (offer_kind IS NULL OR offer_kind IN ('discount', 'gift')),
  offer_id TEXT,
  offer_name TEXT,
  offer_percent INTEGER,
  offer_amount INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX idx_orders_buyer ON orders (buyer_id);

CREATE TABLE order_lines (
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  PRIMARY KEY (order_id, position)
);

CREATE TABLE order_gifts (
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (order_id, position)
);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  minimum_amount INTEGER NOT NULL,
  reward TEXT NOT NULL CHECK (reward IN ('discount', 'gift')),
  percent INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  position INTEGER NOT NULL
);
