export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: number | string) {
    super('NOT_FOUND', `${resource} #${id} が見つかりません`, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productName: string, available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      `「${productName}」の在庫不足: 在庫 ${available} / 要求 ${requested}`,
      409,
    );
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}
