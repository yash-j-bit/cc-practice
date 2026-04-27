-- UP
CREATE TABLE IF NOT EXISTS stock_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  min_quantity INTEGER NOT NULL CHECK (min_quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

-- DOWN
DROP TABLE IF EXISTS stock_thresholds;
