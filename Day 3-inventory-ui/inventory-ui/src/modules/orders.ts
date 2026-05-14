import { z } from 'zod';
import { db, nextId, nowIso } from '@/db/store';
import { Order, OrderItem, OrderStatus, Shipment } from '@/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/errors';
import { getProduct } from './products';
import { inventoryByProduct, shipStock } from './stock';

export const orderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const orderCreateSchema = z.object({
  customerName: z.string().trim().min(1, '顧客名は必須です').max(120),
  items: z.array(orderItemInputSchema).min(1, '商品を 1 件以上選択してください'),
});

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
]);

export const shipOrderSchema = z.object({
  carrier: z.string().trim().min(1, '配送業者を入力してください').max(80),
  trackingNumber: z.string().trim().min(1, '追跡番号を入力してください').max(80),
  warehouseId: z.number().int().positive('発送元倉庫を選択してください'),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

export interface OrderWithItems extends Order {
  items: Array<OrderItem & { productName: string; sku: string }>;
  shipment: Shipment | null;
}

export function listOrders(filter: { status?: OrderStatus; q?: string } = {}): OrderWithItems[] {
  const s = db();
  return s.orders
    .filter((o) => (filter.status ? o.status === filter.status : true))
    .filter((o) =>
      filter.q ? o.customerName.toLowerCase().includes(filter.q.toLowerCase()) : true,
    )
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((o) => decorate(o));
}

export function getOrder(id: number): OrderWithItems {
  const order = db().orders.find((o) => o.id === id);
  if (!order) throw new NotFoundError('受注', id);
  return decorate(order);
}

function decorate(order: Order): OrderWithItems {
  const s = db();
  const items = s.orderItems
    .filter((it) => it.orderId === order.id)
    .map((it) => {
      const product = s.products.find((p) => p.id === it.productId);
      return {
        ...it,
        productName: product?.name ?? '(削除済み商品)',
        sku: product?.sku ?? '-',
      };
    });
  const shipment = s.shipments.find((sh) => sh.orderId === order.id) ?? null;
  return { ...order, items, shipment };
}

export function createOrder(input: OrderCreateInput): OrderWithItems {
  const s = db();
  // Validate availability across warehouses (sum of stock).
  const inventory = inventoryByProduct();
  for (const item of input.items) {
    const product = getProduct(item.productId);
    const stock = inventory.find((row) => row.productId === product.id);
    const available = stock?.totalQuantity ?? 0;
    if (available < item.quantity) {
      throw new ValidationError(
        `「${product.name}」の在庫不足のため受注できません (在庫 ${available} / 要求 ${item.quantity})`,
      );
    }
  }

  const orderId = nextId('order');
  let total = 0;
  const items: OrderItem[] = input.items.map((it) => {
    const product = getProduct(it.productId);
    const subtotal = product.price * it.quantity;
    total += subtotal;
    return {
      id: nextId('orderItem'),
      orderId,
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: product.price,
      subtotal,
    };
  });

  const now = nowIso();
  const order: Order = {
    id: orderId,
    customerName: input.customerName,
    status: 'pending',
    totalAmount: total,
    createdAt: now,
    updatedAt: now,
  };
  s.orders.push(order);
  s.orderItems.push(...items);
  return decorate(order);
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function updateOrderStatus(id: number, status: OrderStatus): OrderWithItems {
  const s = db();
  const order = s.orders.find((o) => o.id === id);
  if (!order) throw new NotFoundError('受注', id);
  if (order.status === status) return decorate(order);
  if (!STATUS_FLOW[order.status].includes(status)) {
    throw new ConflictError(
      `ステータスを ${order.status} から ${status} に変更できません`,
    );
  }
  order.status = status;
  order.updatedAt = nowIso();
  return decorate(order);
}

export function shipOrder(id: number, input: ShipOrderInput): OrderWithItems {
  const s = db();
  const order = s.orders.find((o) => o.id === id);
  if (!order) throw new NotFoundError('受注', id);
  if (order.status !== 'confirmed') {
    throw new ConflictError(
      `confirmed のみ発送可能です (現在: ${order.status})`,
    );
  }

  const items = s.orderItems.filter((it) => it.orderId === id);
  for (const it of items) {
    shipStock(
      {
        productId: it.productId,
        warehouseId: input.warehouseId,
        quantity: it.quantity,
        note: `受注 #${id} の出荷`,
      },
      'order',
      id,
    );
  }

  const now = nowIso();
  const shipment: Shipment = {
    id: nextId('shipment'),
    orderId: id,
    trackingNumber: input.trackingNumber,
    carrier: input.carrier,
    status: 'shipped',
    shippedAt: now,
    deliveredAt: null,
  };
  s.shipments.push(shipment);
  order.status = 'shipped';
  order.updatedAt = now;
  return decorate(order);
}
