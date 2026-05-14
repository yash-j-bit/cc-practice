'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Warehouse } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { shipOrderAction } from '@/app/orders/actions';

interface Props {
  trigger: React.ReactElement;
  orderId: number;
  warehouses: Warehouse[];
}

const carriers = ['ヤマト運輸', '佐川急便', '日本郵便', '西濃運輸'];

export function OrderShipDialog({ trigger, orderId, warehouses }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [errors, setErrors] = useState<{
    carrier?: string;
    trackingNumber?: string;
    warehouseId?: string;
  }>({});

  function reset() {
    setCarrier('');
    setTrackingNumber('');
    setWarehouseId(0);
    setErrors({});
  }

  function submit() {
    const next: typeof errors = {};
    if (!carrier) next.carrier = '配送業者を選択してください';
    if (!trackingNumber.trim()) next.trackingNumber = '追跡番号を入力してください';
    if (!warehouseId) next.warehouseId = '発送元倉庫を選択してください';
    setErrors(next);
    if (Object.keys(next).length) return;

    startTransition(async () => {
      const result = await shipOrderAction(orderId, {
        carrier,
        trackingNumber: trackingNumber.trim(),
        warehouseId,
      });
      if (result.ok) {
        toast.success('発送処理を完了しました');
        setOpen(false);
        reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>発送処理</DialogTitle>
          <DialogDescription>
            配送業者と追跡番号を入力します。発送元倉庫から在庫が引き落とされます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>配送業者</Label>
            <Select value={carrier} onValueChange={(v) => setCarrier(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {carriers.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.carrier ? (
              <p className="text-sm font-medium text-destructive">{errors.carrier}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tracking-number">追跡番号</Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
            {errors.trackingNumber ? (
              <p className="text-sm font-medium text-destructive">
                {errors.trackingNumber}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label>発送元倉庫</Label>
            <Select
              value={warehouseId ? String(warehouseId) : ''}
              onValueChange={(v) => setWarehouseId(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="倉庫を選択" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.warehouseId ? (
              <p className="text-sm font-medium text-destructive">
                {errors.warehouseId}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '送信中…' : '発送を確定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
