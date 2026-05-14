'use server';

import { revalidatePath } from 'next/cache';
import {
  createProduct,
  deleteProduct,
  productCreateSchema,
  productUpdateSchema,
  updateProduct,
} from '@/modules/products';
import { DomainError } from '@/errors';

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function asError(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return '予期しないエラーが発生しました';
}

export async function createProductAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const data = productCreateSchema.parse(input);
    const product = createProduct(data);
    revalidatePath('/products');
    revalidatePath('/');
    return { ok: true, data: product };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}

export async function updateProductAction(
  id: number,
  input: unknown,
): Promise<ActionResult> {
  try {
    const data = productUpdateSchema.parse(input);
    const product = updateProduct(id, data);
    revalidatePath('/products');
    revalidatePath('/');
    return { ok: true, data: product };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}

export async function deleteProductAction(id: number): Promise<ActionResult> {
  try {
    deleteProduct(id);
    revalidatePath('/products');
    revalidatePath('/');
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}
