'use server';

import { revalidatePath } from 'next/cache';
import {
  createOrder,
  orderCreateSchema,
  orderStatusSchema,
  shipOrder,
  shipOrderSchema,
  updateOrderStatus,
} from '@/modules/orders';
import { OrderStatus } from '@/db/schema';
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

export async function createOrderAction(input: unknown): Promise<ActionResult> {
  try {
    const data = orderCreateSchema.parse(input);
    const order = createOrder(data);
    revalidatePath('/orders');
    revalidatePath('/');
    return { ok: true, data: order };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}

export async function updateOrderStatusAction(
  id: number,
  status: OrderStatus,
): Promise<ActionResult> {
  try {
    const parsed = orderStatusSchema.parse(status);
    const order = updateOrderStatus(id, parsed);
    revalidatePath('/orders');
    revalidatePath('/');
    return { ok: true, data: order };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}

export async function shipOrderAction(
  id: number,
  input: unknown,
): Promise<ActionResult> {
  try {
    const data = shipOrderSchema.parse(input);
    const order = shipOrder(id, data);
    revalidatePath('/orders');
    revalidatePath('/stock');
    revalidatePath('/');
    return { ok: true, data: order };
  } catch (err) {
    return { ok: false, error: asError(err) };
  }
}
