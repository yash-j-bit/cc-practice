'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { OrderStatus, Warehouse } from '@/db/schema';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderShipDialog } from './order-ship-dialog';
import { updateOrderStatusAction } from '@/app/orders/actions';
import { formatDateTime, formatJPY } from '@/lib/format';
import type { OrderWithItems } from '@/modules/orders';

interface Props {
  trigger: React.ReactElement;
  order: OrderWithItems;
  warehouses: Warehouse[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '受注待ち',
  confirmed: '確定',
  shipped: '発送済',
  delivered: '配送完了',
  cancelled: 'キャンセル',
};

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function OrderDetailDialog({ trigger, order, warehouses }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');

  const allowed = NEXT_STATUSES[order.status];

  function applyStatus() {
    if (!nextStatus) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction(order.id, nextStatus);
      if (result.ok) {
        toast.success(`ステータスを ${STATUS_LABELS[nextStatus]} に変更しました`);
        setOpen(false);
        setNextStatus('');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>受注 #{order.id} — {order.customerName}</DialogTitle>
          <DialogDescription>
            作成日時: {formatDateTime(order.createdAt)}・現在のステータス:{' '}
            <Badge variant="outline">{STATUS_LABELS[order.status]}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">単価</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">小計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="grid">
                        <span>{it.productName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {it.sku}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatJPY(it.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatJPY(it.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2 rounded-md border bg-card px-3 py-2">
            <span className="text-sm font-medium">合計</span>
            <span className="text-lg font-semibold">
              {formatJPY(order.totalAmount)}
            </span>
          </div>

          {order.shipment ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">発送情報</p>
              <p>配送業者: {order.shipment.carrier}</p>
              <p>追跡番号: {order.shipment.trackingNumber}</p>
              {order.shipment.shippedAt ? (
                <p>発送日時: {formatDateTime(order.shipment.shippedAt)}</p>
              ) : null}
            </div>
          ) : null}

          {allowed.length > 0 ? (
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">ステータス変更</span>
                <Select
                  value={nextStatus}
                  onValueChange={(v) => setNextStatus((v as OrderStatus) || '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="変更先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowed.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={applyStatus} disabled={pending || !nextStatus}>
                {pending ? '保存中…' : 'ステータスを変更'}
              </Button>
            </div>
          ) : null}

          {order.status === 'confirmed' ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-sm font-medium">発送処理</p>
              <p className="mb-3 text-xs text-muted-foreground">
                配送業者・追跡番号・発送元倉庫を入力すると、在庫から自動的に出庫されます。
              </p>
              <OrderShipDialog
                orderId={order.id}
                warehouses={warehouses}
                trigger={<Button>発送処理を開始</Button>}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
