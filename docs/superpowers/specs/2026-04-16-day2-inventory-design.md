# Day 2 — Inventory Management MVP Design

**Date:** 2026-04-16
**Scope:** Parts 1–5 of the Day 2 tutorial (MVP). Parts 6–9 deferred.

## Goal
CLI-based inventory management system built with TypeScript + libSQL, implementing product, stock, and order management with tests.

## Tech Stack
- TypeScript + Node.js, `tsx` dev runner
- libSQL (`@libsql/client`): file-backed `inventory.db` in dev, `:memory:` in tests
- Commander.js (scaffolded; CLI wiring itself is Part 7 and deferred)
- Vitest
- Zod v3 (explicit `zod@3` install — v4 is stable but tutorial requires v3)
- ESLint + `@typescript-eslint`

## Directory Layout
```
Day 2-inventory/
├── CLAUDE.md
├── package.json, tsconfig.json, vitest.config.ts, .eslintrc.cjs
├── src/
│   ├── db/{client.ts, schema.ts, migrate.ts}
│   ├── modules/{product.ts, stock.ts, order.ts}
│   ├── errors/index.ts
│   └── utils/logger.ts
└── tests/{product.test.ts, stock.test.ts, order.test.ts}
```

## Schema (all 9 tables)
products, warehouses, inventory, stock_movements, orders, order_items, shipments, campaigns, transactions. MVP exercises the first 6; shipments/campaigns/transactions defined for Parts 6+.

## Design Decisions
1. **Materialized inventory table** per (product, warehouse) + append-only stock_movements log. Chose A over B in Exercise 1-3 tradeoff (read perf > write simplicity).
2. **Logical delete** for products (`deleted_at`); physical delete for orders.
3. **Negative stock is rejected** — `stockOut` throws `InsufficientStockError` when qty < requested.
4. **Single default warehouse** seeded at migration ("Main"). Schema supports multi-warehouse for future.

## Error Handling
Custom error classes in `src/errors/`:
- `NotFoundError`, `ValidationError`, `InsufficientStockError`
Standard `throw` + `try/catch`. CLI layer (deferred) converts to user-friendly messages.

## Testing
- Vitest, colocated `tests/<module>.test.ts` per MVP module.
- Each test suite builds fresh in-memory DB via `beforeEach`.
- TDD: red (failing test) → green (minimal impl) → refactor.

## Out of Scope for MVP
- CLI command layer (Part 7)
- Campaigns, accounting, shipments, CSV export (Parts 6, 8)
- Integration tests across modules (Part 8)
- Rewind exercise (Part 9 — interactive)
- Parts 4.5 and 5 are Claude Code meta-demos; skipped in execution.

## Acceptance Criteria
- `npm run build` succeeds
- `npm test` passes (product, stock, order)
- `npm run lint` passes
