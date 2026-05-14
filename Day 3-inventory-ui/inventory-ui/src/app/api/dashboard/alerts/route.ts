import { handleError, ok } from '@/lib/api-helpers';
import { lowStockAlerts } from '@/modules/reports';

export async function GET() {
  try {
    return ok(lowStockAlerts());
  } catch (err) {
    return handleError(err);
  }
}
