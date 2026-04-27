import { getClient } from "../db/client.js";
import { NotFoundError } from "../errors/index.js";

export interface DailyShipment {
  date: string;
  quantity: number;
}

export interface ForecastResult {
  sku: string;
  warehouse: string;
  period_days: number;
  daily_shipments: DailyShipment[];
  moving_average: number;
  std_deviation: number;
  lead_time_days: number;
  safety_stock: number;
  reorder_point: number;
  confidence_interval: { lower: number; upper: number };
  recommendation: string;
}

/**
 * Get daily outbound shipment quantities for a product in a warehouse
 * over the last N days.
 */
export async function getShipmentHistory(
  sku: string,
  warehouse: string,
  days: number,
): Promise<DailyShipment[]> {
  const db = getClient();

  const pRes = await db.execute({
    sql: "SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL",
    args: [sku],
  });
  if (pRes.rows.length === 0) throw new NotFoundError("product", sku);

  const wRes = await db.execute({
    sql: "SELECT id FROM warehouses WHERE name = ?",
    args: [warehouse],
  });
  if (wRes.rows.length === 0) throw new NotFoundError("warehouse", warehouse);

  const productId = Number(pRes.rows[0].id);
  const warehouseId = Number(wRes.rows[0].id);

  const res = await db.execute({
    sql: `SELECT DATE(created_at) AS date, SUM(quantity) AS quantity
          FROM stock_movements
          WHERE product_id = ? AND warehouse_id = ? AND type = 'out'
            AND created_at >= datetime('now', '-' || ? || ' days')
          GROUP BY DATE(created_at)
          ORDER BY date`,
    args: [productId, warehouseId, days],
  });

  return res.rows.map((r) => ({
    date: String(r.date),
    quantity: Number(r.quantity),
  }));
}

/**
 * Calculate moving average from a series of values.
 */
export function movingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation.
 */
export function stdDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = movingAverage(values);
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate safety stock = Z * σ * √(lead_time)
 * Z = 1.96 for 95% confidence interval.
 */
export function safetyStock(
  stdDev: number,
  leadTimeDays: number,
  zScore: number = 1.96,
): number {
  return Math.ceil(zScore * stdDev * Math.sqrt(leadTimeDays));
}

/**
 * Reorder point = (average daily demand × lead time) + safety stock.
 */
export function reorderPoint(
  avgDailyDemand: number,
  leadTimeDays: number,
  safety: number,
): number {
  return Math.ceil(avgDailyDemand * leadTimeDays + safety);
}

/**
 * Generate a full demand forecast for a product.
 */
export async function forecast(
  sku: string,
  warehouse: string,
  periodDays: number = 30,
  leadTimeDays: number = 7,
): Promise<ForecastResult> {
  const shipments = await getShipmentHistory(sku, warehouse, periodDays);
  const quantities = shipments.map((s) => s.quantity);

  const avg = movingAverage(quantities);
  const sd = stdDeviation(quantities);
  const safety = safetyStock(sd, leadTimeDays);
  const reorder = reorderPoint(avg, leadTimeDays, safety);

  const zScore = 1.96;
  const marginOfError = zScore * sd / Math.sqrt(Math.max(quantities.length, 1));
  const confidenceInterval = {
    lower: Math.max(0, avg - marginOfError),
    upper: avg + marginOfError,
  };

  let recommendation: string;
  if (quantities.length === 0) {
    recommendation = "出庫履歴なし — データ不足のため予測不可";
  } else if (avg === 0) {
    recommendation = "出庫平均が0 — 現時点で発注不要";
  } else {
    recommendation = `推奨発注点: ${reorder}個 (安全在庫: ${safety}個, リードタイム: ${leadTimeDays}日)`;
  }

  return {
    sku,
    warehouse,
    period_days: periodDays,
    daily_shipments: shipments,
    moving_average: Math.round(avg * 100) / 100,
    std_deviation: Math.round(sd * 100) / 100,
    lead_time_days: leadTimeDays,
    safety_stock: safety,
    reorder_point: reorder,
    confidence_interval: {
      lower: Math.round(confidenceInterval.lower * 100) / 100,
      upper: Math.round(confidenceInterval.upper * 100) / 100,
    },
    recommendation,
  };
}

/**
 * Export forecast data as CSV for graphing.
 */
export function forecastToCsv(result: ForecastResult): string {
  const lines: string[] = [
    "date,quantity,moving_avg,upper_ci,lower_ci",
  ];
  for (const s of result.daily_shipments) {
    lines.push(
      `${s.date},${s.quantity},${result.moving_average},${result.confidence_interval.upper},${result.confidence_interval.lower}`,
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Generate a Mermaid xychart for the forecast data.
 */
export function forecastToMermaid(result: ForecastResult): string {
  if (result.daily_shipments.length === 0) {
    return "```mermaid\nxychart-beta\n  title \"No data available\"\n```";
  }
  const dates = result.daily_shipments.map((s) => `"${s.date}"`).join(", ");
  const quantities = result.daily_shipments.map((s) => s.quantity).join(", ");
  const avgLine = result.daily_shipments.map(() => result.moving_average).join(", ");

  return `\`\`\`mermaid
xychart-beta
  title "Demand Forecast: ${result.sku} @ ${result.warehouse}"
  x-axis [${dates}]
  y-axis "Quantity"
  bar [${quantities}]
  line [${avgLine}]
\`\`\``;
}
