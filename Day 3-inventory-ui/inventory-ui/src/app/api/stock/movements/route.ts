import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api-helpers';
import { listMovements, MovementFilter } from '@/modules/stock';

function parseInt32(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter: MovementFilter = {
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      productId: parseInt32(sp.get('productId')),
      warehouseId: parseInt32(sp.get('warehouseId')),
      type:
        sp.get('type') === 'in' || sp.get('type') === 'out'
          ? (sp.get('type') as 'in' | 'out')
          : undefined,
      page: parseInt32(sp.get('page')) ?? 1,
      pageSize: parseInt32(sp.get('pageSize')) ?? 20,
    };
    return ok(listMovements(filter));
  } catch (err) {
    return handleError(err);
  }
}
