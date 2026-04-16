export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} not found: ${identifier}`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
  }
}

export class InsufficientStockError extends AppError {
  readonly available: number;
  readonly requested: number;

  constructor(available: number, requested: number) {
    super(
      `Insufficient stock: available=${available}, requested=${requested}`,
    );
    this.available = available;
    this.requested = requested;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message);
  }
}
