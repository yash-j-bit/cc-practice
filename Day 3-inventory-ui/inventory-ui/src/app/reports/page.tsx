import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  dailySales,
  inventoryValuation,
  salesByProduct,
} from '@/modules/reports';
import { formatJPY, formatNumber } from '@/lib/format';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { DateRange } from './components/date-range';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'レポート — Inventory UI',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const from = asString(sp.from);
  const to = asString(sp.to);

  const daily = dailySales(from, to);
  const byProduct = salesByProduct(from, to);
  const valuation = inventoryValuation();

  const exportSalesQs = new URLSearchParams();
  if (from) exportSalesQs.set('from', from);
  if (to) exportSalesQs.set('to', to);
  const salesCsvHref = `/api/reports/export/sales${
    exportSalesQs.toString() ? `?${exportSalesQs.toString()}` : ''
  }`;
  const inventoryCsvHref = '/api/reports/export/inventory';

  const linkClass = cn(buttonVariants({ variant: 'default' }));

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">レポート</h1>
        <p className="text-sm text-muted-foreground">
          売上・在庫評価・CSV エクスポート
        </p>
      </header>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">売上レポート</TabsTrigger>
          <TabsTrigger value="inventory">在庫評価</TabsTrigger>
          <TabsTrigger value="export">エクスポート</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="grid gap-4 pt-2">
          <DateRange />
          <Card>
            <CardHeader>
              <CardTitle>日別売上</CardTitle>
              <CardDescription>キャンセルを除く受注金額</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart data={daily} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>商品別売上</CardTitle>
              <CardDescription>売上額の多い順</CardDescription>
            </CardHeader>
            <CardContent>
              {byProduct.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  期間内の売上はまだありません。
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">売上</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProduct.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.quantity)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatJPY(row.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="grid gap-4 pt-2">
          <Card>
            <CardHeader>
              <CardDescription>現在の在庫金額（原価ベース）</CardDescription>
              <CardTitle className="text-3xl">
                {formatJPY(valuation.total)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>商品別在庫金額</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">在庫数</TableHead>
                    <TableHead className="text-right">原価</TableHead>
                    <TableHead className="text-right">評価額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valuation.rows.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.quantity)}
                      </TableCell>
                      <TableCell className="text-right">{formatJPY(row.cost)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatJPY(row.valuation)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="grid gap-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle>CSV ダウンロード</CardTitle>
              <CardDescription>
                Excel で開く場合は文字コードに注意してください（UTF-8 BOM 付き）
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <a className={linkClass} href={salesCsvHref} download>
                売上データを CSV でダウンロード
              </a>
              <a className={linkClass} href={inventoryCsvHref} download>
                在庫データを CSV でダウンロード
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
