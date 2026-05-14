'use client';

import { useMemo, useState } from 'react';

import { Product } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ProductFormDialog } from './product-form-dialog';
import { ProductDeleteDialog } from './product-delete-dialog';
import { formatJPY } from '@/lib/format';

type SortKey = 'sku' | 'name' | 'price' | 'cost' | 'minStock';

interface Props {
  products: Product[];
}

export function ProductsTable({ products }: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sku');
  const [asc, setAsc] = useState(true);

  const rows = useMemo(() => {
    const filtered = query
      ? products.filter(
          (p) =>
            p.sku.toLowerCase().includes(query.toLowerCase()) ||
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
      : products;
    const sorted = filtered.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return asc ? av - bv : bv - av;
      }
      return asc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [products, query, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(true);
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span aria-hidden>{asc ? ' ▲' : ' ▼'}</span>;
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="商品を SKU または商品名で検索"
          placeholder="SKU または商品名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        <ProductFormDialog trigger={<Button>＋ 商品を追加</Button>} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort('sku')}
                  className="font-medium"
                >
                  SKU{sortIndicator('sku')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort('name')}
                  className="font-medium"
                >
                  商品名{sortIndicator('name')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('price')}
                  className="font-medium"
                >
                  価格{sortIndicator('price')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('cost')}
                  className="font-medium"
                >
                  原価{sortIndicator('cost')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort('minStock')}
                  className="font-medium"
                >
                  最低在庫{sortIndicator('minStock')}
                </button>
              </TableHead>
              <TableHead className="w-[180px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  該当する商品がありません。
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{formatJPY(p.price)}</TableCell>
                  <TableCell className="text-right">{formatJPY(p.cost)}</TableCell>
                  <TableCell className="text-right">{p.minStock}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ProductFormDialog
                        product={p}
                        trigger={
                          <Button size="sm" variant="outline">
                            編集
                          </Button>
                        }
                      />
                      <ProductDeleteDialog
                        product={p}
                        trigger={
                          <Button size="sm" variant="destructive">
                            削除
                          </Button>
                        }
                      />
                    </div>
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
