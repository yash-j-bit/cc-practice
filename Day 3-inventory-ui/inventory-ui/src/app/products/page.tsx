import { Suspense } from 'react';
import { listProducts } from '@/modules/products';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductsTable } from './components/products-table';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '商品管理 — Inventory UI',
};

export default function ProductsPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">商品管理</h1>
        <p className="text-sm text-muted-foreground">
          商品の追加・編集・削除と一覧の確認ができます。
        </p>
      </header>
      <Suspense fallback={<TableSkeleton />}>
        <ProductsContent />
      </Suspense>
    </div>
  );
}

async function ProductsContent() {
  const products = listProducts();
  return <ProductsTable products={products} />;
}

function TableSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid gap-2 rounded-lg border bg-card p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
