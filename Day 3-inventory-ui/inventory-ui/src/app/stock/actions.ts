'use server';

import { revalidatePath } from 'next/cache';
import { receiveSchema, receiveStock, shipSchema, shipStock } from '@/modules/stock';
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

export async function receiveStockAction(input: unknown): Promise<ActionResult> {
  try {
    const data = receiveSchema.parse(input);
    const movement = receiveStock(data);
    revalidatePath('/stock');
    revalidatePath('/');
    return { ok: true, data: movement };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}

export async function shipStockAction(input: unknown): Promise<ActionResult> {
  try {
    const data = shipSchema.parse(input);
    const movement = shipStock(data);
    revalidatePath('/stock');
    revalidatePath('/');
    return { ok: true, data: movement };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}
