import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { shipOrder, shipOrderSchema } from '@/modules/orders';
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

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = shipOrderSchema.parse(body);
    return ok(shipOrder(parseId(id), input));
  } catch (err) {
    return handleError(err);
  }
}
