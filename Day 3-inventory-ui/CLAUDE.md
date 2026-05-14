# Day 3 — Inventory UI

## プロジェクト概要
Day 2 で作った CLI 在庫管理システムを Next.js 16 + shadcn/ui で Web UI 化したプロジェクト。
ダッシュボード・商品管理・在庫管理・受注管理・レポートの 5 画面を提供する。

## 技術スタック
- **フレームワーク**: Next.js 16 (App Router, Turbopack)
- **UI**: shadcn/ui + Tailwind CSS v4
- **データ**: インメモリストア（再起動でリセット）
- **言語**: TypeScript

## ディレクトリ構成
```
inventory-ui/
├── src/
│   ├── app/           # App Router ページ + Server Actions
│   │   ├── page.tsx           # ダッシュボード
│   │   ├── products/          # 商品管理
│   │   ├── stock/             # 在庫管理
│   │   ├── orders/            # 受注管理
│   │   ├── reports/           # レポート
│   │   └── api/               # API Routes
│   ├── components/    # 共有 UI コンポーネント
│   ├── modules/       # ビジネスロジック（products/stock/orders/reports）
│   ├── db/            # インメモリストア + シードデータ
│   └── lib/           # format / fetcher / api-helpers
```

## 開発コマンド
```bash
cd "Day 3-inventory-ui/inventory-ui"
npm run dev      # 開発サーバー（http://localhost:3000）
npm run build    # プロダクションビルド
npm run lint     # ESLint
npm run format   # Prettier フォーマット
```

## 注意事項
- AGENTS.md 参照: Next.js 16 は破壊的変更あり。`node_modules/next/dist/docs/` を必ず確認する
- データはインメモリのため、サーバー再起動でシードデータに戻る

## Day 3 で学んだ拡張機能

### Skills（`~/.claude/skills/shadcn-page/`）
`/shadcn-page` コマンドで shadcn/ui ページ一式（page.tsx + components/ + actions.ts）を生成する。

### Hooks（`.claude/hooks/`）
| スクリプト | フック | 目的 |
|---|---|---|
| `block-dangerous.sh` | PreToolUse (Bash) | `rm -rf` / `git push --force` / `git reset --hard` をブロック |
| `protect-files.sh` | PreToolUse (Edit/Write) | `.env` 系・ロックファイルの編集をブロック |
| `auto-format.sh` | PostToolUse (Edit/Write) | inventory-ui の TS/TSX/CSS を Prettier で自動フォーマット |

### Rules（`.claude/rules/`）
| ファイル | 適用対象 |
|---|---|
| `api-routes.md` | `src/app/api/**/*.ts` — try-catch・{data,error}形式・Zod バリデーション |
| `testing.md` | `**/*.test.ts` — describe/it形式・日本語テスト名・AAA パターン |
