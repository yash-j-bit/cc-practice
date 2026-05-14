import { headers } from 'next/headers';
import type { ApiResponse } from './api-helpers';

/**
 * Build an absolute origin for server-side fetch within the same Next.js app.
 * Reads protocol/host from the incoming request headers.
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (!host) {
    throw new Error('Cannot resolve request host for server fetch');
  }
  return `${proto}://${host}`;
}

export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = await origin();
  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    ...init,
  });
  const body = (await res.json()) as ApiResponse<T>;
  if (body.error || !res.ok) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }
  return body.data as T;
}
