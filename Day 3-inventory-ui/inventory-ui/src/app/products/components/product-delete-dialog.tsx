'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Product } from '@/db/schema';
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
import { deleteProductAction } from '@/app/products/actions';

interface Props {
  product: Product;
  trigger: React.ReactElement;
}

export function ProductDeleteDialog({ product, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (result.ok) {
        toast.success(`「${product.name}」を削除しました`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>削除しますか？</DialogTitle>
          <DialogDescription>
            「{product.name}」(SKU: {product.sku}) を削除します。
            この操作は元に戻せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? '削除中…' : '削除する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
