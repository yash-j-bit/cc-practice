import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import {
  createOrder,
  listOrders,
  orderCreateSchema,
  orderStatusSchema,
} from '@/modules/orders';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const statusRaw = sp.get('status');
    const parsedStatus = statusRaw
      ? orderStatusSchema.safeParse(statusRaw)
      : null;
    const q = sp.get('q') ?? undefined;
    return ok(
      listOrders({
        status: parsedStatus?.success ? parsedStatus.data : undefined,
        q: q ?? undefined,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = orderCreateSchema.parse(body);
    return ok(createOrder(input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
