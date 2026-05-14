import { z } from 'zod';
import { db, nextId, nowIso } from '@/db/store';
import { Product } from '@/db/schema';
import { ConflictError, NotFoundError } from '@/errors';

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, 'SKU は必須です').max(40),
  name: z.string().trim().min(1, '商品名は必須です').max(120),
  description: z.string().trim().max(500).nullish(),
  price: z.number().nonnegative('価格は 0 以上で入力してください'),
  cost: z.number().nonnegative('原価は 0 以上で入力してください'),
  minStock: z.number().int().nonnegative().default(0),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

function normalizeDescription(input: string | null | undefined): string | null {
  if (input == null) return null;
  return input.trim() === '' ? null : input.trim();
}

export function listProducts(): Product[] {
  return db()
    .products.filter((p) => p.deletedAt === null)
    .slice()
    .sort((a, b) => a.id - b.id);
}

export function getProduct(id: number): Product {
  const product = db().products.find((p) => p.id === id && p.deletedAt === null);
  if (!product) throw new NotFoundError('商品', id);
  return product;
}

export function createProduct(input: ProductCreateInput): Product {
  const s = db();
  if (s.products.some((p) => p.deletedAt === null && p.sku === input.sku)) {
    throw new ConflictError(`SKU「${input.sku}」は既に存在します`);
  }
  const now = nowIso();
  const product: Product = {
    id: nextId('product'),
    sku: input.sku,
    name: input.name,
    description: normalizeDescription(input.description ?? null),
    price: input.price,
    cost: input.cost,
    minStock: input.minStock,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  s.products.push(product);
  return product;
}

export function updateProduct(id: number, input: ProductUpdateInput): Product {
  const product = getProduct(id);
  if (input.sku !== undefined && input.sku !== product.sku) {
    if (
      db().products.some(
        (p) => p.deletedAt === null && p.sku === input.sku && p.id !== id,
      )
    ) {
      throw new ConflictError(`SKU「${input.sku}」は既に存在します`);
    }
    product.sku = input.sku;
  }
  if (input.name !== undefined) product.name = input.name;
  if (input.description !== undefined)
    product.description = normalizeDescription(input.description);
  if (input.price !== undefined) product.price = input.price;
  if (input.cost !== undefined) product.cost = input.cost;
  if (input.minStock !== undefined) product.minStock = input.minStock;
  product.updatedAt = nowIso();
  return product;
}

export function deleteProduct(id: number): void {
  const product = getProduct(id);
  product.deletedAt = nowIso();
  product.updatedAt = product.deletedAt;
}
