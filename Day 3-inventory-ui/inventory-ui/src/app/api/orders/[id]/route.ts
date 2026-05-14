import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { getOrder, orderStatusSchema, updateOrderStatus } from '@/modules/orders';
import { ValidationError } from '@/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`不正な ID: ${raw}`);
  }
  return id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    return ok(getOrder(parseId(id)));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const status = orderStatusSchema.parse(body.status);
    return ok(updateOrderStatus(parseId(id), status));
  } catch (err) {
    return handleError(err);
  }
}
