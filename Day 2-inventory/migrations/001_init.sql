-- UP
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse
  ON inventory (product_id, warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON stock_movements (product_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status, created_at);

INSERT OR IGNORE INTO warehouses (name, location) VALUES ('Main', 'default');

-- DOWN
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP INDEX IF EXISTS idx_stock_movements_product;
DROP INDEX IF EXISTS idx_inventory_product_warehouse;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS products;
