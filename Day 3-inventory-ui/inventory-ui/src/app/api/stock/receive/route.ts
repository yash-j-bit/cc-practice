import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { receiveSchema, receiveStock } from '@/modules/stock';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = receiveSchema.parse(body);
    return ok(receiveStock(input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
