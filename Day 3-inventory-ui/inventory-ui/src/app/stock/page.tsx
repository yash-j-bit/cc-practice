import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { listProducts } from '@/modules/products';
import { listMovements, listWarehouses, MovementFilter } from '@/modules/stock';
import { formatDateTime, formatNumber } from '@/lib/format';
import { StockForm } from './components/stock-form';
import { MovementsFilters } from './components/movements-filters';
import { MovementsPagination } from './components/movements-pagination';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '在庫管理 — Inventory UI',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function asInt(v: string | string[] | undefined): number | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}

export default async function StockPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter: MovementFilter = {
    from: asString(sp.from),
    to: asString(sp.to),
    productId: asInt(sp.productId),
    warehouseId: asInt(sp.warehouseId),
    type:
      asString(sp.type) === 'in' || asString(sp.type) === 'out'
        ? (asString(sp.type) as 'in' | 'out')
        : undefined,
    page: asInt(sp.page) ?? 1,
    pageSize: 20,
  };

  const products = listProducts();
  const warehouses = listWarehouses();
  const movementsResult = listMovements(filter);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">在庫管理</h1>
        <p className="text-sm text-muted-foreground">
          入庫・出庫を登録し、入出庫履歴を確認します。
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <StockForm type="in" products={products} warehouses={warehouses} />
        <StockForm type="out" products={products} warehouses={warehouses} />
      </section>

      <section className="grid gap-3">
        <Card>
          <CardHeader>
            <CardTitle>入出庫履歴</CardTitle>
            <CardDescription>
              期間・商品・倉庫・区分で絞り込みできます。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <MovementsFilters products={products} warehouses={warehouses} />
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日時</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>倉庫</TableHead>
                    <TableHead>区分</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead>メモ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsResult.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        該当する履歴がありません。
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementsResult.items.map((m) => {
                      const p = productMap.get(m.productId);
                      const w = warehouseMap.get(m.warehouseId);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDateTime(m.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="grid">
                              <span>{p?.name ?? '-'}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {p?.sku ?? '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{w?.name ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant={m.type === 'in' ? 'default' : 'secondary'}>
                              {m.type === 'in' ? '入庫' : '出庫'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(m.quantity)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {m.note ?? ''}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <MovementsPagination
              page={movementsResult.page}
              pageSize={movementsResult.pageSize}
              total={movementsResult.total}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
