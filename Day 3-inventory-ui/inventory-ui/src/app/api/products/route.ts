import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import {
  createProduct,
  listProducts,
  productCreateSchema,
} from '@/modules/products';

export async function GET() {
  try {
    return ok(listProducts());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = productCreateSchema.parse(body);
    const created = createProduct(input);
    return ok(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
