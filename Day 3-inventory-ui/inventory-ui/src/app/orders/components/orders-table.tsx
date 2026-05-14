'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { OrderStatus, Product, Warehouse } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { OrderCreateDialog } from './order-create-dialog';
import { OrderDetailDialog } from './order-detail-dialog';
import { formatDateTime, formatJPY } from '@/lib/format';
import type { OrderWithItems } from '@/modules/orders';

interface Props {
  orders: OrderWithItems[];
  products: Product[];
  warehouses: Warehouse[];
}

const ALL = '__all__';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '受注待ち',
  confirmed: '確定',
  shipped: '発送済',
  delivered: '配送完了',
  cancelled: 'キャンセル',
};

const STATUS_VARIANT: Record<
  OrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  confirmed: 'default',
  shipped: 'secondary',
  delivered: 'secondary',
  cancelled: 'destructive',
};

export function OrdersTable({ orders, products, warehouses }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const statusFilter: string = params.get('status') ?? ALL;
  const queryValue = params.get('q') ?? '';

  function update(next: Record<string, string | null | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== ALL) sp.set(k, v);
      else sp.delete(k);
    });
    startTransition(() => router.push(`/orders?${sp.toString()}`));
  }

  return (
    <section className="grid gap-4">
      <div
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end"
        aria-busy={pending}
      >
        <div className="grid gap-1">
          <Label htmlFor="orders-q">顧客名で検索</Label>
          <Input
            id="orders-q"
            defaultValue={queryValue}
            placeholder="例: 田中商店"
            onBlur={(e) => update({ q: e.target.value || undefined })}
          />
        </div>
        <div className="grid gap-1">
          <Label>ステータス</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => update({ status: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>すべて</SelectItem>
              {(
                ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <OrderCreateDialog
          products={products}
          trigger={<Button>＋ 新規受注</Button>}
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>受注番号</TableHead>
              <TableHead>顧客</TableHead>
              <TableHead>作成日時</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="text-right">合計</TableHead>
              <TableHead className="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  該当する受注がありません。
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">#{o.id}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell className="text-xs">
                    {formatDateTime(o.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status]}>
                      {STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatJPY(o.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <OrderDetailDialog
                      order={o}
                      warehouses={warehouses}
                      trigger={
                        <Button size="sm" variant="outline">
                          詳細
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
