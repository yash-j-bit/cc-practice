# Day 2 — Inventory Management System

CLI-based inventory management built with TypeScript + libSQL (SQLite-compatible).

## Stack
- TypeScript + Node.js (ESM, `module: "Node16"`)
- libSQL (`@libsql/client`) — file-backed in dev, `:memory:` in tests
- Commander.js (CLI — Part 7, deferred in MVP)
- Vitest (tests), Zod v3 (validation), ESLint (lint)

## プロジェクト固有のルール

### DB アクセス
- すべての DB 操作は `src/db/` 内の関数を経由する
- 直接 SQL を書くのは `src/db/queries/` 内のみ（現状はモジュール内に置く — queries/ 分離は必要になったら）
- トランザクションは明示的に `BEGIN` / `COMMIT` する

### エラーハンドリング
- カスタム Error クラス（`src/errors/`）を使用
  - `NotFoundError`, `ValidationError`, `InsufficientStockError`
- CLI 出力時は必ずユーザーフレンドリーなメッセージに変換する
- 本プロジェクトは標準の `throw` + `try/catch` パターン。`neverthrow` は使わない。

### テスト
- 各モジュールに対応するテストファイルを `tests/` に作成
- テスト用 DB は `:memory:` を使用（`beforeEach` で新規初期化）
- TDD: red → green → refactor の順

### 指示の出し方（失敗パターン回避）
- 「改善して」「よくして」のような曖昧な指示は避ける
- 必ず対象ファイル、関数名、受け入れ条件を明示する
- 変更前に、何をするつもりか確認すること

### コマンド
- ビルド: `npm run build`
- テスト: `npm test`
- 単一テスト: `npm test -- -t "テスト名"`
- lint: `npm run lint`
- マイグレーション: `npm run migrate`

## MVP スコープ（Day 2）
Part 1〜5 の Required:
- 商品管理（product）: add / list / update / delete
- 在庫管理（stock）: stockIn / stockOut / getStockStatus
- 受注管理（order）: createOrder / listOrders / updateOrderStatus

Part 6 以降（campaign / accounting / CLI / integration tests）は後回し。
