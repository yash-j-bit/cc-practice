export type ID = number;

export interface Product {
  id: ID;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  minStock: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: ID;
  name: string;
  location: string | null;
}

export interface InventoryRow {
  productId: ID;
  warehouseId: ID;
  quantity: number;
  updatedAt: string;
}

export type MovementType = 'in' | 'out';

export interface StockMovement {
  id: ID;
  productId: ID;
  warehouseId: ID;
  type: MovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: ID | null;
  note: string | null;
  createdAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: ID;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: ID;
  orderId: ID;
  productId: ID;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type ShipmentStatus = 'pending' | 'shipped' | 'delivered' | 'returned';

export interface Shipment {
  id: ID;
  orderId: ID;
  trackingNumber: string | null;
  carrier: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
}
