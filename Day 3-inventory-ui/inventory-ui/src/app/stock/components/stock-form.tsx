'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

import { Product, Warehouse } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { receiveStockAction, shipStockAction } from '@/app/stock/actions';

const formSchema = z.object({
  productId: z.number().int().positive('商品を選択してください'),
  warehouseId: z.number().int().positive('倉庫を選択してください'),
  quantity: z.number().int().positive('数量は 1 以上の整数で入力してください'),
  note: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  type: 'in' | 'out';
  products: Product[];
  warehouses: Warehouse[];
}

export function StockForm({ type, products, warehouses }: Props) {
  const [pending, startTransition] = useTransition();
  const [resetTick, setResetTick] = useState(0);

  const form = useForm<FormValues>({
    defaultValues: {
      productId: 0,
      warehouseId: 0,
      quantity: 1,
      note: '',
    },
  });

  function onSubmit(values: FormValues) {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        if (issue.path.length === 0) return;
        form.setError(issue.path[0] as keyof FormValues, {
          type: 'manual',
          message: issue.message,
        });
      });
      return;
    }
    startTransition(async () => {
      const result =
        type === 'in'
          ? await receiveStockAction(parsed.data)
          : await shipStockAction(parsed.data);
      if (result.ok) {
        toast.success(type === 'in' ? '入庫を登録しました' : '出庫を登録しました');
        form.reset({
          productId: 0,
          warehouseId: 0,
          quantity: 1,
          note: '',
        });
        setResetTick((t) => t + 1);
      } else {
        toast.error(result.error);
      }
    });
  }

  const heading = type === 'in' ? '入庫登録' : '出庫登録';
  const description =
    type === 'in'
      ? '商品の入庫を倉庫単位で登録します。'
      : '在庫数を超える出庫はサーバ側で拒否されます。';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            key={resetTick}
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="商品を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}（{p.sku}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>倉庫</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>数量</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メモ (任意)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : type === 'in' ? '入庫を登録' : '出庫を登録'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
