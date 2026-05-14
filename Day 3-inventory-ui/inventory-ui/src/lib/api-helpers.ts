import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from '@/errors';

export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, init);
}

export function fail(error: ApiError, status: number): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ data: null, error }, { status });
}

export function handleError(err: unknown): NextResponse<ApiResponse<never>> {
  if (err instanceof ZodError) {
    return fail(
      {
        code: 'VALIDATION_ERROR',
        message: '入力内容に誤りがあります',
        details: err.flatten(),
      },
      422,
    );
  }
  if (err instanceof DomainError) {
    return fail({ code: err.code, message: err.message }, err.status);
  }
  console.error('[api] unexpected', err);
  return fail(
    { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' },
    500,
  );
}
