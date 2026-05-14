'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Product, Warehouse } from '@/db/schema';
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

interface Props {
  products: Product[];
  warehouses: Warehouse[];
}

const ALL = '__all__';

export function MovementsFilters({ products, warehouses }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const productFilter: string = params.get('productId') ?? ALL;
  const warehouseFilter: string = params.get('warehouseId') ?? ALL;
  const typeFilter: string = params.get('type') ?? ALL;

  function update(next: Record<string, string | null | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== ALL) sp.set(k, v);
      else sp.delete(k);
    });
    sp.delete('page');
    startTransition(() => {
      router.push(`/stock?${sp.toString()}`);
    });
  }

  function reset() {
    startTransition(() => {
      router.push('/stock');
    });
  }

  return (
    <div
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-busy={pending}
    >
      <div className="grid gap-1">
        <Label htmlFor="filter-from">開始日</Label>
        <Input
          id="filter-from"
          type="date"
          defaultValue={params.get('from')?.slice(0, 10) ?? ''}
          onBlur={(e) =>
            update({
              from: e.target.value
                ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
                : undefined,
            })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="filter-to">終了日</Label>
        <Input
          id="filter-to"
          type="date"
          defaultValue={params.get('to')?.slice(0, 10) ?? ''}
          onBlur={(e) =>
            update({
              to: e.target.value
                ? new Date(`${e.target.value}T23:59:59Z`).toISOString()
                : undefined,
            })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label>商品</Label>
        <Select
          value={productFilter}
          onValueChange={(v) => update({ productId: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>倉庫</Label>
        <Select
          value={warehouseFilter}
          onValueChange={(v) => update({ warehouseId: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>区分</Label>
        <Select
          value={typeFilter}
          onValueChange={(v) => update({ type: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて</SelectItem>
            <SelectItem value="in">入庫</SelectItem>
            <SelectItem value="out">出庫</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <Button variant="outline" type="button" onClick={reset} disabled={pending}>
          フィルタをクリア
        </Button>
      </div>
    </div>
  );
}
