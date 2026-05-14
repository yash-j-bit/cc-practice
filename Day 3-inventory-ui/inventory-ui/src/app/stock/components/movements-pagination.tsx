'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  page: number;
  pageSize: number;
  total: number;
}

export function MovementsPagination({ page, pageSize, total }: Props) {
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }));
  const disabledClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'pointer-events-none opacity-50',
  );

  function makeHref(targetPage: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set('page', String(targetPage));
    return `/stock?${sp.toString()}`;
  }

  if (total === 0) return null;

  return (
    <nav
      aria-label="入出庫履歴のページネーション"
      className="flex flex-col items-center justify-between gap-2 sm:flex-row"
    >
      <p className="text-xs text-muted-foreground">
        全 {total} 件 / {page} / {totalPages} ページ
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={makeHref(page - 1)} className={linkClass}>
            前へ
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            前へ
          </span>
        )}
        {page < totalPages ? (
          <Link href={makeHref(page + 1)} className={linkClass}>
            次へ
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            次へ
          </span>
        )}
      </div>
    </nav>
  );
}
