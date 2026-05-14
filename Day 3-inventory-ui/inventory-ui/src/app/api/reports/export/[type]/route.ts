import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/api-helpers';
import {
  inventoryValuation,
  rowsToCsv,
  salesByProduct,
} from '@/modules/reports';
import { ValidationError } from '@/errors';

interface RouteContext {
  params: Promise<{ type: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { type } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') ?? undefined;
    const to = sp.get('to') ?? undefined;

    let csv: string;
    let filename: string;

    if (type === 'sales') {
      const rows = salesByProduct(from, to).map((r) => ({
        productId: r.productId,
        sku: r.sku,
        name: r.name,
        quantity: r.quantity,
        revenue: r.revenue,
      }));
      csv = rowsToCsv(['productId', 'sku', 'name', 'quantity', 'revenue'], rows);
      filename = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === 'inventory') {
      const { rows } = inventoryValuation();
      csv = rowsToCsv(
        ['productId', 'sku', 'name', 'quantity', 'cost', 'valuation'],
        rows,
      );
      filename = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      throw new ValidationError(`未対応のエクスポート: ${type}`);
    }

    // Prepend BOM for Excel compatibility with non-ASCII text.
    const body = `﻿${csv}`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
