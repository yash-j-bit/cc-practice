import {
  InventoryRow,
  Order,
  OrderItem,
  Product,
  Shipment,
  StockMovement,
  Warehouse,
} from './schema';
import { seedStore } from './seed';

export interface Store {
  products: Product[];
  warehouses: Warehouse[];
  inventory: InventoryRow[];
  movements: StockMovement[];
  orders: Order[];
  orderItems: OrderItem[];
  shipments: Shipment[];
  nextId: { [k: string]: number };
}

declare global {
  // eslint-disable-next-line no-var
  var __INVENTORY_STORE__: Store | undefined;
}

function createStore(): Store {
  const s: Store = {
    products: [],
    warehouses: [],
    inventory: [],
    movements: [],
    orders: [],
    orderItems: [],
    shipments: [],
    nextId: {
      product: 1,
      warehouse: 1,
      movement: 1,
      order: 1,
      orderItem: 1,
      shipment: 1,
    },
  };
  seedStore(s);
  return s;
}

export function db(): Store {
  if (!globalThis.__INVENTORY_STORE__) {
    globalThis.__INVENTORY_STORE__ = createStore();
  }
  return globalThis.__INVENTORY_STORE__;
}

export function nextId(kind: keyof Store['nextId']): number {
  const s = db();
  const id = s.nextId[kind];
  s.nextId[kind] = id + 1;
  return id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
