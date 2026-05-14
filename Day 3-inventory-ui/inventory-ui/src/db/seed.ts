import type { Store } from './store';

const day = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
};

export function seedStore(s: Store): void {
  const now = day(0);

  s.warehouses.push(
    { id: 1, name: '東京倉庫', location: '東京' },
    { id: 2, name: '大阪倉庫', location: '大阪' },
  );
  s.nextId.warehouse = 3;

  const products = [
    { sku: 'SKU-001', name: 'ノート A5', price: 380, cost: 200, minStock: 20 },
    { sku: 'SKU-002', name: 'ボールペン 黒', price: 120, cost: 60, minStock: 50 },
    { sku: 'SKU-003', name: 'ファイル A4', price: 250, cost: 130, minStock: 15 },
    { sku: 'SKU-004', name: 'ホッチキス', price: 980, cost: 540, minStock: 8 },
    { sku: 'SKU-005', name: '付箋 大', price: 320, cost: 170, minStock: 25 },
  ];
  products.forEach((p, i) => {
    s.products.push({
      id: i + 1,
      sku: p.sku,
      name: p.name,
      description: null,
      price: p.price,
      cost: p.cost,
      minStock: p.minStock,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
  s.nextId.product = products.length + 1;

  // Initial inventory: split between warehouses
  const initial: Array<[number, number, number]> = [
    [1, 1, 80],
    [1, 2, 30],
    [2, 1, 200],
    [2, 2, 100],
    [3, 1, 5], // below minStock to surface alerts
    [3, 2, 0],
    [4, 1, 12],
    [5, 1, 60],
    [5, 2, 10],
  ];
  initial.forEach(([productId, warehouseId, quantity]) => {
    s.inventory.push({ productId, warehouseId, quantity, updatedAt: now });
  });

  // Past stock movements (last ~10 days)
  let mvId = 1;
  const moves: Array<{
    productId: number;
    warehouseId: number;
    type: 'in' | 'out';
    quantity: number;
    daysAgo: number;
  }> = [
    { productId: 1, warehouseId: 1, type: 'in', quantity: 100, daysAgo: 9 },
    { productId: 1, warehouseId: 1, type: 'out', quantity: 20, daysAgo: 6 },
    { productId: 2, warehouseId: 1, type: 'in', quantity: 250, daysAgo: 8 },
    { productId: 2, warehouseId: 2, type: 'in', quantity: 100, daysAgo: 5 },
    { productId: 2, warehouseId: 1, type: 'out', quantity: 50, daysAgo: 4 },
    { productId: 3, warehouseId: 1, type: 'in', quantity: 25, daysAgo: 7 },
    { productId: 3, warehouseId: 1, type: 'out', quantity: 20, daysAgo: 3 },
    { productId: 4, warehouseId: 1, type: 'in', quantity: 12, daysAgo: 6 },
    { productId: 5, warehouseId: 1, type: 'in', quantity: 60, daysAgo: 5 },
    { productId: 5, warehouseId: 2, type: 'in', quantity: 10, daysAgo: 2 },
    { productId: 1, warehouseId: 2, type: 'in', quantity: 30, daysAgo: 1 },
  ];
  moves.forEach((m) => {
    s.movements.push({
      id: mvId++,
      productId: m.productId,
      warehouseId: m.warehouseId,
      type: m.type,
      quantity: m.quantity,
      referenceType: 'seed',
      referenceId: null,
      note: null,
      createdAt: day(-m.daysAgo),
    });
  });
  s.nextId.movement = mvId;

  // Sample orders across last 7 days
  let orderId = 1;
  let itemId = 1;
  const orderFixtures: Array<{
    customer: string;
    items: Array<{ productId: number; quantity: number }>;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
    daysAgo: number;
  }> = [
    {
      customer: '田中商店',
      items: [
        { productId: 1, quantity: 5 },
        { productId: 2, quantity: 20 },
      ],
      status: 'delivered',
      daysAgo: 6,
    },
    {
      customer: '佐藤事務',
      items: [{ productId: 3, quantity: 10 }],
      status: 'shipped',
      daysAgo: 4,
    },
    {
      customer: '鈴木商事',
      items: [
        { productId: 1, quantity: 3 },
        { productId: 5, quantity: 4 },
      ],
      status: 'confirmed',
      daysAgo: 2,
    },
    {
      customer: '高橋オフィス',
      items: [{ productId: 4, quantity: 1 }],
      status: 'pending',
      daysAgo: 1,
    },
    {
      customer: '伊藤商会',
      items: [
        { productId: 2, quantity: 30 },
        { productId: 3, quantity: 5 },
      ],
      status: 'delivered',
      daysAgo: 5,
    },
    {
      customer: '渡辺事務',
      items: [{ productId: 5, quantity: 8 }],
      status: 'delivered',
      daysAgo: 0,
    },
  ];
  orderFixtures.forEach((o) => {
    let total = 0;
    const items = o.items.map((it) => {
      const prod = s.products.find((p) => p.id === it.productId)!;
      const subtotal = prod.price * it.quantity;
      total += subtotal;
      return {
        id: itemId++,
        orderId,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: prod.price,
        subtotal,
      };
    });
    s.orderItems.push(...items);
    s.orders.push({
      id: orderId,
      customerName: o.customer,
      status: o.status,
      totalAmount: total,
      createdAt: day(-o.daysAgo),
      updatedAt: day(-o.daysAgo),
    });
    orderId++;
  });
  s.nextId.order = orderId;
  s.nextId.orderItem = itemId;
}
