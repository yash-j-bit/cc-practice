import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { dailySales, salesByProduct } from '@/modules/reports';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') ?? undefined;
    const to = sp.get('to') ?? undefined;
    return ok({
      daily: dailySales(from, to),
      byProduct: salesByProduct(from, to),
    });
  } catch (err) {
    return handleError(err);
  }
}
