import { handleError, ok } from '@/lib/api-helpers';
import { dashboardSummary } from '@/modules/reports';

export async function GET() {
  try {
    return ok(dashboardSummary());
  } catch (err) {
    return handleError(err);
  }
}
