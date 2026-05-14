import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  dailySales,
  dashboardSummary,
  lowStockAlerts,
  recentMovements,
} from '@/modules/reports';
import { formatDateTime, formatJPY, formatNumber } from '@/lib/format';
import { SalesChart } from '@/components/dashboard/sales-chart';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ダッシュボード — Inventory UI',
};

export default function DashboardPage() {
  const summary = dashboardSummary();
  const movements = recentMovements(10);
  const alerts = lowStockAlerts();
  const sales = dailySales();

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground">
          在庫サマリー・直近の入出庫・低在庫アラート・直近 7 日間の売上
        </p>
      </header>

      <section
        aria-labelledby="summary-heading"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <h2 id="summary-heading" className="sr-only">
          在庫サマリー
        </h2>
        <Card>
          <CardHeader>
            <CardDescription>総商品数</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(summary.productCount)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>総在庫数</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(summary.totalQuantity)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>在庫金額（原価ベース）</CardDescription>
            <CardTitle className="text-3xl">
              {formatJPY(summary.inventoryValue)}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>直近 7 日間の売上</CardTitle>
            <CardDescription>キャンセル除く</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={sales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>低在庫アラート</CardTitle>
            <CardDescription>最低在庫を下回る商品</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <Alert>
                <AlertTitle>問題なし</AlertTitle>
                <AlertDescription>
                  すべての商品が最低在庫以上です。
                </AlertDescription>
              </Alert>
            ) : (
              <ul className="grid gap-2">
                {alerts.map((a) => (
                  <li
                    key={a.productId}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="grid">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">
                        在庫 {a.quantity} / 最低 {a.minStock}
                      </span>
                    </div>
                    <Badge variant="destructive">不足 {a.shortage}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>直近の入出庫（10 件）</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                入出庫履歴はまだありません。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日時</TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead>倉庫</TableHead>
                      <TableHead>区分</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateTime(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="grid">
                            <span>{m.productName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {m.sku}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{m.warehouseName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={m.type === 'in' ? 'default' : 'secondary'}
                          >
                            {m.type === 'in' ? '入庫' : '出庫'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
