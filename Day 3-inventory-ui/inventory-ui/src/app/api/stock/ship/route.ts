import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { shipSchema, shipStock } from '@/modules/stock';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = shipSchema.parse(body);
    return ok(shipStock(input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
