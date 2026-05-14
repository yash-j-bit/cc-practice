import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import {
  deleteProduct,
  getProduct,
  productUpdateSchema,
  updateProduct,
} from '@/modules/products';
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
    return ok(getProduct(parseId(id)));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const input = productUpdateSchema.parse(body);
    return ok(updateProduct(parseId(id), input));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    deleteProduct(parseId(id));
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
