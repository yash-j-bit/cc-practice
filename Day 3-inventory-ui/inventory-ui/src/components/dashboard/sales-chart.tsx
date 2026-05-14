import { formatJPY } from '@/lib/format';

interface Props {
  data: Array<{ date: string; total: number; orderCount: number }>;
}

export function SalesChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div
      className="grid gap-2"
      role="img"
      aria-label={`過去 ${data.length} 日間の売上推移`}
    >
      <ul className="flex h-48 items-end gap-2">
        {data.map((d) => {
          const height = Math.round((d.total / max) * 100);
          return (
            <li
              key={d.date}
              className="flex flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="text-[10px] text-muted-foreground">
                {d.total > 0 ? formatJPY(d.total) : '-'}
              </span>
              <div
                className="w-full rounded-t-md bg-primary/80 transition-all"
                style={{ height: `${Math.max(height, 2)}%` }}
                aria-hidden
              />
              <span className="text-[10px] text-muted-foreground">
                {d.date.slice(5)}
              </span>
            </li>
          );
        })}
      </ul>
      {data.every((d) => d.total === 0) && (
        <p className="text-center text-xs text-muted-foreground">
          期間内の売上はまだありません。
        </p>
      )}
    </div>
  );
}
