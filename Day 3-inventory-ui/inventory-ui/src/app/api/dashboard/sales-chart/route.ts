import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { dailySales } from '@/modules/reports';

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from') ?? undefined;
    const to = req.nextUrl.searchParams.get('to') ?? undefined;
    return ok(dailySales(from ?? undefined, to ?? undefined));
  } catch (err) {
    return handleError(err);
  }
}
