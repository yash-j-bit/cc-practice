import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { recentMovements } from '@/modules/reports';

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
    return ok(recentMovements(Number.isFinite(limit) ? limit : 10));
  } catch (err) {
    return handleError(err);
  }
}
