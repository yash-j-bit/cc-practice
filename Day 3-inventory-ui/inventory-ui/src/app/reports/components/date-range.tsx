'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function DateRange() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    startTransition(() => router.push(`/reports?${sp.toString()}`));
  }

  return (
    <div
      className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      aria-busy={pending}
    >
      <div className="grid gap-1">
        <Label htmlFor="report-from">開始日</Label>
        <Input
          id="report-from"
          type="date"
          defaultValue={params.get('from')?.slice(0, 10) ?? ''}
          onBlur={(e) =>
            update({
              from: e.target.value
                ? new Date(`${e.target.value}T00:00:00Z`).toISOString()
                : undefined,
            })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="report-to">終了日</Label>
        <Input
          id="report-to"
          type="date"
          defaultValue={params.get('to')?.slice(0, 10) ?? ''}
          onBlur={(e) =>
            update({
              to: e.target.value
                ? new Date(`${e.target.value}T23:59:59Z`).toISOString()
                : undefined,
            })
          }
        />
      </div>
      <Button
        variant="outline"
        type="button"
        onClick={() => update({ from: undefined, to: undefined })}
        disabled={pending}
      >
        期間をクリア
      </Button>
    </div>
  );
}
