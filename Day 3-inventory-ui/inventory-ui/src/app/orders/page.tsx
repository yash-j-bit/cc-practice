import { listProducts } from '@/modules/products';
import { listOrders } from '@/modules/orders';
import { OrderStatus } from '@/db/schema';
import { listWarehouses } from '@/modules/stock';
import { OrdersTable } from './components/orders-table';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '受注管理 — Inventory UI',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusRaw = asString(sp.status);
  const status = STATUSES.includes(statusRaw as OrderStatus)
    ? (statusRaw as OrderStatus)
    : undefined;
  const q = asString(sp.q);

  const orders = listOrders({ status, q });
  const products = listProducts();
  const warehouses = listWarehouses();

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">受注管理</h1>
        <p className="text-sm text-muted-foreground">
          受注の作成・ステータス変更・発送処理を行います。
        </p>
      </header>
      <OrdersTable orders={orders} products={products} warehouses={warehouses} />
    </div>
  );
}
