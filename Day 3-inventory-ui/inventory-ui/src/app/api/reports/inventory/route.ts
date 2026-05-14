import { handleError, ok } from '@/lib/api-helpers';
import { inventoryValuation } from '@/modules/reports';

export async function GET() {
  try {
    return ok(inventoryValuation());
  } catch (err) {
    return handleError(err);
  }
}
