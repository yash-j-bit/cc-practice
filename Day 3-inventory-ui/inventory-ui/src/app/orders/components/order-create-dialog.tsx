'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Product } from '@/db/schema';
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
import { createOrderAction } from '@/app/orders/actions';
import { formatJPY } from '@/lib/format';

interface Props {
  trigger: React.ReactElement;
  products: Product[];
}

interface Line {
  productId: number;
  quantity: number;
}

export function OrderCreateDialog({ trigger, products }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [customerName, setCustomerName] = useState('');
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([{ productId: 0, quantity: 1 }]);
  const [linesError, setLinesError] = useState<string | null>(null);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const p = productMap.get(line.productId);
        return p ? sum + p.price * line.quantity : sum;
      }, 0),
    [lines, productMap],
  );

  function reset() {
    setCustomerName('');
    setCustomerError(null);
    setLines([{ productId: 0, quantity: 1 }]);
    setLinesError(null);
  }

  function setLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: 0, quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function submit() {
    setCustomerError(null);
    setLinesError(null);
    if (!customerName.trim()) {
      setCustomerError('顧客名を入力してください');
      return;
    }
    const valid = lines.every(
      (l) => l.productId > 0 && Number.isInteger(l.quantity) && l.quantity > 0,
    );
    if (!valid || lines.length === 0) {
      setLinesError('商品と数量を正しく入力してください');
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({
        customerName: customerName.trim(),
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      if (result.ok) {
        toast.success('受注を作成しました');
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新規受注</DialogTitle>
          <DialogDescription>
            顧客名と商品（複数可）を選択してください。合計金額は自動計算されます。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="customer-name">顧客名</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              aria-invalid={Boolean(customerError)}
              aria-describedby={customerError ? 'customer-name-error' : undefined}
            />
            {customerError ? (
              <p
                id="customer-name-error"
                className="text-sm font-medium text-destructive"
              >
                {customerError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>商品</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLine}
              >
                ＋ 行を追加
              </Button>
            </div>

            <ul className="grid gap-2">
              {lines.map((line, idx) => {
                const p = productMap.get(line.productId);
                return (
                  <li
                    key={idx}
                    className="grid gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-[1fr_120px_auto] sm:items-center"
                  >
                    <Select
                      value={line.productId ? String(line.productId) : ''}
                      onValueChange={(v) => setLine(idx, { productId: Number(v) })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="商品を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((prod) => (
                          <SelectItem key={prod.id} value={String(prod.id)}>
                            {prod.name}（{formatJPY(prod.price)}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setLine(idx, { quantity: e.target.valueAsNumber })
                      }
                      aria-label="数量"
                    />
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span className="text-sm text-muted-foreground sm:hidden">
                        小計
                      </span>
                      <span className="text-sm font-medium">
                        {p ? formatJPY(p.price * line.quantity) : '—'}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        aria-label={`明細 ${idx + 1} を削除`}
                      >
                        削除
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {linesError ? (
              <p className="text-sm font-medium text-destructive">{linesError}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
            <span className="text-sm font-medium">合計金額</span>
            <span className="text-lg font-semibold">{formatJPY(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '作成中…' : '受注を作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
